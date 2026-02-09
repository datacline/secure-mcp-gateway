# Java Gateway Integration for Policy Engine

## Overview

The Policy Engine now fetches MCP servers directly from the **Java MCP Gateway** instead of maintaining its own registry. This ensures a single source of truth for all MCP server configurations.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────┐
│      Frontend (React)                 │
│   - Policy Creator                    │
│   - Server Selector                   │
│   - Tool Picker                       │
└───────────────┬──────────────────────┘
                │ HTTP
                ▼
┌──────────────────────────────────────┐
│   Policy Engine (Go) - Port 9000     │
│   /api/v1/mcp-servers                │
│   /api/v1/mcp-servers/:name/tools    │
└───────────────┬──────────────────────┘
                │ HTTP
                ▼
┌──────────────────────────────────────┐
│   Java MCP Gateway - Port 8000       │
│   /mcp/servers                        │
│   /mcp/list-tools?mcp_server=...     │
│   /mcp/server/:name/info              │
└──────────────────────────────────────┘
```

---

## ✅ What's Implemented

### **1. Java Gateway Client** (`internal/clients/java_gateway/client.go`)

HTTP client to communicate with the Java MCP Gateway:

**Methods:**
- `ListServers()` - Fetch all MCP servers
- `ListTools(serverName)` - Fetch tools for a server
- `GetServerInfo(serverName)` - Get detailed server info
- `HealthCheck()` - Check gateway availability

### **2. Gateway Proxy API** (`internal/api/gateway_proxy/handler.go`)

REST API that proxies requests to the Java gateway:

**Endpoints:**
- `GET /api/v1/mcp-servers` - List all MCP servers
- `GET /api/v1/mcp-servers/:name/tools` - Get server tools
- `GET /api/v1/mcp-servers/:name/info` - Get server info

---

## 🚀 Setup Instructions

### **Step 1: Update `cmd/server/main.go`**

Add the gateway proxy to the Policy Engine:

**Add import** (after line 13):
```go
gatewayProxy "github.com/datacline/policy-engine/internal/api/gateway_proxy"
"github.com/datacline/policy-engine/internal/clients/java_gateway"
```

**Initialize gateway client** (after line 53, before evaluation service):
```go
// Initialize Java gateway client
javaGatewayURL := os.Getenv("JAVA_GATEWAY_URL")
if javaGatewayURL == "" {
	javaGatewayURL = "http://localhost:8000" // Default
}
gatewayClient := java_gateway.NewClient(javaGatewayURL)

// Health check
if err := gatewayClient.HealthCheck(); err != nil {
	log.WithError(err).Warn("Java gateway not available")
} else {
	log.WithField("url", javaGatewayURL).Info("Java gateway connected")
}
```

**Register proxy routes** (after line 93, with other API routes):
```go
// Register gateway proxy endpoints
gatewayProxyHandler := gatewayProxy.NewHandler(gatewayClient)
gatewayProxyHandler.RegisterRoutes(api)
log.Info("Gateway proxy endpoints registered")
```

### **Step 2: Environment Configuration**

Create/update `.env` file in `policy-engine-go/`:

```bash
# Java Gateway URL
JAVA_GATEWAY_URL=http://localhost:8000

# Policy Engine Port
PORT=9000

# Policy Directory
POLICY_DIR=./policies
```

### **Step 3: Build and Run**

```bash
cd policy-engine-go
go mod tidy
make build
./bin/policy-engine
```

### **Step 4: Start Java Gateway**

Make sure the Java gateway is running:

```bash
cd server-java
./mvnw spring-boot:run
```

Or with Docker:

```bash
cd server-java
docker-compose up -d
```

### **Step 5: Verify Integration**

```bash
# Test Policy Engine proxy
curl http://localhost:9000/api/v1/mcp-servers

# Should return servers from Java gateway
```

---

## 📋 Java Gateway Endpoints Used

The Policy Engine uses these Java gateway endpoints:

### **1. List Servers**
```http
GET http://localhost:8000/mcp/servers
```

**Response:**
```json
{
  "servers": [
    {
      "name": "notion",
      "url": "http://host.docker.internal:8081/mcp",
      "type": "http",
      "enabled": true,
      "description": "Notion MCP server",
      "tags": ["notion", "productivity"]
    },
    {
      "name": "github",
      "url": "https://api.githubcopilot.com/mcp",
      "type": "http",
      "enabled": false,
      "description": "GitHub Copilot MCP"
    }
  ],
  "count": 2
}
```

### **2. List Tools**
```http
GET http://localhost:8000/mcp/list-tools?mcp_server=notion
```

**Response:**
```json
{
  "tools": [
    {
      "name": "search_workspace",
      "description": "Search across Notion workspace",
      "inputSchema": {...}
    }
  ]
}
```

### **3. Get Server Info**
```http
GET http://localhost:8000/mcp/server/notion/info
```

---

## 🎨 Frontend Integration

### **Step 1: Update API Service**

Add to `frontend/src/services/api.ts`:

```typescript
// MCP Server Management (proxied from Java gateway)
export const mcpServerApi = {
  // List all MCP servers
  list: async () => {
    const response = await api.get('/mcp-servers');
    return response.data;
  },

  // Get server tools
  getTools: async (serverName: string) => {
    const response = await api.get(`/mcp-servers/${serverName}/tools`);
    return response.data;
  },

  // Get server info
  getInfo: async (serverName: string) => {
    const response = await api.get(`/mcp-servers/${serverName}/info`);
    return response.data;
  },
};
```

### **Step 2: Create Type Definitions**

Add to `frontend/src/types/mcp.ts`:

```typescript
export interface MCPServer {
  name: string;
  url?: string;
  type?: string;
  enabled: boolean;
  description?: string;
  tags?: string[];
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface MCPServersResponse {
  servers: MCPServer[];
  count: number;
}
```

### **Step 3: Use in Components**

Example server selector:

```typescript
import { useEffect, useState } from 'react';
import { mcpServerApi } from '../services/api';

export default function ServerSelector({ onSelect }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await mcpServerApi.list();
      // Filter only enabled servers
      const enabledServers = data.servers.filter(s => s.enabled);
      setServers(enabledServers);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading servers...</div>;

  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      <option value="">Select MCP Server</option>
      {servers.map(server => (
        <option key={server.name} value={server.name}>
          {server.name} - {server.description}
        </option>
      ))}
    </select>
  );
}
```

---

## 🧪 Testing

### **Test 1: List Servers**

```bash
# Via Policy Engine
curl http://localhost:9000/api/v1/mcp-servers

# Directly from Java Gateway
curl http://localhost:8000/mcp/servers
```

Both should return the same data!

### **Test 2: Get Tools**

```bash
# Via Policy Engine
curl http://localhost:9000/api/v1/mcp-servers/notion/tools

# Directly from Java Gateway
curl http://localhost:8000/mcp/list-tools?mcp_server=notion
```

### **Test 3: Health Check**

```bash
# Check Java gateway health
curl http://localhost:8000/actuator/health

# Should return: {"status":"UP"}
```

---

## 🔄 Configuration Management

### **MCP Servers Configuration**

MCP servers are configured in the Java gateway:

**File:** `server-java/mcp_servers.yaml`

```yaml
servers:
  notion:
    url: http://host.docker.internal:8081/mcp
    type: http
    enabled: true
    description: "Notion MCP server"
    tags: ["notion", "productivity"]
    tools: ["*"]
    
  github:
    url: https://api.githubcopilot.com/mcp
    type: http
    enabled: false
    description: "GitHub Copilot MCP"
```

**To add a new MCP server:**
1. Edit `server-java/mcp_servers.yaml`
2. Restart Java gateway
3. Policy Engine will automatically see the new server

---

## 📊 Benefits of This Approach

### ✅ **Single Source of Truth**
- All MCP server configuration in one place (Java gateway)
- No duplication between services
- Consistent server list across all clients

### ✅ **Real-Time Updates**
- Policy Engine always has latest server list
- No need to sync configurations
- Dynamic server discovery

### ✅ **Simplified Management**
- Configure servers once in Java gateway
- Policy Engine automatically proxies
- Easy to add/remove/update servers

### ✅ **Better Integration**
- Policy Engine works with actual MCP servers
- Real tool lists from live servers
- Accurate server capabilities

---

## 🚨 Troubleshooting

### **Issue: Cannot Connect to Java Gateway**

**Error:** `Failed to fetch servers from gateway`

**Solutions:**

1. **Check Java gateway is running:**
   ```bash
   curl http://localhost:8000/actuator/health
   ```

2. **Verify JAVA_GATEWAY_URL:**
   ```bash
   echo $JAVA_GATEWAY_URL
   # Should be: http://localhost:8000
   ```

3. **Check network connectivity:**
   ```bash
   # If using Docker, use docker network
   docker network inspect bridge
   ```

4. **Update environment variable:**
   ```bash
   export JAVA_GATEWAY_URL=http://localhost:8000
   ./bin/policy-engine
   ```

### **Issue: Empty Server List**

**Error:** `{"servers":[],"count":0}`

**Solutions:**

1. **Check Java gateway servers endpoint:**
   ```bash
   curl http://localhost:8000/mcp/servers
   ```

2. **Verify `mcp_servers.yaml` exists:**
   ```bash
   ls -la server-java/mcp_servers.yaml
   ```

3. **Check server configuration:**
   - Ensure at least one server is `enabled: true`
   - Verify YAML syntax is correct

### **Issue: CORS Errors**

If frontend gets CORS errors:

1. Ensure CORS is enabled in Policy Engine (already done)
2. Check Java gateway allows requests from frontend

---

## 📝 Example: Create Policy for Notion Server

```bash
curl -X POST http://localhost:9000/api/v1/enhanced/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Allow Engineers Notion Access",
    "type": "server_level",
    "action": "allow",
    "priority": 100,
    "enabled": true,
    "applies_to": {
      "type": "group",
      "values": ["Engineering"]
    },
    "scope": {
      "type": "specific_tools",
      "server_ids": ["notion"],
      "tool_names": ["search_workspace", "read_page", "query_database"]
    }
  }'
```

---

## 🎯 Summary

✅ **Policy Engine now fetches MCP servers from Java Gateway**  
✅ **Single source of truth for server configuration**  
✅ **Real-time server discovery**  
✅ **Simplified management**  
✅ **Frontend can list servers and tools**  

**Just follow the 5 setup steps above and you're ready to go!** 🚀

---

## 📚 Related Documentation

- **Java Gateway API**: See `McpController.java`
- **MCP Server Config**: `server-java/mcp_servers.yaml`
- **Policy Engine Setup**: `IMPLEMENTATION_COMPLETE.md`
- **Enhanced Policies**: `RUNLAYER_IMPLEMENTATION.md`
