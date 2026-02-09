#!/bin/bash

# Test Script for MCP Server Configuration Endpoints
# Tests the Java Gateway configuration API

set -e

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="$BASE_URL/mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "MCP Server Configuration API Tests"
echo "========================================"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Function to print section
print_section() {
    echo ""
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=======================================${NC}"
}

# Test 1: Check if Java Gateway is running
print_section "Test 1: Check Java Gateway Health"
if curl -s -f "$BASE_URL/actuator/health" > /dev/null; then
    print_result 0 "Java Gateway is running"
else
    print_result 1 "Java Gateway is not accessible"
    echo "Please start the Java Gateway first:"
    echo "  cd server-java && ./mvnw spring-boot:run"
    exit 1
fi

# Test 2: List all servers
print_section "Test 2: List All Servers"
SERVERS_RESPONSE=$(curl -s "$API_URL/servers")
SERVER_COUNT=$(echo "$SERVERS_RESPONSE" | jq -r '.count // 0' 2>/dev/null || echo "0")
echo "Response:"
echo "$SERVERS_RESPONSE" | jq '.' 2>/dev/null || echo "$SERVERS_RESPONSE"
print_result 0 "Listed $SERVER_COUNT servers"

# Test 3: Get configuration for 'notion' server (if it exists)
print_section "Test 3: Get Server Configuration"
if [ "$SERVER_COUNT" -gt 0 ]; then
    FIRST_SERVER=$(echo "$SERVERS_RESPONSE" | jq -r '.servers[0].name' 2>/dev/null)
    echo "Getting configuration for: $FIRST_SERVER"
    
    CONFIG_RESPONSE=$(curl -s "$API_URL/servers/$FIRST_SERVER/config")
    echo "Response:"
    echo "$CONFIG_RESPONSE" | jq '.' 2>/dev/null || echo "$CONFIG_RESPONSE"
    
    if echo "$CONFIG_RESPONSE" | jq -e '.url' > /dev/null 2>&1; then
        print_result 0 "Got configuration for $FIRST_SERVER"
    else
        print_result 1 "Failed to get configuration"
    fi
else
    echo "No servers found, skipping test"
fi

# Test 4: Create a test server
print_section "Test 4: Create New Server"
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/servers" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "test-config-server",
        "url": "http://localhost:9999/mcp",
        "type": "http",
        "timeout": 30,
        "enabled": false,
        "description": "Test server created by automated tests",
        "tags": ["test", "automated"],
        "tools": ["*"]
    }')

echo "Response:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | jq -e '.success' | grep -q "true"; then
    print_result 0 "Created test server"
    TEST_SERVER_CREATED=true
else
    print_result 1 "Failed to create test server (may already exist)"
    TEST_SERVER_CREATED=false
fi

# Test 5: Update the test server
if [ "$TEST_SERVER_CREATED" = true ]; then
    print_section "Test 5: Update Server Configuration"
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/servers/test-config-server/config" \
        -H "Content-Type: application/json" \
        -d '{
            "url": "http://localhost:9999/mcp",
            "type": "http",
            "timeout": 60,
            "enabled": true,
            "description": "Updated test server description",
            "tags": ["test", "automated", "updated"],
            "tools": ["*"]
        }')

    echo "Response:"
    echo "$UPDATE_RESPONSE" | jq '.' 2>/dev/null || echo "$UPDATE_RESPONSE"

    if echo "$UPDATE_RESPONSE" | jq -e '.success' | grep -q "true"; then
        print_result 0 "Updated test server configuration"
    else
        print_result 1 "Failed to update configuration"
    fi
fi

# Test 6: Get updated configuration
if [ "$TEST_SERVER_CREATED" = true ]; then
    print_section "Test 6: Verify Updated Configuration"
    UPDATED_CONFIG=$(curl -s "$API_URL/servers/test-config-server/config")
    echo "Response:"
    echo "$UPDATED_CONFIG" | jq '.' 2>/dev/null || echo "$UPDATED_CONFIG"

    TIMEOUT=$(echo "$UPDATED_CONFIG" | jq -r '.timeout' 2>/dev/null)
    if [ "$TIMEOUT" = "60" ]; then
        print_result 0 "Configuration update verified (timeout=60)"
    else
        print_result 1 "Configuration update verification failed"
    fi
fi

# Test 7: Delete the test server
if [ "$TEST_SERVER_CREATED" = true ]; then
    print_section "Test 7: Delete Test Server"
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/servers/test-config-server")
    echo "Response:"
    echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"

    if echo "$DELETE_RESPONSE" | jq -e '.success' | grep -q "true"; then
        print_result 0 "Deleted test server"
    else
        print_result 1 "Failed to delete test server"
    fi
fi

# Test 8: Reload configuration
print_section "Test 8: Reload Configuration"
RELOAD_RESPONSE=$(curl -s -X POST "$API_URL/servers/reload")
echo "Response:"
echo "$RELOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$RELOAD_RESPONSE"

if echo "$RELOAD_RESPONSE" | jq -e '.success' | grep -q "true"; then
    print_result 0 "Reloaded configuration"
else
    print_result 1 "Failed to reload configuration"
fi

# Test 9: Test validation (invalid URL)
print_section "Test 9: Test Validation (Invalid URL)"
VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/servers" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "invalid-server",
        "url": "",
        "type": "http"
    }')

echo "Response:"
echo "$VALIDATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VALIDATION_RESPONSE"

if echo "$VALIDATION_RESPONSE" | jq -e '.error' | grep -q "URL"; then
    print_result 0 "Validation correctly rejected empty URL"
else
    print_result 1 "Validation did not catch empty URL"
fi

# Test 10: Test validation (invalid type)
print_section "Test 10: Test Validation (Invalid Type)"
VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/servers" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "invalid-type-server",
        "url": "http://localhost:3000/mcp",
        "type": "invalid_type"
    }')

echo "Response:"
echo "$VALIDATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VALIDATION_RESPONSE"

if echo "$VALIDATION_RESPONSE" | jq -e '.error' | grep -q "type"; then
    print_result 0 "Validation correctly rejected invalid type"
else
    print_result 1 "Validation did not catch invalid type"
fi

# Summary
print_section "Test Summary"
echo "All tests completed!"
echo ""
echo "Configuration endpoints available at:"
echo "  GET    $API_URL/servers/{name}/config"
echo "  PUT    $API_URL/servers/{name}/config"
echo "  POST   $API_URL/servers"
echo "  DELETE $API_URL/servers/{name}"
echo "  POST   $API_URL/servers/reload"
echo ""
echo "Check server-java/mcp_servers.yaml for changes"
echo "Backups are created in server-java/mcp_servers.yaml.backup.*"
