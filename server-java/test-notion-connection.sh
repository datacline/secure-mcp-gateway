#!/bin/bash

# MCP Gateway - Notion Connection Test Script

set -e

echo "==================================="
echo "Notion MCP Connection Test"
echo "==================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if token is set
echo "1. Checking NOTION_MCP_BEARER_TOKEN..."
if [ -z "$NOTION_MCP_BEARER_TOKEN" ]; then
    echo -e "${RED}✗ NOTION_MCP_BEARER_TOKEN is NOT set${NC}"
    echo "  Solution: export NOTION_MCP_BEARER_TOKEN='your-token'"
    exit 1
else
    TOKEN_LEN=${#NOTION_MCP_BEARER_TOKEN}
    echo -e "${GREEN}✓ Token is set (length: $TOKEN_LEN)${NC}"
fi
echo ""

# Test 2: Check if Notion MCP server is running
echo "2. Checking if Notion MCP server is running on port 8081..."
if curl -s -f http://localhost:8081/mcp > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Notion MCP server is accessible${NC}"
elif curl -s http://localhost:8081/mcp 2>&1 | grep -q "401"; then
    echo -e "${GREEN}✓ Notion MCP server is running (returned 401, which is expected)${NC}"
else
    echo -e "${RED}✗ Notion MCP server is NOT running${NC}"
    echo "  Solution: npx -y @modelcontextprotocol/server-notion --transport http --port 8081"
    exit 1
fi
echo ""

# Test 3: Test authentication manually
echo "3. Testing authentication with Notion MCP server..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8081/mcp \
  -H "Authorization: Bearer $NOTION_MCP_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0"}
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Authentication successful (200 OK)${NC}"
    echo "  Response: ${BODY:0:100}..."
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}✗ Authentication failed (401 Unauthorized)${NC}"
    echo "  Response: $BODY"
    echo "  Check if your token is correct"
    exit 1
else
    echo -e "${YELLOW}⚠ Unexpected response code: $HTTP_CODE${NC}"
    echo "  Response: $BODY"
fi
echo ""

# Test 4: Check if gateway is running
echo "4. Checking if MCP Gateway is running..."
if curl -s -f http://localhost:8000/actuator/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Gateway is running${NC}"
else
    echo -e "${RED}✗ Gateway is NOT running${NC}"
    echo "  Solution: make dev (in server-java directory)"
    exit 1
fi
echo ""

# Test 5: Test through gateway
echo "5. Testing Notion connection through gateway..."
GATEWAY_RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:8000/mcp/list-tools?mcp_server=notion")
GATEWAY_HTTP_CODE=$(echo "$GATEWAY_RESPONSE" | tail -n1)
GATEWAY_BODY=$(echo "$GATEWAY_RESPONSE" | head -n-1)

if [ "$GATEWAY_HTTP_CODE" = "200" ]; then
    if echo "$GATEWAY_BODY" | grep -q "tools"; then
        echo -e "${GREEN}✓ Gateway successfully connected to Notion MCP server!${NC}"
        echo "  Tools available:"
        echo "$GATEWAY_BODY" | jq -r '.tools[].name' 2>/dev/null | head -5 | sed 's/^/    - /'
    else
        echo -e "${YELLOW}⚠ Gateway returned 200 but no tools found${NC}"
        echo "  Response: ${GATEWAY_BODY:0:200}"
    fi
else
    echo -e "${RED}✗ Gateway failed to connect${NC}"
    echo "  HTTP Code: $GATEWAY_HTTP_CODE"
    echo "  Response: ${GATEWAY_BODY:0:500}"
    echo ""
    echo "  Check gateway logs for details:"
    echo "    - Look for 'Applying authentication for server: notion'"
    echo "    - Look for 'Adding header: Authorization'"
    echo "    - Look for any error messages"
fi
echo ""

echo "==================================="
if [ "$GATEWAY_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
else
    echo -e "${RED}Some tests failed. See messages above.${NC}"
fi
echo "==================================="
