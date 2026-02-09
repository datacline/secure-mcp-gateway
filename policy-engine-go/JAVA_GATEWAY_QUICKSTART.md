# Java Gateway Integration - Quick Start

## ✅ What's Implemented

The Policy Engine now fetches MCP servers from the **Java Gateway** via HTTP proxy. All three entry points (combined, evaluation-only, management-only) have been updated.

---

## 🚀 Quick Start (3 Steps)

### **Step 1: Start Java Gateway**

```bash
# Terminal 1
cd server-java
./mvnw spring-boot:run
```

Wait for: `Started McpGatewayApplication`

**Verify Java Gateway:**
```bash
curl http://localhost:8000/actuator/health
# Should return: {"status":"UP"}

curl http://localhost:8000/mcp/servers
# Should return list of servers
```

---

### **Step 2: Build & Start Policy Engine**

```bash
# Terminal 2
cd policy-engine-go

# Build
make build

# Set environment variable (optional, defaults to http://localhost:8000)
export JAVA_GATEWAY_URL=http://localhost:8000

# Run combined service
./bin/policy-engine
```

**Or run specific services:**

```bash
# Evaluation-only (port 9001)
export PORT=9001
./bin/policy-evaluation

# Management-only (port 9002)
export PORT=9002
./bin/policy-management
```

---

### **Step 3: Test Integration**

```bash
# Terminal 3
cd policy-engine-go

# Run integration test
./test-java-gateway-integration.sh
```

**Or test manually:**

```bash
# List servers (via Policy Engine proxy)
curl http://localhost:9000/api/v1/mcp-servers

# Should return same servers as Java Gateway
```

---

## 📋 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JAVA_GATEWAY_URL` | `http://localhost:8000` | Java Gateway base URL |
| `PORT` | `9000` | Policy Engine port |
| `POLICY_DIR` | `./policies` | Policy storage directory |

---

## 🔍 What Was Changed

### **All Entry Points Updated:**

1. **`cmd/server/main.go`** (Combined Service)
   - Added Java gateway client initialization
   - Registered proxy endpoints
   - Health check on startup

2. **`cmd/evaluation/main.go`** (Evaluation-Only)
   - Added Java gateway client
   - Proxy endpoints available

3. **`cmd/management/main.go`** (Management-Only)
   - Added Java gateway client
   - Proxy endpoints available

### **New Components:**

1. **`internal/clients/java_gateway/client.go`**
   - HTTP client for Java gateway
   - Methods: `ListServers()`, `ListTools()`, `GetServerInfo()`, `HealthCheck()`

2. **`internal/api/gateway_proxy/handler.go`**
   - Proxy API endpoints
   - Routes: `/api/v1/mcp-servers`, `/api/v1/mcp-servers/:name/tools`, etc.

---

## 🎯 Available Endpoints

### **Policy Engine Proxy Endpoints:**

```bash
# List all MCP servers
GET http://localhost:9000/api/v1/mcp-servers

# Get tools for a specific server
GET http://localhost:9000/api/v1/mcp-servers/:name/tools

# Get server info
GET http://localhost:9000/api/v1/mcp-servers/:name/info
```

### **Example: List Servers**

```bash
curl http://localhost:9000/api/v1/mcp-servers
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
    }
  ],
  "count": 1
}
```

### **Example: Get Server Tools**

```bash
curl http://localhost:9000/api/v1/mcp-servers/notion/tools
```

**Response:**
```json
{
  "server": "notion",
  "tools": [
    {
      "name": "search_workspace",
      "description": "Search across Notion workspace"
    }
  ],
  "count": 1
}
```

---

## 🧪 Testing

### **Automated Test:**

```bash
cd policy-engine-go
./test-java-gateway-integration.sh
```

**Tests:**
- ✓ Java Gateway health
- ✓ Policy Engine health
- ✓ Fetch servers from Java Gateway
- ✓ Fetch servers via Policy Engine proxy
- ✓ Compare results
- ✓ Fetch tools for a server

### **Manual Tests:**

```bash
# Test 1: Java Gateway direct
curl http://localhost:8000/mcp/servers

# Test 2: Policy Engine proxy
curl http://localhost:9000/api/v1/mcp-servers

# Test 3: Get tools
curl http://localhost:9000/api/v1/mcp-servers/notion/tools

# Test 4: Health check
curl http://localhost:9000/health
```

---

## 🔧 Troubleshooting

### **Issue: "Java gateway not available"**

**Symptom:**
```
WARN Java gateway not available
```

**Solutions:**

1. **Check Java Gateway is running:**
   ```bash
   curl http://localhost:8000/actuator/health
   ```

2. **Verify port:**
   ```bash
   # Check what's running on 8000
   lsof -i :8000
   ```

3. **Set correct URL:**
   ```bash
   export JAVA_GATEWAY_URL=http://localhost:8000
   ./bin/policy-engine
   ```

### **Issue: Empty Server List**

**Symptom:**
```json
{"servers":[],"count":0}
```

**Solutions:**

1. **Check Java Gateway servers:**
   ```bash
   curl http://localhost:8000/mcp/servers
   ```

2. **Verify `mcp_servers.yaml`:**
   ```bash
   cat server-java/mcp_servers.yaml
   ```

3. **Ensure at least one server is enabled:**
   ```yaml
   servers:
     notion:
       enabled: true  # Must be true
   ```

### **Issue: CORS Errors**

**Symptom:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
CORS is already configured in all entry points. If you still get errors, check:

1. Frontend is on allowed origin (localhost:3000, 3001, or 127.0.0.1:3000)
2. Restart Policy Engine after code changes

---

## 🏗️ Architecture

```
┌──────────────────┐
│    Frontend      │
│   Port: 3000     │
└────────┬─────────┘
         │ HTTP
         ▼
┌──────────────────┐
│  Policy Engine   │
│   Port: 9000     │
│                  │
│  Proxy Endpoints │ ← New!
│  - /mcp-servers  │
│  - /mcp-servers/ │
│    :name/tools   │
└────────┬─────────┘
         │ HTTP
         ▼
┌──────────────────┐
│  Java Gateway    │
│   Port: 8000     │
│                  │
│  /mcp/servers    │ ← Source of Truth
│  /mcp/list-tools │
│  /mcp/server/    │
│    :name/info    │
└──────────────────┘
```

---

## 💡 Key Features

### ✅ **Single Source of Truth**
- All MCP servers configured in `server-java/mcp_servers.yaml`
- No duplication between services
- Policy Engine always has latest server list

### ✅ **Real-Time Updates**
- Changes to `mcp_servers.yaml` reflected immediately
- No need to restart Policy Engine
- Dynamic server discovery

### ✅ **Health Checks**
- Policy Engine checks Java Gateway on startup
- Warns if gateway is unavailable
- Continues to function (other endpoints still work)

### ✅ **All Deployment Modes**
- Combined service (evaluation + management)
- Evaluation-only service
- Management-only service
- All can proxy to Java Gateway

---

## 📝 Next Steps

1. **Start both services** (Java Gateway + Policy Engine)
2. **Run integration test** to verify
3. **Update frontend** to use proxy endpoints
4. **Create policies** based on discovered MCP servers

---

## 📚 Related Documentation

- **Detailed Integration Guide**: `/JAVA_GATEWAY_INTEGRATION.md`
- **Changes Summary**: `CHANGES_SUMMARY.md`
- **Enhanced Policies**: `RUNLAYER_IMPLEMENTATION.md`
- **Architecture**: `ARCHITECTURE.md`

---

## ✨ Summary

✅ **Policy Engine now fetches MCP servers from Java Gateway**  
✅ **All 3 entry points updated (combined, eval, mgmt)**  
✅ **Health checks on startup**  
✅ **CORS configured for frontend**  
✅ **Integration test provided**  

**Just start both services and you're ready to go!** 🚀
