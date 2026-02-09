#!/bin/bash

# Test Script for Java Gateway Integration
# This script tests the Policy Engine's ability to fetch MCP servers from the Java Gateway

set -e

BASE_URL="${BASE_URL:-http://localhost:9000}"
JAVA_GATEWAY_URL="${JAVA_GATEWAY_URL:-http://localhost:8000}"

echo "=========================================="
echo "Java Gateway Integration Test"
echo "=========================================="
echo ""
echo "Policy Engine URL: $BASE_URL"
echo "Java Gateway URL: $JAVA_GATEWAY_URL"
echo ""

# Function to print colored output
print_success() {
    echo -e "\033[0;32m✓ $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m✗ $1\033[0m"
}

print_info() {
    echo -e "\033[0;34mℹ $1\033[0m"
}

# Test 1: Check Java Gateway is running
echo "Test 1: Checking Java Gateway health..."
if curl -s -f "$JAVA_GATEWAY_URL/actuator/health" > /dev/null; then
    print_success "Java Gateway is running"
else
    print_error "Java Gateway is not accessible at $JAVA_GATEWAY_URL"
    echo "Please start the Java Gateway first:"
    echo "  cd server-java && ./mvnw spring-boot:run"
    exit 1
fi
echo ""

# Test 2: Check Policy Engine is running
echo "Test 2: Checking Policy Engine health..."
if curl -s -f "$BASE_URL/health" > /dev/null; then
    print_success "Policy Engine is running"
else
    print_error "Policy Engine is not accessible at $BASE_URL"
    echo "Please start the Policy Engine first:"
    echo "  cd policy-engine-go && ./bin/policy-engine"
    exit 1
fi
echo ""

# Test 3: Fetch servers directly from Java Gateway
echo "Test 3: Fetching servers directly from Java Gateway..."
JAVA_SERVERS=$(curl -s "$JAVA_GATEWAY_URL/mcp/servers")
JAVA_COUNT=$(echo "$JAVA_SERVERS" | jq -r '.count // 0' 2>/dev/null || echo "0")
print_info "Java Gateway returned $JAVA_COUNT servers"
echo ""

# Test 4: Fetch servers via Policy Engine proxy
echo "Test 4: Fetching servers via Policy Engine proxy..."
PROXY_SERVERS=$(curl -s "$BASE_URL/api/v1/mcp-servers")
PROXY_COUNT=$(echo "$PROXY_SERVERS" | jq -r '.count // 0' 2>/dev/null || echo "0")
print_info "Policy Engine proxy returned $PROXY_COUNT servers"
echo ""

# Test 5: Compare results
echo "Test 5: Comparing results..."
if [ "$JAVA_COUNT" -eq "$PROXY_COUNT" ] && [ "$JAVA_COUNT" -gt "0" ]; then
    print_success "Server counts match ($JAVA_COUNT servers)"
    echo ""
    echo "Servers found:"
    echo "$PROXY_SERVERS" | jq -r '.servers[] | "  - \(.name): \(.description // "No description")"' 2>/dev/null || echo "$PROXY_SERVERS" | head -20
else
    if [ "$JAVA_COUNT" -eq "0" ]; then
        print_error "No servers configured in Java Gateway"
        echo "Please add servers to server-java/mcp_servers.yaml"
    elif [ "$PROXY_COUNT" -eq "0" ]; then
        print_error "Policy Engine proxy returned no servers"
        echo "Check Policy Engine logs for errors"
    else
        print_error "Server counts don't match (Java: $JAVA_COUNT, Proxy: $PROXY_COUNT)"
    fi
fi
echo ""

# Test 6: Fetch tools for a specific server (if available)
if [ "$PROXY_COUNT" -gt "0" ]; then
    FIRST_SERVER=$(echo "$PROXY_SERVERS" | jq -r '.servers[0].name' 2>/dev/null)
    if [ -n "$FIRST_SERVER" ] && [ "$FIRST_SERVER" != "null" ]; then
        echo "Test 6: Fetching tools for server '$FIRST_SERVER'..."
        
        # Try to fetch tools via Policy Engine
        TOOLS_RESPONSE=$(curl -s "$BASE_URL/api/v1/mcp-servers/$FIRST_SERVER/tools")
        TOOLS_COUNT=$(echo "$TOOLS_RESPONSE" | jq -r '.count // 0' 2>/dev/null || echo "0")
        
        if [ "$TOOLS_COUNT" -gt "0" ]; then
            print_success "Successfully fetched $TOOLS_COUNT tools for '$FIRST_SERVER'"
            echo ""
            echo "Tools available:"
            echo "$TOOLS_RESPONSE" | jq -r '.tools[] | "  - \(.name): \(.description // "No description")"' 2>/dev/null || echo "$TOOLS_RESPONSE" | head -20
        else
            print_info "Server '$FIRST_SERVER' has no tools or server is not accessible"
            echo "Response: $TOOLS_RESPONSE"
        fi
        echo ""
    fi
fi

# Summary
echo "=========================================="
echo "Integration Test Summary"
echo "=========================================="
echo ""

if [ "$JAVA_COUNT" -gt "0" ] && [ "$JAVA_COUNT" -eq "$PROXY_COUNT" ]; then
    print_success "Integration test PASSED!"
    echo ""
    echo "The Policy Engine is successfully fetching MCP servers from the Java Gateway."
    echo ""
    echo "Available endpoints:"
    echo "  - GET $BASE_URL/api/v1/mcp-servers"
    echo "  - GET $BASE_URL/api/v1/mcp-servers/:name/tools"
    echo "  - GET $BASE_URL/api/v1/mcp-servers/:name/info"
    exit 0
else
    print_error "Integration test FAILED"
    echo ""
    echo "Please check:"
    echo "  1. Java Gateway is running on $JAVA_GATEWAY_URL"
    echo "  2. Policy Engine is running on $BASE_URL"
    echo "  3. Servers are configured in server-java/mcp_servers.yaml"
    echo "  4. Environment variable JAVA_GATEWAY_URL is set correctly"
    exit 1
fi
