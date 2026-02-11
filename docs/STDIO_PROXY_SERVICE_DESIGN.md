# Stdio Proxy Service – API and Gateway Contract Design

## Overview

This document defines the API and contract between the **Java MCP Gateway** and a **standalone Node.js Stdio Proxy Service** for converting stdio MCP servers to HTTP. The proxy service spawns `mcp-proxy` processes and exposes them via HTTP endpoints.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MCP Gateway (Java)                                │
│  - Stores MCP server configs (DB)                                         │
│  - On "Convert": calls Proxy API, stores returned URL                    │
│  - On startup: re-registers converted servers with Proxy                  │
│  - Forwards MCP requests to Proxy URLs                                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Stdio Proxy Service (Node.js)                            │
│  - POST /convert: spawn mcp-proxy, return URL                            │
│  - DELETE /convert/:serverName: stop proxy                               │
│  - GET /convert: list running proxies                                    │
│  - Exposes each proxy on allocated port (e.g. 9001, 9002)                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ subprocess
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  mcp-proxy (npx mcp-proxy --port X -- npx -y @modelcontextprotocol/...)  │
│  stdio MCP server (subprocess of mcp-proxy)                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Proxy Service API

### Base URL

- Configurable via `STDIO_PROXY_SERVICE_URL` (e.g. `http://stdio-proxy:8080`)
- All paths below are relative to this base

### Endpoints

#### 1. Convert (Start Proxy)

Start a stdio-to-HTTP proxy for the given server configuration.

```
POST /convert
Content-Type: application/json
```

**Request body:**

```json
{
  "serverName": "playwright-mcp-server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-playwright"],
  "env": {
    "DISPLAY": ":0"
  }
}
```

| Field       | Type               | Required | Description                                      |
|------------|--------------------|----------|--------------------------------------------------|
| serverName | string             | Yes      | Unique identifier; used for stop/status         |
| command    | string             | Yes      | Executable (e.g. `npx`, `node`, `python`)       |
| args       | string[]           | Yes      | Arguments to the command                        |
| env        | Record<string, string> | No    | Environment variables for the stdio process     |

**Response (201 Created):**

```json
{
  "serverName": "playwright-mcp-server",
  "url": "http://stdio-proxy:9001/mcp",
  "port": 9001,
  "status": "running"
}
```

| Field     | Type   | Description                                      |
|----------|--------|--------------------------------------------------|
| serverName | string | Echo of request                                  |
| url      | string | Full URL for MCP streamable HTTP (Gateway uses this) |
| port     | number | Allocated port (for debugging)                   |
| status   | string | Always `"running"` on success                     |

**Errors:**

| Status | Condition                                      |
|--------|------------------------------------------------|
| 400    | Missing serverName, command, or args           |
| 409    | Server already converted (call DELETE first)  |
| 500    | Failed to spawn mcp-proxy (e.g. Node.js missing) |

---

#### 2. Stop Proxy

Stop the proxy for a given server.

```
DELETE /convert/{serverName}
```

**Path parameter:** `serverName` – must match the value used in POST /convert

**Response (200 OK):**

```json
{
  "serverName": "playwright-mcp-server",
  "status": "stopped"
}
```

**Errors:**

| Status | Condition      |
|--------|----------------|
| 404    | Server not found / not running |

---

#### 3. Get Proxy Status

Get status of a single proxy.

```
GET /convert/{serverName}
```

**Response (200 OK):**

```json
{
  "serverName": "playwright-mcp-server",
  "url": "http://stdio-proxy:9001/mcp",
  "port": 9001,
  "status": "running"
}
```

**Errors:**

| Status | Condition      |
|--------|----------------|
| 404    | Server not found |

---

#### 4. List All Proxies

List all running proxies (for operations/debugging).

```
GET /convert
```

**Response (200 OK):**

```json
{
  "servers": [
    {
      "serverName": "playwright-mcp-server",
      "url": "http://stdio-proxy:9001/mcp",
      "port": 9001,
      "status": "running"
    }
  ],
  "count": 1
}
```

---

#### 5. Health Check

For Kubernetes liveness/readiness probes.

```
GET /health
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "servers": 2
}
```

---

## Gateway Contract (How Gateway Uses the Proxy)

### 1. Configuration

| Property                      | Env Variable              | Default      | Description                   |
|------------------------------|---------------------------|--------------|-------------------------------|
| Proxy service URL            | `STDIO_PROXY_SERVICE_URL` | (empty)      | Base URL of proxy service     |
| Use external proxy           | `STDIO_PROXY_EXTERNAL`     | `false`      | If true, use proxy service; else spawn locally |

When `STDIO_PROXY_SERVICE_URL` is set and `STDIO_PROXY_EXTERNAL=true`, the gateway uses the proxy service. Otherwise, it keeps the current in-process behavior.

### 2. Convert Flow

1. User clicks "Convert to HTTP" in the UI.
2. Gateway receives `POST /mcp/servers/{name}/convert-to-http`.
3. Gateway loads server from DB; validates stdio type and `command` in metadata.
4. Gateway calls proxy:
   - `POST {STDIO_PROXY_SERVICE_URL}/convert`
   - Body: `{ serverName, command, args, env }` from metadata
5. Proxy returns `{ url, port, status }`.
6. Gateway updates DB:
   - `type` = `"http"`
   - `url` = proxy response `url` (e.g. `http://stdio-proxy:9001/mcp`)
   - `metadata.converted_from_stdio` = `true`
   - `metadata.stdio_command` = original command
   - `metadata.stdio_args` = original args
   - `metadata.stdio_env` = original env (if any)
   - Remove `metadata.command`, `metadata.args`, `metadata.env` (or keep for revert)
7. Gateway invalidates cache and returns success to the client.

### 3. Stored Data Shape (Gateway DB)

After conversion, the MCP server record looks like:

```json
{
  "name": "playwright-mcp-server",
  "type": "http",
  "url": "http://stdio-proxy:9001/mcp",
  "metadata": {
    "converted_from_stdio": true,
    "stdio_command": "npx",
    "stdio_args": ["-y", "@modelcontextprotocol/server-playwright"],
    "stdio_env": { "DISPLAY": ":0" }
  }
}
```

### 4. MCP Request Flow (After Conversion)

1. Client sends MCP request (e.g. `tools/list`) to the gateway.
2. Gateway resolves `playwright-mcp-server` from config.
3. Gateway sees `type: "http"` and `url: "http://stdio-proxy:9001/mcp"`.
4. Gateway uses `HttpClientStreamableHttpTransport` to call that URL.
5. Proxy receives HTTP on port 9001 and forwards to the stdio subprocess.

No change to the gateway’s MCP client: it uses the stored URL as-is.

### 5. Gateway Startup (Re-registration)

After a restart, the proxy service may have lost all proxies. The gateway must re-register them.

1. On startup, after loading config from DB:
2. Find servers where `metadata.converted_from_stdio === true` and `url` points to the proxy service (e.g. host matches `STDIO_PROXY_SERVICE_URL`).
3. For each such server:
   - Call `POST {proxy_url}/convert` with `{ serverName, command, args, env }` from metadata.
   - If 409: proxy already running, no change.
   - If 200/201: optionally update `url` if it changed (e.g. new port).
4. Run this asynchronously so startup is not blocked.

### 6. Server Delete

When a user deletes an MCP server that was converted:

1. Gateway deletes the server from DB.
2. Gateway calls `DELETE {proxy_url}/convert/{serverName}`.
3. Ignore 404 (proxy may already be stopped).

### 7. Revert to Stdio (Optional)

If reverting a converted server back to stdio:

1. Gateway calls `DELETE {proxy_url}/convert/{serverName}`.
2. Gateway updates DB:
   - `type` = `"stdio"`
   - `url` = `"stdio://{serverName}"` (or placeholder)
   - `metadata.command` = `metadata.stdio_command`
   - `metadata.args` = `metadata.stdio_args`
   - `metadata.env` = `metadata.stdio_env`
   - Remove `converted_from_stdio`, `stdio_command`, `stdio_args`, `stdio_env`

---

## Contract Summary

| Action           | Gateway                                | Proxy Service                          |
|------------------|----------------------------------------|----------------------------------------|
| Convert          | POST /convert with server config       | Spawn mcp-proxy, return URL             |
| Use converted    | Send MCP requests to proxy URL         | Forward to stdio subprocess             |
| Startup          | Re-register converted servers          | Accept /convert, start if not running  |
| Delete server    | DELETE /convert/{serverName}            | Stop proxy process                      |
| Revert to stdio  | DELETE /convert/{serverName}            | Stop proxy process                      |

---

## Error Handling

| Scenario                    | Gateway behavior                         |
|----------------------------|------------------------------------------|
| Proxy service unreachable  | Return 503 with "Proxy service unavailable" |
| Proxy returns 409          | Treat as already running; return success  |
| Proxy returns 500          | Return error to user; do not update DB   |
| Proxy returns 404 on DELETE| Ignore; assume already stopped           |

---

## Implementation Notes

### Proxy Service

- Language: Node.js (TypeScript or JavaScript)
- Port allocation: start from configurable base (e.g. 9000), use a pool or increment by server ID.
- Process tracking: `Map<serverName, { process, port }>`.
- On shutdown: stop all child processes.

### Gateway

- Use `WebClient` or `RestTemplate` to call the proxy service.
- `StdioToHttpConversionService` should:
  - Check `STDIO_PROXY_EXTERNAL` and `STDIO_PROXY_SERVICE_URL`.
  - If set: use HTTP client; otherwise: keep current `ProcessBuilder` flow.
- No `@PostConstruct` restart when using external proxy: re-registration is explicit and can be driven by a startup listener.

### URL Handling

- Proxy returns URLs using its own host (e.g. `http://stdio-proxy:9001/mcp`).
- Gateway stores this URL as-is.
- The gateway must be able to reach it (same cluster, DNS, network policy, etc.).

---

## Open Questions

1. **Authentication**: Should the gateway authenticate to the proxy (e.g. API key)?
2. **Timeouts**: Should the proxy have a timeout for idle proxy processes?
3. **Resource limits**: Max number of concurrent proxies per proxy service instance?
