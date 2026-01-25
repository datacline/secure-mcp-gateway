package com.datacline.mcpgateway.client;

import io.modelcontextprotocol.client.McpAsyncClient;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.ClientCapabilities;
import io.modelcontextprotocol.spec.McpSchema.Content;
import io.modelcontextprotocol.spec.McpSchema.CreateMessageResult;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
import io.modelcontextprotocol.spec.McpSchema.GetPromptRequest;
import io.modelcontextprotocol.spec.McpSchema.GetPromptResult;
import io.modelcontextprotocol.spec.McpSchema.ListPromptsResult;
import io.modelcontextprotocol.spec.McpSchema.ListResourcesResult;
import io.modelcontextprotocol.spec.McpSchema.ListToolsResult;
import io.modelcontextprotocol.spec.McpSchema.ReadResourceRequest;
import io.modelcontextprotocol.spec.McpSchema.ReadResourceResult;
import io.modelcontextprotocol.spec.McpSchema.Resource;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletionStage;

/**
 * MCP HTTP Client using the official MCP Java SDK
 * ({@code io.modelcontextprotocol.sdk:mcp}).
 *
 * <p>
 * Uses Streamable HTTP transport per the MCP specification. Handles
 * initialization, tools, resources, and prompts in a protocol-compliant way.
 */
@Service
public class McpHttpClient {

    private static final Logger LOG = LoggerFactory.getLogger(McpHttpClient.class);

    public McpHttpClient() {
        // No injected deps; SDK uses JDK HttpClient and own JSON
    }

    /**
     * List tools from an MCP server via the official SDK.
     */
    public CompletionStage<List<Map<String, Object>>> listTools(
            String url,
            Map<String, String> authHeaders,
            Duration timeout) {
        LOG.info("Listing tools from MCP server at {}", url);
        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .doOnSuccess(initResult -> {
                    LOG.info("MCP client initialized successfully");
                    LOG.debug("Server info: name={}, version={}",
                            initResult.serverInfo() != null ? initResult.serverInfo().name() : "unknown",
                            initResult.serverInfo() != null ? initResult.serverInfo().version() : "unknown");
                    LOG.debug("Server capabilities: {}", initResult.capabilities());
                })
                .doOnError(error -> LOG.error("Failed to initialize MCP client: {}", error.getMessage()))
                .flatMap(initResult -> {
                    LOG.debug("Requesting tools list...");
                    return client.listTools()
                            .doOnSuccess(result -> LOG.info("Retrieved {} tools",
                                    result.tools() != null ? result.tools().size() : 0))
                            .doOnError(error -> LOG.error("Failed to list tools: {}", error.getMessage()))
                            .onErrorResume(error -> {
                                // If text/plain error occurs, return empty list with a warning
                                if (error.getMessage() != null && error.getMessage().contains("text/plain")) {
                                    LOG.warn("Server returned text/plain response - this may be a protocol compatibility issue. Returning empty tools list.");
                                    return Mono.just(new McpSchema.ListToolsResult(List.of(), null));
                                }
                                return Mono.error(error);
                            });
                })
                .map(this::toToolsList));
    }

    /**
     * Call a tool on an MCP server via the official SDK.
     */
    public CompletionStage<Map<String, Object>> callTool(
            String url,
            Map<String, String> authHeaders,
            Duration timeout,
            String toolName,
            Map<String, Object> arguments) {
        Map<String, Object> args = arguments != null ? arguments : Map.of();
        CallToolRequest req = CallToolRequest.builder()
                .name(toolName)
                .arguments(args)
                .build();

        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .flatMap(initResult -> client.callTool(req))
                .map(this::toCallToolResult));
    }

    /**
     * List resources from an MCP server via the official SDK.
     */
    public CompletionStage<List<Map<String, Object>>> listResources(
            String url,
            Map<String, String> authHeaders,
            Duration timeout) {
        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .flatMap(initResult -> client.listResources())
                .map(this::toResourcesList));
    }

    /**
     * Read a resource from an MCP server via the official SDK.
     */
    public CompletionStage<Map<String, Object>> readResource(
            String url,
            Map<String, String> authHeaders,
            Duration timeout,
            String uri) {
        ReadResourceRequest req = new ReadResourceRequest(uri);

        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .flatMap(initResult -> client.readResource(req))
                .map(this::toReadResourceResult));
    }

    /**
     * List prompts from an MCP server via the official SDK.
     */
    public CompletionStage<List<Map<String, Object>>> listPrompts(
            String url,
            Map<String, String> authHeaders,
            Duration timeout) {
        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .flatMap(initResult -> client.listPrompts())
                .map(this::toPromptsList));
    }

    /**
     * Get a prompt from an MCP server via the official SDK.
     */
    public CompletionStage<Map<String, Object>> getPrompt(
            String url,
            Map<String, String> authHeaders,
            Duration timeout,
            String name,
            Map<String, Object> arguments) {
        Map<String, Object> args = arguments != null ? arguments : Map.of();
        GetPromptRequest req = new GetPromptRequest(name, args);

        return withClient(url, authHeaders, timeout, client -> client.initialize()
                .flatMap(initResult -> client.getPrompt(req))
                .map(this::toGetPromptResult));
    }

    private <T> CompletionStage<T> withClient(
            String url,
            Map<String, String> authHeaders,
            Duration timeout,
            java.util.function.Function<McpAsyncClient, Mono<T>> action) {

        var transportBuilder = HttpClientStreamableHttpTransport.builder(url);

        // Add auth headers if present using async request customizer
        if (authHeaders != null && !authHeaders.isEmpty()) {
            transportBuilder.asyncHttpRequestCustomizer((builder, method, endpoint, body, context) -> {
                LOG.info("=== HTTP Request to MCP Server ===");
                LOG.info("Method: {}", method);
                LOG.info("Endpoint: {}", endpoint);
                LOG.info("Body: {}", body != null ? body.substring(0, Math.min(200, body.length())) : "null");
                LOG.info("Auth Headers:");

                // Apply each header to the request builder
                authHeaders.forEach((key, value) -> {
                    builder.header(key, value);
                    LOG.info("  {}: {}", key, value);
                });

                LOG.info("===================================");
                return Mono.just(builder);
            });
        } else {
            // Log when no auth headers
            transportBuilder.asyncHttpRequestCustomizer((builder, method, endpoint, body, context) -> {
                LOG.info("=== HTTP Request to MCP Server (No Auth) ===");
                LOG.info("Method: {}", method);
                LOG.info("Endpoint: {}", endpoint);
                LOG.info("Body: {}", body != null ? body.substring(0, Math.min(200, body.length())) : "null");
                LOG.info("===================================");
                return Mono.just(builder);
            });
        }

        var transport = transportBuilder.build();

        // McpSyncClient client = McpClient.sync(transport)
        // .requestTimeout(Duration.ofSeconds(10))
        // .capabilities(ClientCapabilities.builder()
        // .roots(true) // Enable roots capability
        // .sampling() // Enable sampling capability
        // .elicitation() // Enable elicitation capability
        // .build())
        // .sampling(request -> CreateMessageResult.builder().build())
        // .elicitation(elicitRequest -> ElicitResult.builder().build())
        // .toolsChangeConsumer((List<McpSchema.Tool> tools) -> {})
        // .resourcesChangeConsumer((List<McpSchema.Resource> resources) -> {})
        // .promptsChangeConsumer((List<McpSchema.Prompt> prompts) -> {})
        // .build();

        McpAsyncClient client = McpClient.async(transport)
                .requestTimeout(timeout)
                .build();

        Mono<T> mono = action.apply(client)
                .doOnError(error -> LOG.error("MCP client operation failed: {}", error.getMessage(), error))
                .doFinally(signal -> {
                    LOG.debug("Closing MCP client with signal: {}", signal);
                    client.closeGracefully().subscribe();
                });

        return mono.toFuture();
    }

    private List<Map<String, Object>> toToolsList(ListToolsResult r) {
        if (r == null || r.tools() == null) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Tool t : r.tools()) {
            Map<String, Object> m = new HashMap<>();
            m.put("name", t.name());
            m.put("description", t.description() != null ? t.description() : "");
            m.put("inputSchema", t.inputSchema() != null ? t.inputSchema() : Map.of());
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> toCallToolResult(CallToolResult r) {
        Map<String, Object> out = new HashMap<>();
        if (r != null && r.content() != null) {
            List<Map<String, Object>> content = new ArrayList<>();
            for (Content c : r.content()) {
                Map<String, Object> entry = new HashMap<>();
                entry.put("type", "text");
                if (c instanceof TextContent tc) {
                    entry.put("text", tc.text());
                }
                content.add(entry);
            }
            out.put("content", content);
        } else {
            out.put("content", List.<Map<String, Object>>of());
        }
        // Handle nullable isError() - default to false if null
        out.put("isError", r != null && r.isError() != null && r.isError());
        return out;
    }

    private List<Map<String, Object>> toResourcesList(ListResourcesResult r) {
        if (r == null || r.resources() == null) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Resource res : r.resources()) {
            Map<String, Object> m = new HashMap<>();
            m.put("uri", res.uri());
            m.put("name", res.name() != null ? res.name() : "");
            m.put("description", res.description());
            m.put("mimeType", res.mimeType());
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> toReadResourceResult(ReadResourceResult r) {
        List<Map<String, Object>> contents = new ArrayList<>();
        if (r != null && r.contents() != null) {
            for (var c : r.contents()) {
                if (c instanceof McpSchema.TextResourceContents trc) {
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("uri", trc.uri());
                    entry.put("text", trc.text() != null ? trc.text() : "");
                    contents.add(entry);
                }
            }
        }
        return Map.of("contents", contents);
    }

    private List<Map<String, Object>> toPromptsList(ListPromptsResult r) {
        if (r == null || r.prompts() == null) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (McpSchema.Prompt p : r.prompts()) {
            Map<String, Object> m = new HashMap<>();
            m.put("name", p.name());
            m.put("description", p.description() != null ? p.description() : "");
            m.put("arguments", p.arguments() != null ? p.arguments() : List.of());
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> toGetPromptResult(GetPromptResult r) {
        Map<String, Object> out = new HashMap<>();
        if (r != null && r.messages() != null) {
            List<Map<String, Object>> messages = new ArrayList<>();
            for (McpSchema.PromptMessage pm : r.messages()) {
                Map<String, Object> m = new HashMap<>();
                m.put("role", pm.role() != null ? pm.role().name() : "user");
                if (pm.content() instanceof TextContent tc) {
                    m.put("content", Map.of("type", "text", "text", tc.text() != null ? tc.text() : ""));
                }
                messages.add(m);
            }
            out.put("messages", messages);
        } else {
            out.put("messages", List.<Map<String, Object>>of());
        }
        if (r != null && r.description() != null) {
            out.put("description", r.description());
        }
        return out;
    }
}
