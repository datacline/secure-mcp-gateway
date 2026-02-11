package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.config.McpServerConfig;
import com.datacline.mcpgateway.entity.McpServerEntity;
import com.datacline.mcpgateway.repository.McpServerRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to convert stdio MCP servers to HTTP by spawning mcp-proxy processes.
 * Uses <a href="https://github.com/punkpeye/mcp-proxy">mcp-proxy</a> to wrap stdio
 * servers and expose them via HTTP/SSE endpoints.
 */
@Service
public class StdioToHttpConversionService {

    private static final Logger LOG = LoggerFactory.getLogger(StdioToHttpConversionService.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int PORT_RANGE = 1000;
    private static final int HEALTH_CHECK_RETRIES = 10;
    private static final int HEALTH_CHECK_DELAY_MS = 500;

    @Value("${gateway.stdio-proxy.base-port:9000}")
    private int basePort;

    @Value("${gateway.stdio-proxy.host:localhost}")
    private String proxyHost;

    @Value("${gateway.stdio-proxy.external:false}")
    private boolean externalProxy;

    @Value("${gateway.stdio-proxy.service-url:}")
    private String proxyServiceUrl;

    private final McpServerRepository repository;
    private final McpServerConfig mcpServerConfig;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Registry of server name -> Process for cleanup and management (local mode only) */
    private final Map<String, Process> runningProxies = new ConcurrentHashMap<>();

    /** Registry of server name -> allocated port (local mode only) */
    private final Map<String, Integer> allocatedPorts = new ConcurrentHashMap<>();

    public StdioToHttpConversionService(
            McpServerRepository repository,
            McpServerConfig mcpServerConfig) {
        this.repository = repository;
        this.mcpServerConfig = mcpServerConfig;
    }

    @PostConstruct
    public void restartConvertedServers() {
        List<McpServerEntity> converted = repository.findAll().stream()
                .filter(this::isConvertedFromStdio)
                .toList();

        if (converted.isEmpty()) return;

        if (externalProxy && proxyServiceUrl != null && !proxyServiceUrl.isBlank()) {
            LOG.info("Re-registering {} converted servers with external proxy service", converted.size());
            for (McpServerEntity entity : converted) {
                try {
                    Map<String, Object> metadata = fromJsonMap(entity.getMetadata());
                    String command = metadata != null ? (String) metadata.get("stdio_command") : null;
                    @SuppressWarnings("unchecked")
                    List<String> args = metadata != null && metadata.get("stdio_args") instanceof List
                            ? (List<String>) metadata.get("stdio_args") : null;
                    Map<String, String> env = parseEnvMap(metadata != null ? metadata.get("stdio_env") : null);
                    if (command != null) {
                        callProxyConvert(entity.getName(), command, args, env);
                        LOG.info("Re-registered proxy for {}", entity.getName());
                    }
                } catch (Exception e) {
                    LOG.warn("Failed to re-register proxy for {}: {}", entity.getName(), e.getMessage());
                }
            }
        } else {
            LOG.info("Restarting stdio-to-HTTP proxy processes for {} converted servers (local mode)", converted.size());
            for (McpServerEntity entity : converted) {
                try {
                    String url = entity.getUrl();
                    if (url != null && url.contains("localhost")) {
                        Integer port = extractPortFromUrl(url);
                        if (port != null) {
                            Map<String, Object> metadata = fromJsonMap(entity.getMetadata());
                            String command = metadata != null ? (String) metadata.get("stdio_command") : null;
                            @SuppressWarnings("unchecked")
                            List<String> args = metadata != null && metadata.get("stdio_args") instanceof List
                                    ? (List<String>) metadata.get("stdio_args") : null;

                            if (command != null) {
                                spawnProxy(entity.getName(), command, args, port, null);
                                allocatedPorts.put(entity.getName(), port);
                                LOG.info("Restarted proxy for {} on port {}", entity.getName(), port);
                            }
                        }
                    }
                } catch (Exception e) {
                    LOG.warn("Failed to restart proxy for {}: {}", entity.getName(), e.getMessage());
                }
            }
        }
    }

    /**
     * Convert a stdio MCP server to HTTP by spawning mcp-proxy.
     */
    @Transactional
    public Map<String, Object> convert(String serverName) {
        McpServerEntity entity = repository.findByName(serverName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Server not found: " + serverName));

        if (!"stdio".equalsIgnoreCase(entity.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Server is not stdio type. Only stdio servers can be converted.");
        }

        Map<String, Object> metadata = fromJsonMap(entity.getMetadata());
        if (metadata == null) metadata = new HashMap<>();

        String command = (String) metadata.get("command");
        @SuppressWarnings("unchecked")
        List<String> args = metadata.get("args") instanceof List ? (List<String>) metadata.get("args") : null;
        Map<String, String> env = parseEnvMap(metadata.get("env"));

        if (command == null || command.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Stdio server must have command configured in metadata");
        }

        if (args == null) args = List.of();

        // Stop any existing proxy for this server
        stopProxy(serverName);

        String url;
        int port;

        if (externalProxy && proxyServiceUrl != null && !proxyServiceUrl.isBlank()) {
            Map<String, Object> proxyResponse = callProxyConvert(serverName, command, args, env);
            url = (String) proxyResponse.get("url");
            Object portObj = proxyResponse.get("port");
            port = portObj instanceof Number ? ((Number) portObj).intValue() : 0;
        } else {
            port = allocatePort(serverName);
            spawnProxy(serverName, command, args, port, env);
            url = String.format("http://%s:%d/mcp", proxyHost, port);
        }

        // Update entity: switch to HTTP, set URL, store original stdio config in metadata
        Map<String, Object> newMetadata = new HashMap<>(metadata);
        newMetadata.put("converted_from_stdio", true);
        newMetadata.put("stdio_command", command);
        newMetadata.put("stdio_args", args);
        if (env != null) newMetadata.put("stdio_env", env);
        newMetadata.put("stdio_proxy_port", port);
        newMetadata.remove("command");
        newMetadata.remove("args");
        newMetadata.remove("env");

        entity.setType("http");
        entity.setUrl(url);
        entity.setMetadata(toJson(newMetadata));
        repository.save(entity);

        mcpServerConfig.invalidateCache(serverName);

        LOG.info("Converted stdio server {} to HTTP at {}", serverName, url);

        return Map.of(
                "name", serverName,
                "type", "http",
                "url", url,
                "status", "converted",
                "proxy_port", port
        );
    }

    /**
     * Stop the proxy process for a server (e.g., when reverting to stdio).
     */
    public void stopProxy(String serverName) {
        if (externalProxy && proxyServiceUrl != null && !proxyServiceUrl.isBlank()) {
            callProxyDelete(serverName);
        } else {
            Process p = runningProxies.remove(serverName);
            if (p != null && p.isAlive()) {
                p.destroyForcibly();
                LOG.info("Stopped proxy process for {}", serverName);
            }
            allocatedPorts.remove(serverName);
        }
    }

    /**
     * Notify that a server was deleted. Stops the proxy if it was converted and using external proxy.
     */
    public void notifyServerDeleted(String serverName) {
        repository.findByName(serverName).ifPresent(entity -> {
            if (isConvertedFromStdio(entity) && externalProxy && proxyServiceUrl != null && !proxyServiceUrl.isBlank()) {
                callProxyDelete(serverName);
            }
        });
    }

    private Map<String, Object> callProxyConvert(String serverName, String command, List<String> args, Map<String, String> env) {
        String baseUrl = proxyServiceUrl.replaceAll("/$", "");
        URI uri = URI.create(baseUrl + "/convert");

        Map<String, Object> body = new HashMap<>();
        body.put("serverName", serverName);
        body.put("command", command);
        body.put("args", args != null ? args : List.of());
        if (env != null && !env.isEmpty()) body.put("env", env);

        String jsonBody;
        try {
            jsonBody = OBJECT_MAPPER.writeValueAsString(body);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize request: " + e.getMessage());
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(uri)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .timeout(Duration.ofSeconds(30))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();

            if (status == 409) {
                // Already running - parse response for url
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = OBJECT_MAPPER.readValue(response.body(), Map.class);
                return parsed;
            }
            if (status == 201 || status == 200) {
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = OBJECT_MAPPER.readValue(response.body(), Map.class);
                return parsed;
            }
            throw new ResponseStatusException(HttpStatus.valueOf(status),
                    "Proxy service error: " + response.body());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Proxy service unavailable: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Interrupted: " + e.getMessage());
        }
    }

    private void callProxyDelete(String serverName) {
        if (proxyServiceUrl == null || proxyServiceUrl.isBlank()) return;
        String baseUrl = proxyServiceUrl.replaceAll("/$", "");
        String encodedName = URLEncoder.encode(serverName, StandardCharsets.UTF_8);
        URI uri = URI.create(baseUrl + "/convert/" + encodedName);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(uri)
                .DELETE()
                .timeout(Duration.ofSeconds(5))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200 || response.statusCode() == 404) {
                LOG.info("Stopped proxy for {} (external)", serverName);
            }
        } catch (Exception e) {
            LOG.warn("Failed to stop proxy for {}: {} (ignored)", serverName, e.getMessage());
        }
    }

    private int allocatePort(String serverName) {
        int hash = Math.abs(serverName.hashCode());
        int port = basePort + (hash % PORT_RANGE);

        for (int i = 0; i < PORT_RANGE; i++) {
            int candidate = basePort + ((hash + i) % PORT_RANGE);
            if (!allocatedPorts.containsValue(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("No available port in range " + basePort + "-" + (basePort + PORT_RANGE));
    }

    private void spawnProxy(String serverName, String command, List<String> args, int port, Map<String, String> env) {
        List<String> cmd = new ArrayList<>();
        cmd.add("npx");
        cmd.add("-y");
        cmd.add("mcp-proxy");
        cmd.add("--port");
        cmd.add(String.valueOf(port));
        cmd.add("--shell");
        cmd.add("--");
        cmd.add(command);
        if (args != null) cmd.addAll(args);

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        pb.inheritIO(); // For debugging; consider redirecting to log file in production

        if (env != null && !env.isEmpty()) {
            Map<String, String> processEnv = pb.environment();
            processEnv.putAll(env);
        }

        try {
            Process process = pb.start();
            runningProxies.put(serverName, process);
            allocatedPorts.put(serverName, port);

            // Wait for proxy to be ready
            waitForHealthCheck(port);

            LOG.info("Started mcp-proxy for {} on port {}", serverName, port);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to start mcp-proxy. Ensure Node.js and npx are installed: " + e.getMessage());
        }
    }

    private void waitForHealthCheck(int port) {
        String pingUrl = "http://localhost:" + port + "/ping";
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();

        for (int i = 0; i < HEALTH_CHECK_RETRIES; i++) {
            try {
                Thread.sleep(HEALTH_CHECK_DELAY_MS);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(pingUrl))
                        .GET()
                        .timeout(Duration.ofSeconds(2))
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    return;
                }
            } catch (Exception e) {
                LOG.debug("Health check attempt {} failed: {}", i + 1, e.getMessage());
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "mcp-proxy did not become ready in time. Check logs for errors.");
    }

    private boolean isConvertedFromStdio(McpServerEntity entity) {
        Map<String, Object> meta = fromJsonMap(entity.getMetadata());
        return meta != null && Boolean.TRUE.equals(meta.get("converted_from_stdio"));
    }

    private Integer extractPortFromUrl(String url) {
        try {
            URI uri = URI.create(url);
            int port = uri.getPort();
            return port > 0 ? port : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return OBJECT_MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            LOG.warn("Failed to serialize to JSON", e);
            return null;
        }
    }

    private static Map<String, Object> fromJsonMap(String json) {
        if (json == null || json.isEmpty()) return new HashMap<>();
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            LOG.warn("Failed to parse JSON map", e);
            return new HashMap<>();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> parseEnvMap(Object envObj) {
        if (envObj == null || !(envObj instanceof Map)) return null;
        Map<String, String> result = new HashMap<>();
        ((Map<?, ?>) envObj).forEach((k, v) -> {
            if (k != null && v != null) result.put(k.toString(), v.toString());
        });
        return result.isEmpty() ? null : result;
    }
}
