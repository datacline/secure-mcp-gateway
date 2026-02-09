# MCP Server Integration Guide

## Overview

This guide shows how to integrate MCP server discovery and management into the Policy Engine, enabling Runlayer-style per-server policy configuration.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         Frontend (React)             │
│  - Server List                       │
│  - Policy Creator per Server         │
│  - Tool Selector with Search         │
└──────────────┬──────────────────────┘
               │ HTTP
               ▼
┌─────────────────────────────────────┐
│      MCP Server API                  │
│  /api/v1/mcp-servers                 │
│  /api/v1/mcp-servers/:id/tools       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      MCP Registry                    │
│  - Load from YAML files              │
│  - Discover from Java Gateway        │
│  - Cache in memory                   │
└─────────────────────────────────────┘
```

---

## 📋 Backend Setup

### Step 1: Update `go.mod` (Already has needed dependencies)

No new dependencies needed! Uses existing:
- `gopkg.in/yaml.v3` for YAML parsing
- `github.com/gin-gonic/gin` for API

### Step 2: Update `cmd/server/main.go`

Add MCP server registry initialization:

**Add imports** (after line 13):
```go
mcpServers "github.com/datacline/policy-engine/internal/api/mcp_servers"
"github.com/datacline/policy-engine/internal/services/mcp_registry"
```

**Add registry setup** (after line 53, before evaluation service):
```go
// Initialize MCP server registry
mcpRegistry := mcp_registry.NewRegistry()

// Load MCP servers from directory
mcpServersDir := cfg.PolicyDir + "/../mcp-servers"
if err := mcpRegistry.LoadFromDirectory(mcpServersDir); err != nil {
	log.WithError(err).Warn("Failed to load MCP servers from directory")
	// Try loading from single file as fallback
	mcpServersFile := cfg.PolicyDir + "/../mcp_servers.yaml"
	if err := mcpRegistry.LoadFromFile(mcpServersFile); err != nil {
		log.WithError(err).Warn("No MCP servers loaded")
	}
}

log.WithField("servers", len(mcpRegistry.ListServers())).Info("MCP servers initialized")
```

**Register MCP server routes** (after line 93, with other API routes):
```go
// Register MCP server endpoints
mcpHandler := mcpServers.NewHandler(mcpRegistry)
mcpHandler.RegisterRoutes(api)
log.Info("MCP server endpoints registered")
```

### Step 3: Build and Run

```bash
cd policy-engine-go
go mod tidy
make build
./bin/policy-engine
```

### Step 4: Verify MCP Server API

```bash
# List all MCP servers
curl http://localhost:9000/api/v1/mcp-servers

# Get GitHub server details
curl http://localhost:9000/api/v1/mcp-servers/github-mcp

# Get GitHub tools
curl http://localhost:9000/api/v1/mcp-servers/github-mcp/tools

# Search tools
curl 'http://localhost:9000/api/v1/mcp-servers/tools/search?q=list'
```

---

## 📦 Sample MCP Servers Created

Four sample MCP server definitions have been created:

### 1. GitHub MCP
**File**: `mcp-servers/github-mcp.yaml`
- 14 tools (branches, commits, issues, PRs, etc.)
- Categorized: Repository, Security, Issues, Pull Requests
- Ready for GitHub integration

### 2. Database MCP
**File**: `mcp-servers/database-mcp.yaml`
- 9 tools (query, insert, update, delete, etc.)
- Categorized: Schema, Query, DDL, DML
- SQL operations

### 3. Gmail MCP
**File**: `mcp-servers/gmail-mcp.yaml`
- 10 tools (send, read, search, labels, etc.)
- Categorized: Messages, Send, Drafts, Labels
- Email management

### 4. Notion MCP
**File**: `mcp-servers/notion-mcp.yaml`
- 8 tools (databases, pages, blocks, search)
- Categorized: Databases, Pages, Blocks, Search
- Notion workspace management

---

## 🎨 Frontend Integration

### Step 1: Update API Client

Add to `frontend/src/services/api.ts`:

```typescript
// MCP Server Management
export const mcpServerApi = {
  // List all MCP servers
  list: async () => {
    const response = await api.get('/mcp-servers');
    return response.data;
  },

  // Get server details
  get: async (id: string) => {
    const response = await api.get(`/mcp-servers/${id}`);
    return response.data;
  },

  // Get server tools
  getTools: async (id: string) => {
    const response = await api.get(`/mcp-servers/${id}/tools`);
    return response.data;
  },

  // Search tools
  searchTools: async (query: string) => {
    const response = await api.get(`/mcp-servers/tools/search?q=${query}`);
    return response.data;
  },
};
```

### Step 2: Create Types

Add to `frontend/src/types/mcp.ts`:

```typescript
export interface MCPTool {
  name: string;
  description?: string;
  category?: string;
  input_schema?: Record<string, any>;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  status: string;
  type?: string;
  url?: string;
  tools: MCPTool[];
  resources?: string[];
  created_at: string;
  updated_at: string;
}

export interface MCPServerListResponse {
  servers: MCPServer[];
  count: number;
}
```

### Step 3: Create Server Selector Component

Create `frontend/src/components/ServerSelector.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { mcpServerApi } from '../services/api';
import { MCPServer } from '../types/mcp';

interface ServerSelectorProps {
  selectedServer?: string;
  onSelect: (serverId: string) => void;
}

export default function ServerSelector({ 
  selectedServer, 
  onSelect 
}: ServerSelectorProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await mcpServerApi.list();
      setServers(data.servers);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading servers...</div>;

  return (
    <select 
      value={selectedServer} 
      onChange={(e) => onSelect(e.target.value)}
      className="server-selector"
    >
      <option value="">Select MCP Server</option>
      {servers.map(server => (
        <option key={server.id} value={server.id}>
          {server.name}
        </option>
      ))}
    </select>
  );
}
```

---

## 🎯 Enhanced Policy Creation Flow

### New Policy Creation Process

1. **Select MCP Server** - Choose which server to configure
2. **Choose Subject** - User/Group/Role tabs
3. **Select Scope** - Entire Server vs Specific Tools
4. **Pick Tools** (if Specific Tools selected)
   - Searchable list
   - Grouped by category
   - Multi-select with checkboxes
5. **Add Conditions** (optional)
   - Metadata-based rules
   - Tool argument validation
6. **Set Priority & Action**
7. **Save Policy**

---

## 📝 Example Usage

### Create Policy for GitHub Server

```bash
curl -X POST http://localhost:9000/api/v1/enhanced/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineers GitHub Read Access",
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
      "server_ids": ["github-mcp"],
      "tool_names": [
        "list_repositories",
        "list_branches",
        "list_commits",
        "list_issues",
        "list_pull_requests"
      ]
    }
  }'
```

### Test Evaluation

```bash
curl -X POST http://localhost:9000/api/v1/enhanced/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "subject": {
        "email": "engineer@company.com",
        "groups": ["Engineering"]
      },
      "server": {
        "name": "github-mcp"
      },
      "tool": {
        "name": "list_repositories",
        "arguments": {}
      },
      "request": {
        "ip": "192.168.1.100"
      }
    }
  }'
```

---

## 🔄 Integration with Java Gateway

To automatically discover MCP servers from your Java Gateway:

### Option 1: Periodic Sync

Add to `cmd/server/main.go`:

```go
// Start periodic MCP server discovery
go func() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		javaGatewayURL := os.Getenv("JAVA_GATEWAY_URL")
		if javaGatewayURL != "" {
			if err := mcpRegistry.DiscoverFromJavaGateway(javaGatewayURL); err != nil {
				log.WithError(err).Warn("Failed to discover from Java gateway")
			} else {
				log.Info("MCP servers synced from Java gateway")
			}
		}
	}
}()
```

### Option 2: Java Gateway Push

Have your Java Gateway POST new servers to the Policy Engine:

```java
// In Java Gateway
public void registerWithPolicyEngine(MCPServer server) {
    String policyEngineURL = System.getenv("POLICY_ENGINE_URL");
    
    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(policyEngineURL + "/api/v1/mcp-servers"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(toJson(server)))
        .build();
    
    client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
}
```

---

## 🧪 Testing

### Test 1: List Servers

```bash
curl http://localhost:9000/api/v1/mcp-servers
```

**Expected**:
```json
{
  "servers": [
    {
      "id": "github-mcp",
      "name": "GitHub",
      "status": "active",
      "tools": [...]
    },
    {
      "id": "database-mcp",
      "name": "Database",
      "status": "active",
      "tools": [...]
    }
  ],
  "count": 4
}
```

### Test 2: Get Server Tools

```bash
curl http://localhost:9000/api/v1/mcp-servers/github-mcp/tools
```

### Test 3: Search Tools

```bash
curl 'http://localhost:9000/api/v1/mcp-servers/tools/search?q=list'
```

---

## 📊 Next Steps

1. ✅ **Backend Complete** - MCP server registry & API
2. ✅ **Sample Servers** - 4 example MCP servers defined
3. ⏳ **Integration** - Add to `cmd/server/main.go`
4. ⏳ **Frontend UI** - Runlayer-style policy creator
5. ⏳ **Tool Selector** - Searchable, grouped tool picker
6. ⏳ **Java Gateway Sync** - Auto-discover servers

---

## 🚀 Quick Start

1. Follow **Backend Setup** steps above
2. Start Policy Engine: `./bin/policy-engine`
3. Verify: `curl http://localhost:9000/api/v1/mcp-servers`
4. Create policies per server using enhanced API
5. Frontend will automatically show server selector

---

**Ready to configure policies per MCP server!** 🎉
