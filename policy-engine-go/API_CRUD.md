## Policy Management CRUD API

Complete REST API for managing policies dynamically without restarting the service.

## Base URL

```
http://localhost:9000/api/v1
```

## Endpoints

### 1. List All Policies

Get a list of all policies.

**Request:**
```http
GET /api/v1/policies
```

**Response:**
```json
{
  "policies": [
    {
      "id": "deny-sensitive-tools",
      "name": "Deny Sensitive Tool Access",
      "description": "Block access to sensitive tools",
      "version": 1,
      "enabled": true,
      "enforcement": "blocking",
      "rules": [...],
      "created_at": "2026-01-26T00:00:00Z",
      "updated_at": "2026-01-26T00:00:00Z"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl http://localhost:9000/api/v1/policies
```

---

### 2. Get Policy by ID

Get a specific policy by its ID.

**Request:**
```http
GET /api/v1/policies/:id
```

**Response:**
```json
{
  "id": "deny-sensitive-tools",
  "name": "Deny Sensitive Tool Access",
  "description": "Block access to sensitive tools",
  "version": 1,
  "enabled": true,
  "enforcement": "blocking",
  "rules": [
    {
      "id": "block-admin-tools",
      "description": "Block non-admin users",
      "priority": 200,
      "conditions": [
        {
          "type": "user",
          "operator": "not_in",
          "field": "",
          "value": ["admin", "root"]
        }
      ],
      "actions": [
        {
          "type": "deny",
          "params": {
            "message": "Admin privileges required"
          }
        }
      ]
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:9000/api/v1/policies/deny-sensitive-tools
```

---

### 3. Create Policy

Create a new policy.

**Request:**
```http
POST /api/v1/policies
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "my-custom-policy",
  "name": "My Custom Policy",
  "description": "Custom policy description",
  "enabled": true,
  "enforcement": "blocking",
  "rules": [
    {
      "id": "rule-1",
      "description": "Block specific user",
      "priority": 100,
      "conditions": [
        {
          "type": "user",
          "operator": "eq",
          "field": "",
          "value": "blocked-user"
        }
      ],
      "actions": [
        {
          "type": "deny",
          "params": {
            "message": "User is blocked"
          }
        }
      ]
    }
  ]
}
```

**Response:** (201 Created)
```json
{
  "id": "my-custom-policy",
  "name": "My Custom Policy",
  "version": 1,
  "enabled": true,
  "created_at": "2026-01-26T12:00:00Z",
  "updated_at": "2026-01-26T12:00:00Z",
  ...
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block Guest Users",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [
      {
        "id": "block-guests",
        "priority": 150,
        "conditions": [
          {
            "type": "user",
            "operator": "eq",
            "field": "",
            "value": "guest"
          }
        ],
        "actions": [
          {
            "type": "deny"
          }
        ]
      }
    ]
  }'
```

---

### 4. Update Policy

Update an existing policy.

**Request:**
```http
PUT /api/v1/policies/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Policy Name",
  "description": "Updated description",
  "enabled": true,
  "enforcement": "audit_only",
  "rules": [...]
}
```

**Response:** (200 OK)
```json
{
  "id": "my-custom-policy",
  "name": "Updated Policy Name",
  "version": 2,
  "updated_at": "2026-01-26T13:00:00Z",
  ...
}
```

**Example:**
```bash
curl -X PUT http://localhost:9000/api/v1/policies/my-custom-policy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Policy",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [
      {
        "id": "updated-rule",
        "priority": 100,
        "conditions": [
          {
            "type": "user",
            "operator": "eq",
            "field": "",
            "value": "admin"
          }
        ],
        "actions": [
          {
            "type": "allow"
          }
        ]
      }
    ]
  }'
```

---

### 5. Delete Policy

Delete a policy permanently.

**Request:**
```http
DELETE /api/v1/policies/:id
```

**Response:** (200 OK)
```json
{
  "status": "deleted",
  "policy_id": "my-custom-policy"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:9000/api/v1/policies/my-custom-policy
```

---

### 6. Enable Policy

Enable a disabled policy.

**Request:**
```http
POST /api/v1/policies/:id/enable
```

**Response:** (200 OK)
```json
{
  "status": "enabled",
  "policy_id": "my-custom-policy"
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/api/v1/policies/my-custom-policy/enable
```

---

### 7. Disable Policy

Disable a policy without deleting it.

**Request:**
```http
POST /api/v1/policies/:id/disable
```

**Response:** (200 OK)
```json
{
  "status": "disabled",
  "policy_id": "my-custom-policy"
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/api/v1/policies/my-custom-policy/disable
```

---

### 8. Validate Policy

Validate a policy without creating it.

**Request:**
```http
POST /api/v1/policies/validate
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Test Policy",
  "rules": [...]
}
```

**Response:** (200 OK)
```json
{
  "valid": true,
  "message": "Policy is valid"
}
```

Or if invalid:
```json
{
  "valid": false,
  "error": "policy must have at least one rule"
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/api/v1/policies/validate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Policy",
    "rules": [
      {
        "id": "test-rule",
        "conditions": [
          {
            "type": "user",
            "operator": "eq",
            "field": "",
            "value": "test"
          }
        ],
        "actions": [
          {
            "type": "allow"
          }
        ]
      }
    ]
  }'
```

---

### 9. Reload Policies

Reload all policies from disk (useful after manual file edits).

**Request:**
```http
POST /api/v1/reload
```

**Response:** (200 OK)
```json
{
  "status": "reloaded",
  "count": 5
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/api/v1/reload
```

---

## Policy Schema

### Policy Object

```json
{
  "id": "string (optional - auto-generated)",
  "name": "string (required)",
  "description": "string (optional)",
  "org_id": "string (optional)",
  "version": "number (auto-incremented)",
  "enabled": "boolean (default: true)",
  "enforcement": "blocking | audit_only (default: blocking)",
  "rules": [
    {
      "id": "string (required)",
      "description": "string (optional)",
      "priority": "number (default: 100)",
      "conditions": [
        {
          "type": "user | time | resource | tool | data | rate",
          "operator": "eq | neq | in | not_in | gt | lt | gte | lte | matches | contains",
          "field": "string",
          "value": "any"
        }
      ],
      "actions": [
        {
          "type": "allow | deny | require_approval | redact | rate_limit | log_only | modify",
          "params": {
            "key": "value"
          }
        }
      ]
    }
  ],
  "created_by": "string (optional)",
  "created_at": "timestamp (auto-set)",
  "updated_at": "timestamp (auto-set)"
}
```

## Validation Rules

1. **Policy Name**: Required, non-empty
2. **Rules**: At least one rule required
3. **Rule ID**: Required for each rule, must be unique within policy
4. **Conditions**: At least one condition per rule
5. **Actions**: At least one action per rule
6. **Policy ID**: Must be unique across all policies

## Error Responses

### 400 Bad Request
```json
{
  "error": "policy name is required"
}
```

### 404 Not Found
```json
{
  "error": "policy not found: my-policy-id"
}
```

### 409 Conflict
```json
{
  "error": "policy already exists: my-policy-id"
}
```

### 500 Internal Server Error
```json
{
  "error": "failed to save policy: permission denied"
}
```

## Complete Example Flow

### 1. Create a new policy

```bash
curl -X POST http://localhost:9000/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Access Control",
    "description": "Restrict production access to authorized users",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [
      {
        "id": "allow-prod-admins",
        "description": "Allow production admins",
        "priority": 200,
        "conditions": [
          {
            "type": "user",
            "operator": "in",
            "field": "",
            "value": ["prod-admin", "sre-team"]
          },
          {
            "type": "resource",
            "operator": "contains",
            "field": "",
            "value": "production"
          }
        ],
        "actions": [
          {
            "type": "allow"
          }
        ]
      },
      {
        "id": "deny-others",
        "description": "Deny all others",
        "priority": 100,
        "conditions": [
          {
            "type": "resource",
            "operator": "contains",
            "field": "",
            "value": "production"
          }
        ],
        "actions": [
          {
            "type": "deny",
            "params": {
              "message": "Production access requires authorization"
            }
          }
        ]
      }
    ]
  }'
```

### 2. Test the policy

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "john-doe",
    "tool": "deploy",
    "resource": "production-database"
  }'

# Should return: action: "deny", should_block: true
```

### 3. List all policies

```bash
curl http://localhost:9000/api/v1/policies
```

### 4. Update the policy (add to authorized users)

```bash
curl -X PUT http://localhost:9000/api/v1/policies/Production-Access-Control \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Access Control",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [
      {
        "id": "allow-prod-admins",
        "priority": 200,
        "conditions": [
          {
            "type": "user",
            "operator": "in",
            "field": "",
            "value": ["prod-admin", "sre-team", "john-doe"]
          }
        ],
        "actions": [
          {
            "type": "allow"
          }
        ]
      }
    ]
  }'
```

### 5. Test again (should now allow)

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "john-doe",
    "tool": "deploy",
    "resource": "production-database"
  }'

# Should return: action: "allow", should_block: false
```

### 6. Temporarily disable the policy

```bash
curl -X POST http://localhost:9000/api/v1/policies/Production-Access-Control/disable
```

### 7. Re-enable when ready

```bash
curl -X POST http://localhost:9000/api/v1/policies/Production-Access-Control/enable
```

### 8. Delete the policy when no longer needed

```bash
curl -X DELETE http://localhost:9000/api/v1/policies/Production-Access-Control
```

## Persistence

- All policies are automatically saved to YAML files in the `policies/` directory
- Policy files are named `<policy-id>.yaml`
- Changes are persisted immediately (no manual save required)
- Policies survive restarts
- You can also manually edit YAML files and call `/api/v1/reload`

## Best Practices

1. **Use Validation Endpoint First**: Always validate policies before creating them
2. **Start with Audit Mode**: Test new policies in `audit_only` mode first
3. **Version Control**: Keep policies in git for history tracking
4. **Descriptive IDs**: Use meaningful policy and rule IDs
5. **Document Rules**: Add descriptions to explain each rule's purpose
6. **Test Thoroughly**: Test policies with `POST /evaluate` before enabling
7. **Monitor Logs**: Watch logs for policy violations and adjustments
8. **Backup**: Keep backups of critical policies
9. **Use Priorities**: Higher priority (200) for critical rules, lower (50) for audit
10. **Disable, Don't Delete**: Disable policies temporarily instead of deleting

## Integration with MCP Gateway

The MCP Gateway can use these CRUD APIs to dynamically manage policies:

```java
// Java example
PolicyEngineClient client = new PolicyEngineClient("http://policy-engine:9000");

// Create a policy programmatically
Policy policy = new Policy();
policy.setName("Dynamic Policy");
policy.setRules(rules);
client.createPolicy(policy);

// Enable/disable based on conditions
if (maintenanceMode) {
    client.disablePolicy("rate-limit-policy");
} else {
    client.enablePolicy("rate-limit-policy");
}
```

## Security Considerations

- **Authentication**: Add authentication middleware for production use
- **Authorization**: Implement role-based access control for policy management
- **Audit Logging**: Log all policy changes with user information
- **Backup**: Regularly backup the policies directory
- **Validation**: Always validate policies before applying
- **Testing**: Test policies in staging before production deployment
