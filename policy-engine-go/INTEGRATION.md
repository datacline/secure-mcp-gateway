# Integration Guide: Policy Engine with MCP Gateway

This guide shows how to integrate the Policy Engine with the MCP Gateway.

## Architecture

```
User Request
     ↓
MCP Gateway (Java/Python)
     ↓
     ├──→ Policy Engine (Go) - Check policies
     │         ↓
     │    [Allow/Deny/Modify]
     │         ↓
     └────────┘
     ↓
MCP Server (if allowed)
     ↓
Response (with redactions if needed)
```

## Setup

### 1. Start Policy Engine

```bash
cd policy-engine-go
docker-compose up -d
```

Verify it's running:
```bash
curl http://localhost:9000/health
```

### 2. Configure MCP Gateway

#### For Java Gateway

Add to `application.yaml`:
```yaml
gateway:
  policy-engine:
    enabled: true
    url: http://localhost:9000
    timeout: 5000
```

#### For Python Gateway

Add to `.env`:
```bash
POLICY_ENGINE_ENABLED=true
POLICY_ENGINE_URL=http://localhost:9000
POLICY_ENGINE_TIMEOUT=5
```

### 3. Add Policy Engine to Docker Compose

Update the gateway's `docker-compose.yml`:

```yaml
services:
  policy-engine:
    build: ./policy-engine-go
    container_name: policy-engine
    ports:
      - "9000:9000"
    volumes:
      - ./policies:/app/policies:ro
    environment:
      PORT: "9000"
      POLICY_DIR: "/app/policies"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:9000/health"]
      interval: 30s
      timeout: 3s
    networks:
      - mcp-network

  mcp-gateway-java:
    environment:
      POLICY_ENGINE_URL: http://policy-engine:9000
    depends_on:
      policy-engine:
        condition: service_healthy
```

## Usage in Gateway Code

### Java Implementation

Create a Policy Engine client:

```java
// PolicyEngineClient.java
package com.datacline.mcpgateway.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Component
public class PolicyEngineClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public PolicyEngineClient(
            @Value("${gateway.policy-engine.url}") String policyEngineUrl,
            ObjectMapper objectMapper) {
        this.webClient = WebClient.builder()
                .baseUrl(policyEngineUrl)
                .build();
        this.objectMapper = objectMapper;
    }

    public Mono<PolicyResult> evaluate(String user, String tool, String resource) {
        var request = Map.of(
                "user", user,
                "tool", tool,
                "resource", resource != null ? resource : ""
        );

        return webClient.post()
                .uri("/api/v1/evaluate")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(PolicyResult.class);
    }
}

// PolicyResult.java
public class PolicyResult {
    private String policyId;
    private boolean matched;
    private List<String> matchedRules;
    private String action;
    private Map<String, Object> modifications;
    private String message;
    private boolean shouldBlock;

    // Getters and setters...
}
```

Use in your service:

```java
// McpProxyService.java
@Service
public class McpProxyService {

    @Autowired
    private PolicyEngineClient policyEngineClient;

    public Mono<Map<String, Object>> invokeTool(
            String mcpServer, String toolName, String username, Map<String, Object> parameters) {
        
        // Check policy before execution
        return policyEngineClient.evaluate(username, toolName, mcpServer)
                .flatMap(policyResult -> {
                    if (policyResult.isShouldBlock()) {
                        return Mono.error(new PolicyViolationException(policyResult.getMessage()));
                    }

                    // Apply modifications if needed
                    Map<String, Object> modifiedParams = parameters;
                    if (policyResult.getModifications() != null) {
                        modifiedParams = applyModifications(parameters, policyResult.getModifications());
                    }

                    // Proceed with tool invocation
                    return mcpHttpClient.callTool(mcpServer, toolName, modifiedParams)
                            .map(result -> {
                                // Apply redaction if needed
                                if ("redact".equals(policyResult.getAction())) {
                                    return redactSensitiveData(result, policyResult.getModifications());
                                }
                                return result;
                            });
                });
    }
}
```

### Python Implementation

```python
# policy_client.py
import httpx
from typing import Dict, Any, Optional

class PolicyEngineClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=5.0)

    async def evaluate(
        self,
        user: str,
        tool: str,
        resource: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Evaluate a request against policies"""
        response = await self.client.post(
            f"{self.base_url}/api/v1/evaluate",
            json={
                "user": user,
                "tool": tool,
                "resource": resource or "",
                "parameters": parameters or {}
            }
        )
        response.raise_for_status()
        return response.json()

# Usage in mcp_proxy.py
from server.policy_client import PolicyEngineClient

policy_client = PolicyEngineClient(settings.policy_engine_url)

async def invoke_tool(mcp_server: str, tool_name: str, username: str, parameters: dict):
    # Check policy
    policy_result = await policy_client.evaluate(username, tool_name, mcp_server, parameters)
    
    if policy_result["should_block"]:
        raise PolicyViolationError(policy_result["message"])
    
    # Apply modifications
    if policy_result.get("modifications"):
        parameters = apply_modifications(parameters, policy_result["modifications"])
    
    # Execute tool
    result = await mcp_client.call_tool(tool_name, parameters)
    
    # Apply redaction
    if policy_result["action"] == "redact":
        result = redact_sensitive_data(result, policy_result.get("modifications"))
    
    return result
```

## Policy Examples

### Block Destructive Operations

```yaml
id: block-destructive-ops
name: Block Destructive Operations
rules:
  - id: block-delete-production
    priority: 200
    conditions:
      - type: tool
        operator: matches
        field: ""
        value: "delete_.*|drop_.*|truncate_.*"
      - type: resource
        operator: contains
        field: ""
        value: "production"
    actions:
      - type: deny
        params:
          message: "Destructive operations blocked on production resources"
```

### Redact PII

```yaml
id: redact-pii
name: Redact Personal Information
rules:
  - id: redact-sensitive-fields
    priority: 100
    conditions:
      - type: tool
        operator: in
        field: ""
        value: ["get_user_data", "search_customers"]
    actions:
      - type: redact
        params:
          fields: ["ssn", "credit_card", "password"]
```

### Rate Limit Expensive Tools

```yaml
id: rate-limit-expensive
name: Rate Limit Expensive Operations
rules:
  - id: limit-ml-inference
    priority: 100
    conditions:
      - type: tool
        operator: matches
        field: ""
        value: "run_.*_model|generate_.*"
    actions:
      - type: rate_limit
        params:
          limit: 10
          window: 3600
          scope: user
```

## Testing

### Test Policy Evaluation

```bash
# Test blocking
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "guest",
    "tool": "delete_database",
    "resource": "production_db"
  }'

# Expected: should_block = true
```

### Test End-to-End

```bash
# 1. Start everything
docker-compose up -d

# 2. Try to invoke a blocked tool
curl -X POST http://localhost:8000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_server": "default",
    "tool_name": "delete_database",
    "parameters": {}
  }'

# Expected: 403 Forbidden with policy message
```

## Monitoring

### Health Checks

```bash
# Policy engine health
curl http://localhost:9000/health

# Gateway health
curl http://localhost:8000/actuator/health
```

### Logs

```bash
# Policy engine logs
docker-compose logs -f policy-engine

# Gateway logs
docker-compose logs -f mcp-gateway-java
```

## Performance

- **Latency**: Policy evaluation adds < 5ms to request latency
- **Throughput**: Can handle > 10,000 evaluations/second
- **Resource Usage**: ~ 50MB memory, minimal CPU

## Best Practices

1. **Start with Audit Mode** - Test policies in `audit_only` mode first
2. **Use Priorities** - Higher priority (200) for security rules, lower (50) for audit
3. **Keep Policies Simple** - Complex conditions can impact performance
4. **Use Batch Evaluation** - For multiple checks, use batch API
5. **Monitor Logs** - Watch for policy violations and adjust
6. **Hot Reload** - Use `/api/v1/reload` to update policies without downtime

## Troubleshooting

### Policy Engine Not Responding

```bash
# Check if running
docker ps | grep policy-engine

# Check logs
docker logs policy-engine

# Restart
docker-compose restart policy-engine
```

### Policies Not Loading

```bash
# Validate YAML syntax
yamllint policies/*.yaml

# Check policy directory
docker exec policy-engine ls -la /app/policies

# Reload policies
curl -X POST http://localhost:9000/api/v1/reload
```

### High Latency

```bash
# Enable debug logging
DEBUG=true docker-compose up -d

# Check policy complexity
# Simplify conditions, reduce rule count
```

## Next Steps

1. Review example policies in `policies/` directory
2. Create custom policies for your use case
3. Test in audit mode before enabling blocking
4. Monitor and adjust based on usage patterns
5. Set up alerts for policy violations
