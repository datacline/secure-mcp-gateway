# Cascading Policy Deletion

## Overview

When an MCP server is deleted, all associated policies are automatically deleted from the Policy Engine. This ensures data consistency and prevents orphaned policies.

## Implementation

### Flow Diagram

```
DELETE /mcp/servers/{serverName}
         |
         v
McpController.deleteServer()
         |
         v
McpConfigService.deleteServer()
         |
         +---> 1. Delete server from database (synchronous)
         |
         +---> 2. Invalidate cache
         |
         +---> 3. Delete associated policies (asynchronous)
                     |
                     v
               PolicyEngineClient.deletePoliciesForMCPServer()
                     |
                     v
               GET /api/v1/unified/resources/mcp_server/{name}/policies
                     |
                     v
               For each policy:
                 DELETE /api/v1/unified/policies/{id}
```

## Key Features

### 1. **Cascading Deletion**
- When a server is deleted, all policies bound to that server are automatically removed
- Prevents orphaned policies in the Policy Engine

### 2. **Asynchronous Processing**
- Policy deletion happens asynchronously (non-blocking)
- Server deletion completes immediately
- Policy deletion is logged but doesn't block the response

### 3. **Error Handling**
- If policy deletion fails, server deletion still succeeds
- Errors are logged but don't prevent server removal
- Ensures server can always be deleted even if Policy Engine is down

### 4. **Logging**
- Success: `Deleted {count} policies associated with server: {name}`
- No policies: `No policies found to delete for server: {name}`
- Error: `Failed to delete policies for server {name}: {error}`

## Code Changes

### 1. PolicyEngineClient.java

Added three new methods:

```java
// Delete a single policy by ID
public Mono<Boolean> deletePolicy(String policyId)

// Delete all policies for a resource
public Mono<Integer> deletePoliciesForResource(String resourceType, String resourceId)

// Convenience method for MCP servers
public Mono<Integer> deletePoliciesForMCPServer(String serverName)
```

### 2. McpConfigService.java

Updated `deleteServer()` method:

```java
@Transactional
public void deleteServer(String serverName) {
    // 1. Delete server from database
    repository.delete(entity);

    // 2. Invalidate cache
    serverConfig.invalidateCache(serverName);

    // 3. Delete associated policies (async)
    policyEngineClient.deletePoliciesForMCPServer(serverName)
        .subscribe(
            deletedCount -> LOG.info("Deleted {} policies", deletedCount),
            error -> LOG.error("Failed to delete policies: {}", error)
        );
}
```

## API Endpoints

### Delete Server (with cascading policy deletion)

```bash
DELETE /mcp/servers/{serverName}
```

**Response:**
```json
{
  "success": true,
  "message": "Server deleted successfully",
  "server_name": "my-server"
}
```

**Logs:**
```
INFO  - Deleted server from database: my-server
INFO  - Deleted 3 policies associated with server: my-server
```

## Testing

### Manual Test

```bash
# 1. Create a test server
curl -X POST http://localhost:8000/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server",
    "url": "http://localhost:9999/mcp",
    "type": "http"
  }'

# 2. Create a policy for the server
curl -X POST http://localhost:9000/api/v1/unified/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Policy",
    "status": "active",
    "resources": [
      {
        "resource_type": "mcp_server",
        "resource_id": "test-server"
      }
    ]
  }'

# 3. Verify policy exists
curl http://localhost:9000/api/v1/unified/resources/mcp_server/test-server/policies

# 4. Delete the server (should also delete policies)
curl -X DELETE http://localhost:8000/mcp/servers/test-server

# 5. Wait a moment for async deletion
sleep 2

# 6. Verify policies are gone
curl http://localhost:9000/api/v1/unified/resources/mcp_server/test-server/policies
# Should return: {"policies":[],"count":0}
```

### Automated Test Script

Run the test script:

```bash
bash /tmp/test-server-policy-deletion.sh
```

Expected output:
```
==========================================
Test: Automatic Policy Deletion on Server Delete
==========================================

1. Creating test MCP server: test-server-to-delete
{
  "success": true,
  "message": "Server created successfully"
}

2. Creating a test policy for the server
Created policy: 123e4567-e89b-12d3-a456-426614174000

3. Verifying policy exists for server
1

4. Deleting the MCP server (should also delete associated policies)
{
  "success": true,
  "message": "Server deleted successfully",
  "server_name": "test-server-to-delete"
}

5. Waiting 2 seconds for async policy deletion...

6. Verifying policies are deleted for server
Remaining policies: 0

✓ SUCCESS: All policies were automatically deleted!

==========================================
```

## Edge Cases

### 1. Policy Engine Unavailable
- Server deletion succeeds
- Policy deletion fails (logged as error)
- Policies remain orphaned (can be manually cleaned up later)

### 2. No Policies for Server
- Server deletion succeeds
- Log message: "No policies found to delete"

### 3. Multiple Policies for Server
- All policies are deleted sequentially
- Count of deleted policies is logged

### 4. Server Not Found
- Returns 400 error
- No policies are deleted

## Migration Notes

**For existing deployments:**

1. This feature is backward compatible
2. No database migrations required
3. Works with existing MCP servers
4. If Policy Engine is down, server deletion still works

**Cleanup orphaned policies:**

If you have existing servers that were deleted before this feature:

```bash
# List all policies
curl http://localhost:9000/api/v1/unified/policies | jq '.policies'

# Delete orphaned policies manually
curl -X DELETE http://localhost:9000/api/v1/unified/policies/{policy_id}
```

## Benefits

1. **Data Consistency** - No orphaned policies
2. **Simplified Management** - One operation deletes both server and policies
3. **User-Friendly** - No need to manually clean up policies
4. **Safe** - Server deletion always succeeds, even if policy deletion fails
5. **Observable** - Clear logging of all deletion operations

## Future Enhancements

Potential improvements:

1. Add option to preserve policies (e.g., `?delete_policies=false`)
2. Batch policy deletion for better performance
3. Synchronous option for policy deletion (wait for completion)
4. Soft delete with restore capability
5. Dry-run mode to preview what would be deleted
