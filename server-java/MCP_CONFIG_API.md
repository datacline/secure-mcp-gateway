# MCP Server Configuration API

## Required Java Gateway Endpoints

The frontend Configure tab calls these endpoints directly on the Java Gateway to manage MCP server configurations. These endpoints need to be implemented in `McpController.java`.

---

## 📋 API Endpoints

### **1. Get Server Configuration**

```
GET /api/mcp/servers/{serverName}/config
```

**Description**: Get the configuration for a specific MCP server

**Response**:
```json
{
  "url": "http://host.docker.internal:8081/mcp",
  "type": "http",
  "timeout": 60,
  "enabled": true,
  "description": "Notion MCP server for workspace integration",
  "tags": ["notion", "productivity", "workspace"],
  "tools": ["*"],
  "auth": {
    "method": "bearer",
    "location": "header",
    "name": "Authorization",
    "format": "prefix",
    "prefix": "Bearer ",
    "credential_ref": "env://NOTION_MCP_BEARER_TOKEN"
  },
  "metadata": {
    "cluster": "local",
    "region": "localhost"
  }
}
```

---

### **2. Update Server Configuration**

```
PUT /api/mcp/servers/{serverName}/config
```

**Description**: Update the configuration for an existing MCP server

**Request Body**:
```json
{
  "url": "http://host.docker.internal:8081/mcp",
  "type": "http",
  "timeout": 60,
  "enabled": true,
  "description": "Notion MCP server for workspace integration",
  "tags": ["notion", "productivity", "workspace"],
  "tools": ["*"],
  "auth": {
    "method": "bearer",
    "location": "header",
    "name": "Authorization",
    "format": "prefix",
    "prefix": "Bearer ",
    "credential_ref": "env://NOTION_MCP_BEARER_TOKEN"
  },
  "metadata": {
    "cluster": "local",
    "region": "localhost"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Server configuration updated successfully",
  "server_name": "notion"
}
```

**Actions**:
1. Validate the configuration
2. Update `mcp_servers.yaml` file
3. Reload server configuration
4. Return success/error

---

### **3. Create New Server**

```
POST /api/mcp/servers
```

**Description**: Create a new MCP server

**Request Body**:
```json
{
  "name": "github",
  "url": "https://api.githubcopilot.com/mcp",
  "type": "http",
  "timeout": 60,
  "enabled": false,
  "description": "GitHub Copilot MCP server",
  "tags": ["github", "copilot", "code"],
  "tools": ["*"],
  "auth": {
    "method": "bearer",
    "location": "header",
    "name": "Authorization",
    "format": "prefix",
    "prefix": "Bearer ",
    "credential_ref": "env://GITHUB_MCP_PAT"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Server created successfully",
  "server_name": "github"
}
```

**Actions**:
1. Validate server name is unique
2. Validate configuration
3. Add to `mcp_servers.yaml`
4. Reload configuration
5. Return success/error

---

### **4. Delete Server**

```
DELETE /api/mcp/servers/{serverName}
```

**Description**: Delete an MCP server

**Response**:
```json
{
  "success": true,
  "message": "Server deleted successfully",
  "server_name": "github"
}
```

**Actions**:
1. Remove from `mcp_servers.yaml`
2. Reload configuration
3. Return success/error

---

### **5. Reload Configuration**

```
POST /api/mcp/servers/reload
```

**Description**: Reload all server configurations from `mcp_servers.yaml`

**Response**:
```json
{
  "success": true,
  "message": "Configuration reloaded successfully",
  "server_count": 5
}
```

**Actions**:
1. Re-read `mcp_servers.yaml`
2. Update internal server registry
3. Return count of loaded servers

---

## 🔧 Implementation Guide

### **Step 1: Add Configuration Service**

Create `src/main/java/com/datacline/mcpgateway/service/McpConfigService.java`:

```java
@Service
public class McpConfigService {
    
    private final String configFile;
    
    public McpConfigService(@Value("${gateway.mcp-servers-config}") String configFile) {
        this.configFile = configFile;
    }
    
    public Map<String, Object> getServerConfig(String serverName) throws IOException {
        // Read from mcp_servers.yaml
        // Return server configuration
    }
    
    public void updateServerConfig(String serverName, Map<String, Object> config) throws IOException {
        // Read mcp_servers.yaml
        // Update server configuration
        // Write back to file
        // Trigger reload
    }
    
    public void createServer(String serverName, Map<String, Object> config) throws IOException {
        // Read mcp_servers.yaml
        // Validate server name doesn't exist
        // Add new server
        // Write back to file
        // Trigger reload
    }
    
    public void deleteServer(String serverName) throws IOException {
        // Read mcp_servers.yaml
        // Remove server
        // Write back to file
        // Trigger reload
    }
    
    public void reloadConfiguration() throws IOException {
        // Re-read mcp_servers.yaml
        // Update McpServerConfig or registry
    }
}
```

### **Step 2: Add Controller Methods**

Add to `McpController.java`:

```java
@Autowired
private McpConfigService configService;

@GetMapping("/servers/{serverName}/config")
public ResponseEntity<Map<String, Object>> getServerConfig(@PathVariable String serverName) {
    try {
        Map<String, Object> config = configService.getServerConfig(serverName);
        return ResponseEntity.ok(config);
    } catch (IOException e) {
        return ResponseEntity.internalServerError()
            .body(Map.of("error", "Failed to read configuration: " + e.getMessage()));
    }
}

@PutMapping("/servers/{serverName}/config")
public ResponseEntity<Map<String, Object>> updateServerConfig(
        @PathVariable String serverName,
        @RequestBody Map<String, Object> config) {
    try {
        configService.updateServerConfig(serverName, config);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Server configuration updated successfully",
            "server_name", serverName
        ));
    } catch (IOException e) {
        return ResponseEntity.internalServerError()
            .body(Map.of("error", "Failed to update configuration: " + e.getMessage()));
    }
}

@PostMapping("/servers")
public ResponseEntity<Map<String, Object>> createServer(@RequestBody Map<String, Object> request) {
    try {
        String serverName = (String) request.get("name");
        request.remove("name");
        configService.createServer(serverName, request);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Server created successfully",
            "server_name", serverName
        ));
    } catch (IOException e) {
        return ResponseEntity.internalServerError()
            .body(Map.of("error", "Failed to create server: " + e.getMessage()));
    }
}

@DeleteMapping("/servers/{serverName}")
public ResponseEntity<Map<String, Object>> deleteServer(@PathVariable String serverName) {
    try {
        configService.deleteServer(serverName);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Server deleted successfully",
            "server_name", serverName
        ));
    } catch (IOException e) {
        return ResponseEntity.internalServerError()
            .body(Map.of("error", "Failed to delete server: " + e.getMessage()));
    }
}

@PostMapping("/servers/reload")
public ResponseEntity<Map<String, Object>> reloadConfiguration() {
    try {
        configService.reloadConfiguration();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Configuration reloaded successfully"
        ));
    } catch (IOException e) {
        return ResponseEntity.internalServerError()
            .body(Map.of("error", "Failed to reload configuration: " + e.getMessage()));
    }
}
```

### **Step 3: YAML Manipulation**

Use SnakeYAML library for reading/writing YAML:

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.yaml</groupId>
    <artifactId>snakeyaml</artifactId>
    <version>2.0</version>
</dependency>
```

```java
import org.yaml.snakeyaml.Yaml;
import java.io.*;
import java.util.*;

public class YamlConfigManager {
    
    public Map<String, Object> readYaml(String filePath) throws IOException {
        Yaml yaml = new Yaml();
        try (InputStream in = new FileInputStream(filePath)) {
            return yaml.load(in);
        }
    }
    
    public void writeYaml(String filePath, Map<String, Object> data) throws IOException {
        Yaml yaml = new Yaml();
        try (Writer writer = new FileWriter(filePath)) {
            yaml.dump(data, writer);
        }
    }
    
    public Map<String, Object> getServerConfig(String filePath, String serverName) throws IOException {
        Map<String, Object> config = readYaml(filePath);
        Map<String, Object> servers = (Map<String, Object>) config.get("servers");
        return (Map<String, Object>) servers.get(serverName);
    }
    
    public void updateServerConfig(String filePath, String serverName, Map<String, Object> serverConfig) throws IOException {
        Map<String, Object> config = readYaml(filePath);
        Map<String, Object> servers = (Map<String, Object>) config.get("servers");
        servers.put(serverName, serverConfig);
        writeYaml(filePath, config);
    }
}
```

---

## 🧪 Testing

### **Test Get Configuration**

```bash
curl http://localhost:8000/api/mcp/servers/notion/config
```

### **Test Update Configuration**

```bash
curl -X PUT http://localhost:8000/api/mcp/servers/notion/config \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://host.docker.internal:8081/mcp",
    "type": "http",
    "timeout": 90,
    "enabled": true,
    "description": "Updated description",
    "tags": ["notion", "productivity"],
    "tools": ["*"]
  }'
```

### **Test Create Server**

```bash
curl -X POST http://localhost:8000/api/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server",
    "url": "http://localhost:3000/mcp",
    "type": "http",
    "enabled": true,
    "description": "Test server"
  }'
```

### **Test Delete Server**

```bash
curl -X DELETE http://localhost:8000/api/mcp/servers/test-server
```

### **Test Reload**

```bash
curl -X POST http://localhost:8000/api/mcp/servers/reload
```

---

## 📋 Configuration Validation

Implement validation for:

1. **URL**: Valid HTTP/HTTPS URL format
2. **Type**: One of: `http`, `stdio`, `sse`, `websocket`
3. **Timeout**: Positive integer, reasonable range (1-300 seconds)
4. **Server Name**: Unique, alphanumeric + hyphens/underscores
5. **Auth Method**: One of: `bearer`, `api_key`, `basic`, `oauth2`, `custom`
6. **Credential Ref**: Valid format (`env://`, `file://`, `vault://`)

---

## 🔒 Security Considerations

1. **Authentication**: Require authentication for all config endpoints
2. **Authorization**: Check user has admin permissions
3. **Validation**: Thoroughly validate all input
4. **Backup**: Create backup before modifying `mcp_servers.yaml`
5. **Audit Log**: Log all configuration changes
6. **Secrets**: Never return actual secrets in GET responses

---

## ✅ Summary

**Frontend sends configuration to these Java Gateway endpoints:**
- ✅ GET `/api/mcp/servers/{name}/config` - Get config
- ✅ PUT `/api/mcp/servers/{name}/config` - Update config
- ✅ POST `/api/mcp/servers` - Create server
- ✅ DELETE `/api/mcp/servers/{name}` - Delete server
- ✅ POST `/api/mcp/servers/reload` - Reload all

**Java Gateway needs to:**
1. Read/write `mcp_servers.yaml`
2. Validate configurations
3. Reload internal server registry
4. Return proper responses

**See `McpConfigService.java` implementation guide above!** 🚀
