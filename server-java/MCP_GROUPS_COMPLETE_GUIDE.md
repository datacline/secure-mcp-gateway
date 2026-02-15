# MCP Groups - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Policy Integration](#policy-integration)
4. [Tool Filtering Workflow](#tool-filtering-workflow)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What are MCP Groups?

MCP Groups allow you to organize multiple MCP servers into logical collections that act as a unified sub-gateway. Each group provides a single MCP-compliant HTTP endpoint that aggregates tools, resources, and prompts from all member servers.

### Key Benefits

- **Unified Access**: Single endpoint for multiple MCP servers
- **Role-Based Organization**: Create groups for different teams/projects
- **Policy Enforcement**: Automatic policy-aware tool filtering
- **Granular Control**: Per-server tool configuration within groups
- **Security**: Policy restrictions always take precedence

### Example Use Cases

```
Engineering Team Group
├─ GitHub MCP (issue management, PRs)
├─ Slack MCP (team communication)
└─ Jira MCP (sprint planning)
  → Endpoint: http://localhost:8000/mcp/group/1/mcp

Sales Team Group
├─ Notion MCP (CRM, notes)
├─ Gmail MCP (email)
└─ Calendar MCP (scheduling)
  → Endpoint: http://localhost:8000/mcp/group/2/mcp

DevOps Group
├─ AWS MCP (infrastructure)
├─ Datadog MCP (monitoring)
└─ GitHub MCP (deployments only)
  → Endpoint: http://localhost:8000/mcp/group/3/mcp
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Secure MCP Gateway (Port 8000)              │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Policy   │  │    Group    │  │  PolicyAware    │  │
│  │   Engine   │  │   Service   │  │  ToolService    │  │
│  └────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐  ┌──────▼─────────┐  ┌───▼──────────┐
│  Group 1       │  │  Group 2       │  │  Group 3     │
│ /mcp/group/1/  │  │ /mcp/group/2/  │  │ /mcp/group/3/│
│      mcp       │  │      mcp       │  │      mcp     │
└────────────────┘  └────────────────┘  └──────────────┘
       │                   │                   │
   ┌───┴────┐         ┌────┴────┐         ┌───┴────┐
   │ GitHub │         │ Notion  │         │  AWS   │
   │ Slack  │         │ Gmail   │         │Datadog │
   │ Jira   │         │Calendar │         │        │
   └────────┘         └─────────┘         └────────┘
```

### Components

#### 1. Database Layer

**Table: `mcp_server_groups`**

```sql
CREATE TABLE mcp_server_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    server_names TEXT,              -- JSON array of server names
    tool_config TEXT,                -- JSON object: { serverName: [tools] }
    gateway_url VARCHAR(1024),       -- Auto-generated endpoint URL
    gateway_port INTEGER,            -- Gateway port (default: 8000)
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

**Key Fields:**
- `server_names`: JSON array `["github", "slack", "jira"]`
- `tool_config`: JSON object defining which tools are exposed per server
  ```json
  {
    "github": ["create_issue", "list_repos"],
    "slack": ["*"],
    "jira": null
  }
  ```
- `gateway_url`: Auto-generated as `http://{host}:{port}/mcp/group/{id}/mcp`

#### 2. Entity Layer

**File**: `entity/McpServerGroupEntity.java`

```java
@Entity
@Table(name = "mcp_server_groups")
public class McpServerGroupEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String description;

    @Column(name = "server_names", columnDefinition = "TEXT")
    private String serverNamesJson;  // Stored as JSON

    @Column(name = "tool_config", columnDefinition = "TEXT")
    private String toolConfigJson;    // Stored as JSON

    private String gatewayUrl;
    private Integer gatewayPort;
    private Boolean enabled;

    // Helper methods
    public List<String> getServerNamesList() { ... }
    public void setServerNamesList(List<String> names) { ... }
    public Map<String, List<String>> getToolConfig() { ... }
    public void setToolConfig(Map<String, List<String>> config) { ... }
}
```

#### 3. Service Layer

**File**: `service/McpGroupService.java`

Handles CRUD operations and validation:

```java
@Service
public class McpGroupService {
    // Group Management
    public List<Map<String, Object>> getAllGroups();
    public Map<String, Object> getGroup(String groupId);
    public Map<String, Object> createGroup(Map<String, Object> groupData);
    public Map<String, Object> updateGroup(String groupId, Map<String, Object> updates);
    public void deleteGroup(String groupId);

    // Server Management
    public Map<String, Object> addServerToGroup(String groupId, String serverName);
    public Map<String, Object> removeServerFromGroup(String groupId, String serverName);

    // Tool Configuration
    public Map<String, Object> configureServerTools(String groupId,
                                                     String serverName,
                                                     List<String> tools);
}
```

**File**: `service/PolicyAwareToolService.java`

Handles policy-aware tool filtering:

```java
@Service
public class PolicyAwareToolService {
    /**
     * Get tools allowed by policy for a server
     */
    public Mono<List<String>> getPolicyAllowedTools(String serverName, String username);

    /**
     * Apply both policy AND group filtering
     * Formula: Available = Server Tools ∩ Policy-Allowed ∩ Group-Configured
     */
    public Mono<List<Map<String, Object>>> getAvailableTools(
        String serverName,
        String username,
        List<String> groupConfiguredTools
    );
}
```

#### 4. Controller Layer

**File**: `controller/McpController.java`

Exposes REST APIs for group management and MCP protocol endpoints.

---

## Policy Integration

### The Challenge

There are **two independent mechanisms** for restricting tool access:

1. **Policy-Level Restrictions** (via Policy Engine)
   - Authoritative security layer
   - Defines which tools users can access
   - Example: User can only access read-only GitHub tools

2. **Group-Level Configuration** (via MCP Groups)
   - Convenience/UX layer
   - Reduces clutter by exposing only relevant tools
   - Example: Engineering group only shows code-related tools

### The Solution: Policy Precedence

**Principle**: **Policy restrictions take absolute precedence** over group configurations.

```
┌─────────────────────────────────────────────────────┐
│         Tool Availability Decision Flow              │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  MCP Server Has       │
           │  100 Tools            │
           └───────────┬───────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  Policy Filtering     │
           │  (AUTHORITATIVE)      │
           │  → 10 tools allowed   │
           └───────────┬───────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  Group Filtering      │
           │  (OPTIONAL)           │
           │  → 5 tools configured │
           └───────────┬───────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  FINAL: 5 tools       │
           │  (intersection)       │
           └───────────────────────┘
```

### Filtering Formula

```
Available Tools = Server Tools ∩ Policy-Allowed Tools ∩ Group-Configured Tools
```

**Where:**
- `Server Tools`: All tools the MCP server provides
- `Policy-Allowed Tools`: Tools allowed by active policies for the user
- `Group-Configured Tools`: Tools configured in the group's `tool_config`

### Example Scenarios

#### Scenario 1: Policy More Restrictive

```
Server has:     [tool1, tool2, tool3, tool4, tool5]
Policy allows:  [tool1, tool2, tool3]
Group config:   [tool1, tool2, tool3, tool4]

Result:         [tool1, tool2, tool3]  ← Policy wins
```

#### Scenario 2: Group More Restrictive

```
Server has:     [tool1, tool2, tool3, tool4, tool5]
Policy allows:  [tool1, tool2, tool3, tool4]
Group config:   [tool1, tool2]

Result:         [tool1, tool2]  ← Group config wins
```

#### Scenario 3: No Overlap (Misconfiguration)

```
Server has:     [tool1, tool2, tool3]
Policy allows:  [tool1, tool2]
Group config:   [tool3, tool4]

Result:         []  ← Empty! User sees warning
```

#### Scenario 4: No Group Configuration

```
Server has:     [tool1, tool2, tool3]
Policy allows:  [tool1, tool2]
Group config:   null or []

Result:         [tool1, tool2]  ← Policy applies, no group filtering
```

---

## Tool Filtering Workflow

### 1. User Opens Tool Configuration Dialog

**Frontend**: `MCPServers.tsx`

```typescript
const openToolConfigDialog = async (groupId, serverName, group) => {
  // Fetch policy-allowed tools (not all tools)
  const response = await javaGatewayMcpApi.getPolicyAllowedTools(serverName);

  const toolNames = response.tools.map(tool => tool.name);
  setAvailableTools(toolNames);
  setPolicyFilteredTools(response.policy_filtered);
  setTotalServerTools(response.total_server_tools);

  // Check for invalid configured tools
  const currentTools = group.tool_config?.[serverName] || [];
  const invalidTools = currentTools.filter(tool => !toolNames.includes(tool));

  if (invalidTools.length > 0) {
    setInvalidToolsWarning(invalidTools);  // Show warning
  }

  // Only show valid tools
  const validSelectedTools = currentTools.filter(tool => toolNames.includes(tool));
  setSelectedTools(validSelectedTools);
};
```

**UI Indicators:**

- ✅ **Blue Info Banner**: "Policy Filtering Active: Showing 8 of 22 tools"
- ⚠️ **Red Warning Banner**: "The following tools are not allowed by policy: [delete_repo, force_push]"
- 📝 **Description**: "Only tools allowed by your policies are shown"

### 2. Backend Fetches Policy-Allowed Tools

**Endpoint**: `GET /mcp/servers/{serverName}/policy-allowed-tools`

**Controller**: `McpController.java`

```java
@GetMapping("/servers/{serverName}/policy-allowed-tools")
public Mono<ResponseEntity<Map<String, Object>>> getPolicyAllowedTools(
        @PathVariable String serverName) {

    String username = authService.getUsername();

    return policyAwareToolService.getPolicyAllowedTools(serverName, username)
        .flatMap(allowedToolNames -> {
            return mcpProxyService.listTools(serverName, username)
                .map(result -> {
                    List<Map<String, Object>> allTools = result.get("tools");

                    // Filter to only policy-allowed tools
                    List<Map<String, Object>> allowedTools = allTools.stream()
                        .filter(tool -> allowedToolNames.contains(tool.get("name")))
                        .collect(Collectors.toList());

                    return ResponseEntity.ok(Map.of(
                        "server_name", serverName,
                        "username", username,
                        "tools", allowedTools,
                        "count", allowedTools.size(),
                        "total_server_tools", allTools.size(),
                        "policy_filtered", true
                    ));
                });
        });
}
```

### 3. Policy Engine Returns Unified Policy

**Policy Engine**: `GET /api/v1/unified/resources/mcp_server/{serverName}/policies`

**Response Example**:

```json
{
  "count": 1,
  "policies": [
    {
      "policy_id": "abc123",
      "status": "active",
      "policy_rules": [
        {
          "actions": [{"type": "allow"}]
        }
      ],
      "resources": [
        {"resource_type": "mcp_server", "resource_id": "github"},
        {"resource_type": "tool", "resource_id": "github:create_issue"},
        {"resource_type": "tool", "resource_id": "github:list_repos"},
        {"resource_type": "tool", "resource_id": "github:get_pr"}
      ]
    }
  ]
}
```

### 4. Extract Tools from Unified Policy

**Service**: `PolicyAwareToolService.java`

```java
// Extract tool resources from policy
for (Map<String, Object> resource : resources) {
    String resourceType = resource.get("resource_type");
    String resourceId = resource.get("resource_id");

    if ("tool".equals(resourceType) && resourceId != null) {
        // Resource ID format: "serverName:toolName"
        String[] parts = resourceId.split(":", 2);
        if (parts.length == 2 && serverName.equals(parts[0])) {
            String toolName = parts[1];
            policyAllowedTools.add(toolName);
        }
    }
}
```

**Result**: `["create_issue", "list_repos", "get_pr"]`

### 5. Client Requests Tools via Group Gateway

**Request**: `POST /mcp/group/3/mcp`

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**Controller**: `McpController.handleGroupListTools()`

```java
// Get group configuration
Map<String, Object> group = mcpGroupService.getGroup(groupId);
List<String> serverNames = group.get("serverNames");
Map<String, List<String>> toolConfig = group.get("tool_config");

// For each server in the group
return Flux.fromIterable(serverNames)
    .flatMap(serverName -> {
        List<String> groupConfiguredTools = toolConfig.get(serverName);

        // Apply policy + group filtering
        return policyAwareToolService.getAvailableTools(
            serverName,
            username,
            groupConfiguredTools
        );
    })
    .collectList()
    .map(toolLists -> {
        // Aggregate all tools from all servers
        List<Map<String, Object>> allTools = toolLists.stream()
            .flatMap(List::stream)
            .collect(Collectors.toList());

        return Map.of("tools", allTools);
    });
```

### 6. Apply Intersection Filter

**Service**: `PolicyAwareToolService.getAvailableTools()`

```java
List<Map<String, Object>> filteredTools = allTools.stream()
    .filter(tool -> {
        String toolName = tool.get("name");

        // 1. Must be allowed by policy
        boolean allowedByPolicy = policyAllowedTools.contains(toolName);

        // 2. Must be in group config (if configured)
        boolean allowedByGroup = groupConfiguredTools == null
            || groupConfiguredTools.isEmpty()
            || groupConfiguredTools.contains("*")
            || groupConfiguredTools.contains(toolName);

        // Intersection: BOTH must be true
        return allowedByPolicy && allowedByGroup;
    })
    .collect(Collectors.toList());
```

**Result**: Only tools that satisfy **both** policy and group requirements

---

## API Reference

### Group Management APIs

#### List All Groups

```http
GET /mcp/groups
```

**Response**:
```json
{
  "groups": [
    {
      "id": "1",
      "name": "Engineering Team",
      "description": "Tools for software development",
      "serverNames": ["github", "slack", "jira"],
      "server_count": 3,
      "gateway_url": "http://localhost:8000/mcp/group/1/mcp",
      "gateway_port": 8000,
      "enabled": true,
      "created_at": "2026-02-14T10:00:00Z",
      "updated_at": "2026-02-14T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### Get Group by ID

```http
GET /mcp/groups/{groupId}
```

**Response**:
```json
{
  "id": "1",
  "name": "Engineering Team",
  "description": "Tools for software development",
  "serverNames": ["github", "slack", "jira"],
  "tool_config": {
    "github": ["create_issue", "list_repos"],
    "slack": ["*"],
    "jira": null
  },
  "server_count": 3,
  "gateway_url": "http://localhost:8000/mcp/group/1/mcp",
  "gateway_port": 8000,
  "enabled": true,
  "created_at": "2026-02-14T10:00:00Z",
  "updated_at": "2026-02-14T10:00:00Z"
}
```

#### Create Group

```http
POST /mcp/groups
Content-Type: application/json

{
  "name": "Engineering Team",
  "description": "Tools for software development",
  "serverNames": ["github", "slack"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Group created successfully",
  "group": { ... }
}
```

**Validation Rules**:
- ✅ Name must be unique
- ✅ Name can only contain alphanumeric, spaces, hyphens, underscores
- ✅ All servers must be HTTP type (STDIO not allowed)

#### Update Group

```http
PUT /mcp/groups/{groupId}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "serverNames": ["github", "slack", "jira"]
}
```

#### Delete Group

```http
DELETE /mcp/groups/{groupId}
```

**Response**:
```json
{
  "success": true,
  "message": "Group deleted successfully"
}
```

### Server Management APIs

#### Add Server to Group

```http
POST /mcp/groups/{groupId}/servers/{serverName}
```

**Response**:
```json
{
  "success": true,
  "message": "Server added to group",
  "group": { ... }
}
```

#### Remove Server from Group

```http
DELETE /mcp/groups/{groupId}/servers/{serverName}
```

#### Add Multiple Servers

```http
POST /mcp/groups/{groupId}/servers
Content-Type: application/json

{
  "serverNames": ["github", "slack", "jira"]
}
```

### Tool Configuration APIs

#### Configure Tools for Server in Group

```http
PUT /mcp/groups/{groupId}/servers/{serverName}/tools
Content-Type: application/json

{
  "tools": ["create_issue", "list_repos", "get_pr"]
}
```

**Special Values**:
- `["*"]`: Allow all tools (subject to policy)
- `[]` or `null`: Allow all tools (subject to policy)

**Response**:
```json
{
  "success": true,
  "message": "Tool configuration updated",
  "group": { ... }
}
```

#### Get Policy-Allowed Tools

```http
GET /mcp/servers/{serverName}/policy-allowed-tools
```

**Response**:
```json
{
  "server_name": "github",
  "username": "testuser",
  "tools": [
    {"name": "create_issue", "description": "...", "inputSchema": {...}},
    {"name": "list_repos", "description": "...", "inputSchema": {...}}
  ],
  "count": 2,
  "total_server_tools": 10,
  "policy_filtered": true
}
```

### Group Gateway MCP Protocol Endpoints

#### Discovery Endpoint

```http
GET /mcp/group/{groupId}/mcp
```

**Response**: HTML page with MCP server info and connection instructions

#### MCP Protocol Endpoint

```http
POST /mcp/group/{groupId}/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

**Supported Methods**:
- `initialize`: Initialize connection
- `tools/list`: List all tools from group servers
- `tools/call`: Invoke a tool
- `resources/list`: List resources
- `resources/read`: Read a resource
- `prompts/list`: List prompts
- `prompts/get`: Get a prompt

---

## Usage Examples

### Example 1: Create Engineering Group

```bash
# 1. Create the group
curl -X POST http://localhost:8000/mcp/groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering Team",
    "description": "Development tools",
    "serverNames": ["github", "slack"]
  }'

# Response includes gateway_url: http://localhost:8000/mcp/group/1/mcp
```

### Example 2: Configure Tools for GitHub

```bash
# Only expose specific GitHub tools
curl -X PUT http://localhost:8000/mcp/groups/1/servers/github/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tools": ["create_issue", "list_repos", "get_pr"]
  }'
```

### Example 3: Use Group in VS Code

**VS Code MCP Settings**:

```json
{
  "mcpServers": {
    "engineering-gateway": {
      "url": "http://localhost:8000/mcp/group/1/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

### Example 4: List Tools from Group

```bash
curl -X POST http://localhost:8000/mcp/group/1/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'

# Response: Aggregated tools from github + slack (policy-filtered)
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {"name": "create_issue", ...},
      {"name": "list_repos", ...},
      {"name": "send_message", ...}
    ]
  },
  "id": 1
}
```

### Example 5: Policy Filtering in Action

**Scenario**: GitHub server has 50 tools, policy allows 10, group configures 5

```bash
# 1. Check what policy allows
curl http://localhost:8000/mcp/servers/github/policy-allowed-tools
# Returns: 10 tools

# 2. Configure group with 5 tools (all within policy)
curl -X PUT http://localhost:8000/mcp/groups/1/servers/github/tools \
  -d '{"tools": ["create_issue", "list_repos", "get_pr", "close_issue", "add_comment"]}'

# 3. List tools via group
curl -X POST http://localhost:8000/mcp/group/1/mcp \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Returns: 5 tools (intersection of policy + group config)
```

---

## Configuration

### Environment Variables

```yaml
# Gateway Configuration
POLICY_ENGINE_URL: http://host.docker.internal:9000

# Database
SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mcp_gateway
SPRING_DATASOURCE_USERNAME: mcp_user
SPRING_DATASOURCE_PASSWORD: mcp_password

# Server
SERVER_PORT: 8000
GATEWAY_HOST: localhost
```

### Docker Compose

```yaml
services:
  mcp-gateway-java:
    environment:
      POLICY_ENGINE_URL: http://host.docker.internal:9000
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mcp_gateway
      SERVER_PORT: 8000
    ports:
      - "8000:8000"
```

### Application Properties

```yaml
gateway:
  host: ${GATEWAY_HOST:localhost}
  policy-engine-url: ${POLICY_ENGINE_URL:http://localhost:9000}
```

---

## Troubleshooting

### Issue 1: Group Shows All Tools (Policy Not Applied)

**Symptoms**: Group exposes more tools than policy allows

**Diagnosis**:
```bash
# Check policy engine connection
docker logs mcp-gateway-java | grep "Policy Engine client initialized"

# Expected: http://host.docker.internal:9000 (NOT localhost:9000)
```

**Solution**:
```yaml
# docker-compose.yml
environment:
  POLICY_ENGINE_URL: http://host.docker.internal:9000
```

**Verify**:
```bash
# Should return policy count > 0
curl "http://localhost:9000/api/v1/unified/resources/mcp_server/github/policies?active=true"
```

### Issue 2: "Server must be converted to HTTP"

**Symptoms**: Cannot add STDIO server to group

**Reason**: Groups only support HTTP servers

**Solution**:
1. Convert STDIO server to HTTP using stdio-proxy service
2. Go to MCP Servers page → Click "Convert to HTTP" on the server
3. Wait for conversion to complete
4. Add the converted server to the group

### Issue 3: Empty Tool List in Group

**Symptoms**: Group returns 0 tools

**Diagnosis**:
```bash
# Check if there's a policy-group mismatch
docker logs mcp-gateway-java | grep "POLICY-GROUP MISMATCH"
```

**Common Causes**:
1. **No overlap**: Policy allows `[tool1, tool2]` but group configures `[tool3, tool4]`
2. **Wrong tool names**: Group uses incorrect tool names not matching MCP server
3. **Policy blocks all**: Policy has no active rules for the server

**Solution**:
1. Check actual tool names: `GET /mcp/servers/{name}/policy-allowed-tools`
2. Update group config with correct tool names
3. Verify policy allows at least some tools

### Issue 4: Frontend Shows All Tools Despite Policy

**Symptoms**: UI tool configuration dialog shows more tools than policy allows

**Diagnosis**:
1. Check if frontend is calling the correct endpoint
2. Verify backend is using `PolicyAwareToolService`

**Solution**:
Ensure frontend uses:
```typescript
// CORRECT
const response = await javaGatewayMcpApi.getPolicyAllowedTools(serverName);

// WRONG
const response = await javaGatewayMcpApi.listTools(serverName);
```

### Debug Endpoints

#### Tool Availability Debug

```bash
curl "http://localhost:8000/mcp/servers/github/tool-availability-debug?group_id=1"
```

**Response**:
```json
{
  "server_name": "github",
  "total_tools": 50,
  "policy_allowed_tools": ["create_issue", "list_repos", "get_pr"],
  "group_configured_tools": ["create_issue", "list_repos"],
  "final_available_tools": ["create_issue", "list_repos"],
  "blocked_by_policy": ["delete_repo", "force_push", ...],
  "blocked_by_group": ["get_pr"],
  "username": "testuser"
}
```

---

## Best Practices

### 1. Group Organization

✅ **DO**: Organize by team/role
```
Engineering Group → GitHub, Slack, Jira
Sales Group → Notion, Gmail, Calendar
DevOps Group → AWS, Datadog, GitHub
```

❌ **DON'T**: Mix unrelated servers
```
Random Group → GitHub, Gmail, AWS, Slack, Notion
```

### 2. Tool Configuration

✅ **DO**: Be specific when needed
```json
{
  "github": ["create_issue", "list_repos", "get_pr"],
  "slack": ["send_message", "list_channels"]
}
```

✅ **DO**: Use wildcard for full access (within policy)
```json
{
  "github": ["*"]
}
```

❌ **DON'T**: Configure tools not allowed by policy
```json
// Policy allows: ["create_issue", "list_repos"]
{
  "github": ["delete_repo"]  // ❌ Will be filtered out
}
```

### 3. Policy Design

✅ **DO**: Start restrictive, expand as needed
```
Initial: Allow read-only tools
After review: Add write operations
```

✅ **DO**: Document why tools are restricted
```
Policy: "github-read-only"
Reason: "Junior developers should only read code, not modify"
```

### 4. Testing

✅ **DO**: Test policy filtering
```bash
# 1. Create policy with restrictions
# 2. Create group
# 3. Verify tools/list returns only allowed tools
# 4. Try to invoke restricted tool (should fail)
```

✅ **DO**: Monitor logs for mismatches
```bash
docker logs mcp-gateway-java | grep "POLICY-GROUP MISMATCH"
```

---

## Summary

- **MCP Groups** organize multiple MCP servers into unified sub-gateways
- **Policy restrictions** always take precedence over group configurations
- **Tool filtering** uses intersection: `Server ∩ Policy ∩ Group`
- **HTTP-only**: Groups can only contain HTTP-type MCP servers
- **Auto-generated URLs**: Each group gets `http://{host}:{port}/mcp/group/{id}/mcp`
- **Policy integration**: Automatic filtering ensures security policies are enforced

**Key Files**:
- Entity: `entity/McpServerGroupEntity.java`
- Service: `service/McpGroupService.java`, `service/PolicyAwareToolService.java`
- Controller: `controller/McpController.java`
- Migration: `db/migration/V4__mcp_server_groups.sql`

**For More Information**:
- [README.md](README.md) - General gateway documentation
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [VSCODE_INTEGRATION.md](VSCODE_INTEGRATION.md) - VS Code setup
