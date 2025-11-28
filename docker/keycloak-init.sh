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

echo "Relaxing SSL requirement on master realm (dev only)..."

curl -s -X PUT "http://keycloak:8080/admin/realms/master" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sslRequired": "none"}' || false

echo "Master realm SSL requirement set to none"

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
        "ssoSessionMaxLifespan": 36000,
        "sslRequired": "none"
      }' || true

    echo "Realm 'mcp-gateway' created"
fi

# Update SSL requirement (in case realm already existed)
curl -s -X PUT "http://keycloak:8080/admin/realms/mcp-gateway" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sslRequired": "none"}' || true

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

echo "Updating Trusted Hosts policy..."

# Get all components and find Trusted Hosts policy
# We use a python script to find the component, modify it, and print the result
UPDATE_PAYLOAD=$(curl -s -X GET "http://keycloak:8080/admin/realms/mcp-gateway/components?type=org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
try:
    components = json.load(sys.stdin)
    # Find the Trusted Hosts policy
    policy = next((c for c in components if c['name'] == 'Trusted Hosts'), None)
    
    if policy:
        config = policy.get('config', {})
        # trusted-hosts is a list of strings in the config map
        hosts = config.get('trusted-hosts', [])
        target_ip = '151.101.128.223'
        
        if target_ip not in hosts:
            hosts.append(target_ip)
            config['trusted-hosts'] = hosts
            policy['config'] = config
            print(json.dumps(policy))
        else:
            print('NO_UPDATE')
    else:
        print('NOT_FOUND')
except Exception as e:
    print('ERROR')
")

if [ "$UPDATE_PAYLOAD" == "NO_UPDATE" ]; then
    echo "Trusted Hosts policy already includes the IP."
elif [ "$UPDATE_PAYLOAD" == "NOT_FOUND" ]; then
    echo "WARNING: Trusted Hosts policy not found."
elif [ "$UPDATE_PAYLOAD" == "ERROR" ]; then
    echo "ERROR: Failed to process Trusted Hosts policy."
else
    # Extract ID from the payload
    COMPONENT_ID=$(echo "$UPDATE_PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
    
    if [ -n "$COMPONENT_ID" ]; then
        # Update the component
        curl -s -X PUT "http://keycloak:8080/admin/realms/mcp-gateway/components/$COMPONENT_ID" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d "$UPDATE_PAYLOAD" || true
          
        echo "Trusted Hosts policy updated to trust 151.101.128.223"
    else
        echo "ERROR: Could not extract component ID for update."
    fi
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
