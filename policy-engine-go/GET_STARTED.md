# Get Started in 3 Minutes! 🚀

## ✅ What's Done

Java Gateway integration is **100% complete**. The Policy Engine now fetches MCP servers from your Java Gateway.

---

## 🏃 Quick Start

### **Step 1: Start Java Gateway** (Terminal 1)

```bash
cd server-java
./mvnw spring-boot:run
```

Wait for: `Started McpGatewayApplication in X seconds`

### **Step 2: Start Policy Engine** (Terminal 2)

```bash
cd policy-engine-go

# Build
make build

# Run
export JAVA_GATEWAY_URL=http://localhost:8000
./bin/policy-engine
```

Wait for: `Policy Engine ready`

### **Step 3: Test** (Terminal 3)

```bash
cd policy-engine-go
./test-java-gateway-integration.sh
```

**Expected output:**
```
✓ Java Gateway is running
✓ Policy Engine is running
✓ Server counts match
✓ Integration test PASSED!
```

---

## 🎯 What You Can Do Now

### **1. List MCP Servers**

```bash
curl http://localhost:9000/api/v1/mcp-servers
```

### **2. Get Server Tools**

```bash
curl http://localhost:9000/api/v1/mcp-servers/notion/tools
```

### **3. Use in Frontend**

```typescript
import { mcpServerApi } from './services/api';

// List servers
const { servers } = await mcpServerApi.list();

// Get tools
const { tools } = await mcpServerApi.getTools('notion');
```

---

## 📋 Environment Variables

```bash
# Required: Java Gateway URL (default: http://localhost:8000)
export JAVA_GATEWAY_URL=http://localhost:8000

# Optional: Policy Engine port (default: 9000)
export PORT=9000

# Optional: Policy directory (default: ./policies)
export POLICY_DIR=./policies
```

---

## 🔍 Troubleshooting

### **"Java gateway not available"**

1. Check Java Gateway is running:
   ```bash
   curl http://localhost:8000/actuator/health
   ```

2. If not, start it:
   ```bash
   cd server-java && ./mvnw spring-boot:run
   ```

### **Empty server list**

1. Check Java Gateway has servers:
   ```bash
   curl http://localhost:8000/mcp/servers
   ```

2. Verify `mcp_servers.yaml`:
   ```bash
   cat server-java/mcp_servers.yaml
   ```

---

## 📚 Documentation

- **Quick Start**: `JAVA_GATEWAY_QUICKSTART.md`
- **Detailed Guide**: `/JAVA_GATEWAY_INTEGRATION.md`
- **Implementation Status**: `/IMPLEMENTATION_STATUS.md`

---

## ✨ That's It!

You're ready to:
1. Discover MCP servers from Java Gateway
2. Create policies based on those servers
3. Build frontend UI with server/tool selection

**Happy coding!** 🎉
