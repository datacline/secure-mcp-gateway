#!/bin/bash
set -e

echo "Waiting for Keycloak to be ready..."

# Wait for Keycloak to be fully ready
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -sf http://keycloak:8080 > /dev/null 2>&1; then
        echo "Keycloak is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "Attempt $attempt/$max_attempts - waiting for Keycloak..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "ERROR: Keycloak did not become ready in time"
    exit 1
fi

# Additional wait for Keycloak to fully initialize
sleep 5

echo "Configuring Keycloak..."

# Get admin token
TOKEN=$(curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to obtain admin token"
    exit 1
fi

echo "Admin token obtained"

# Check if realm already exists
REALM_EXISTS=$(curl -s -X GET "http://keycloak:8080/admin/realms/mcp-gateway" \
  -H "Authorization: Bearer $TOKEN" \
  -o /dev/null -w "%{http_code}")

if [ "$REALM_EXISTS" = "200" ]; then
    echo "Realm 'mcp-gateway' already exists, skipping creation"
else
    # Create mcp-gateway realm
    curl -s -X POST "http://keycloak:8080/admin/realms" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "realm": "mcp-gateway",
        "enabled": true,
        "displayName": "MCP Gateway",
        "accessTokenLifespan": 3600,
        "ssoSessionMaxLifespan": 36000
      }' || true

    echo "Realm 'mcp-gateway' created"
fi

# Check if client already exists
CLIENT_ID=$(curl -s -X GET "http://keycloak:8080/admin/realms/mcp-gateway/clients?clientId=mcp-gateway-client" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

if [ -n "$CLIENT_ID" ]; then
    echo "Client 'mcp-gateway-client' already exists, skipping creation"
else
    # Create mcp-gateway-client
    curl -s -X POST "http://keycloak:8080/admin/realms/mcp-gateway/clients" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "clientId": "mcp-gateway-client",
        "name": "MCP Gateway Client",
        "enabled": true,
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "implicitFlowEnabled": false,
        "serviceAccountsEnabled": false,
        "redirectUris": ["*"],
        "webOrigins": ["*"],
        "attributes": {
          "access.token.lifespan": "3600"
        }
      }' || true

    echo "Client 'mcp-gateway-client' created"
fi

# Check if test user already exists
USER_EXISTS=$(curl -s -X GET "http://keycloak:8080/admin/realms/mcp-gateway/users?username=testuser" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; print('yes' if json.load(sys.stdin) else 'no')" 2>/dev/null)

if [ "$USER_EXISTS" = "yes" ]; then
    echo "Test user 'testuser' already exists, skipping creation"
else
    # Create test user
    curl -s -X POST "http://keycloak:8080/admin/realms/mcp-gateway/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "testuser",
        "enabled": true,
        "email": "testuser@example.com",
        "emailVerified": true,
        "firstName": "Test",
        "lastName": "User",
        "credentials": [{
          "type": "password",
          "value": "testpass",
          "temporary": false
        }]
      }' || true

    echo "Test user 'testuser' created (password: testpass)"
fi

# Create admin user
USER_EXISTS=$(curl -s -X GET "http://keycloak:8080/admin/realms/mcp-gateway/users?username=admin" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; print('yes' if json.load(sys.stdin) else 'no')" 2>/dev/null)

if [ "$USER_EXISTS" = "yes" ]; then
    echo "Admin user 'admin' already exists, skipping creation"
else
    # Create admin user
    curl -s -X POST "http://keycloak:8080/admin/realms/mcp-gateway/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "admin",
        "enabled": true,
        "email": "admin@example.com",
        "emailVerified": true,
        "firstName": "Admin",
        "lastName": "User",
        "credentials": [{
          "type": "password",
          "value": "admin123",
          "temporary": false
        }]
      }' || true

    echo "Admin user 'admin' created (password: admin123)"
fi

echo ""
echo "Keycloak initialization complete!"
echo ""
echo "Configuration Summary:"
echo "  Realm: mcp-gateway"
echo "  Client ID: mcp-gateway-client"
echo "  Test User: testuser / testpass"
echo "  Admin User: admin / admin123"
echo ""
echo "Keycloak Admin Console: http://localhost:8080"
echo "  Username: admin"
echo "  Password: admin"
echo ""
