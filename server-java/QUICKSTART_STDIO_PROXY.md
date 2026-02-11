# Quick Start: Java Gateway with External Stdio Proxy

Run the Java MCP Gateway with the **stdio-proxy-service** to convert stdio MCP servers (e.g. Playwright) to HTTP endpoints.

## Prerequisites

- Docker and Docker Compose
- (Optional) Node.js 18+ if testing the proxy locally

## Start the Stack

```bash
cd server-java

# Copy MCP server config
cp ../mcp_servers.yaml .

# Start all services (gateway + stdio-proxy + postgres + mock server)
docker compose up -d
```

**Services:**

| Service        | URL                         | Description                    |
|----------------|-----------------------------|--------------------------------|
| MCP Gateway    | http://localhost:8000       | Java gateway, proxies MCP      |
| Stdio Proxy    | http://localhost:8082       | Converts stdio servers to HTTP |
| PostgreSQL     | localhost:5432              | Gateway database               |
| Mock MCP       | http://localhost:3000       | Test HTTP server               |

## Verify

```bash
# Gateway health
curl http://localhost:8000/actuator/health | jq

# Stdio proxy health
curl http://localhost:8082/health | jq

# List MCP servers
curl http://localhost:8000/mcp/servers | jq
```

## Convert a Stdio Server to HTTP

1. **Add a stdio server** (e.g. Playwright) to `mcp_servers.yaml`:

```yaml
servers:
  playwright-mcp-server:
    type: stdio
    enabled: true
    description: "Playwright MCP server"
    metadata:
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-playwright"
```

2. **Register the server** (if using DB migration, it may auto-load; otherwise create via API):

```bash
curl -X POST http://localhost:8000/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "playwright-mcp-server",
    "type": "stdio",
    "enabled": true,
    "metadata": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }'
```

3. **Convert to HTTP** via the external proxy:

```bash
curl -X POST http://localhost:8000/mcp/servers/playwright-mcp-server/convert-to-http | jq
```

Example response:

```json
{
  "name": "playwright-mcp-server",
  "type": "http",
  "url": "http://stdio-proxy:8080/servers/playwright-mcp-server/mcp",
  "status": "converted",
  "proxy_port": 9001
}
```

4. **Use the converted server**:

```bash
curl "http://localhost:8000/mcp/list-tools?mcp_server=playwright-mcp-server" | jq
```

## Configuration

The gateway uses the external proxy when these env vars are set:

| Variable                  | Default                    | Description                          |
|---------------------------|----------------------------|--------------------------------------|
| `STDIO_PROXY_EXTERNAL`    | `true` (in Docker)         | Use external proxy vs local spawn    |
| `STDIO_PROXY_SERVICE_URL` | `http://stdio-proxy:8080`  | Base URL of the stdio-proxy service  |

Override in `.env` or `docker compose`:

```bash
# Use a different proxy URL (e.g. for local dev)
STDIO_PROXY_SERVICE_URL=http://host.docker.internal:8082
STDIO_PROXY_EXTERNAL=true
```

## Stdio Proxy APIs

For operations/debugging:

```bash
# List running proxies
curl http://localhost:8082/convert | jq

# Get status of a proxy
curl http://localhost:8082/convert/playwright-mcp-server | jq

# Stop a proxy (gateway does this on server delete)
curl -X DELETE http://localhost:8082/convert/playwright-mcp-server | jq
```

## Cleanup

```bash
docker compose down

# Remove volumes
docker compose down -v
```

## Troubleshooting

**Gateway fails to start**

- Ensure stdio-proxy is healthy: `curl http://localhost:8082/health`
- Gateway waits for stdio-proxy via `depends_on`; check logs: `docker compose logs stdio-proxy`

**Convert returns 503**

- Proxy service unreachable; verify `STDIO_PROXY_SERVICE_URL` is correct from inside the gateway container
- In Docker: `http://stdio-proxy:8080` (service name)
- From host: `http://localhost:8082`

**Convert returns 500**

- Check proxy logs: `docker compose logs stdio-proxy`
- Ensure `command` and `args` in metadata are valid (e.g. `npx` and `["-y", "@modelcontextprotocol/server-playwright"]`)
