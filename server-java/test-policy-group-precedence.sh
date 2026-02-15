#!/bin/bash

# Test script for Policy-Group Tool Precedence (Phase 1: Detection)
# This script tests the detection of mismatches between policy-allowed tools and group-configured tools

set -e

BASE_URL="${BASE_URL:-http://localhost:8000}"
POLICY_ENGINE_URL="${POLICY_ENGINE_URL:-http://localhost:9000}"

echo "=========================================="
echo "Policy-Group Tool Precedence Test (Phase 1)"
echo "=========================================="
echo ""
echo "Base URL: $BASE_URL"
echo "Policy Engine URL: $POLICY_ENGINE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Get policy-allowed tools for a server
echo -e "${YELLOW}Test 1: Get policy-allowed tools for a server${NC}"
echo "GET $BASE_URL/mcp/servers/notion-mcp/policy-allowed-tools"
curl -s -X GET "$BASE_URL/mcp/servers/notion-mcp/policy-allowed-tools" | jq '.'
echo ""

# Test 2: Get tool availability debug info
echo -e "${YELLOW}Test 2: Get tool availability debug info (no group)${NC}"
echo "GET $BASE_URL/mcp/servers/notion-mcp/tool-availability-debug"
curl -s -X GET "$BASE_URL/mcp/servers/notion-mcp/tool-availability-debug" | jq '.'
echo ""

# Test 3: List groups to find a group ID
echo -e "${YELLOW}Test 3: List available groups${NC}"
echo "GET $BASE_URL/mcp/groups"
GROUPS_RESPONSE=$(curl -s -X GET "$BASE_URL/mcp/groups")
echo "$GROUPS_RESPONSE" | jq '.'
echo ""

# Extract first group ID if available
GROUP_ID=$(echo "$GROUPS_RESPONSE" | jq -r '.groups[0].id // empty')

if [ -n "$GROUP_ID" ]; then
    echo -e "${GREEN}Found group ID: $GROUP_ID${NC}"
    echo ""

    # Test 4: Get tools from group (with policy awareness)
    echo -e "${YELLOW}Test 4: List tools from group (policy-aware)${NC}"
    echo "POST $BASE_URL/mcp/group/$GROUP_ID/mcp"
    curl -s -X POST "$BASE_URL/mcp/group/$GROUP_ID/mcp" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        }' | jq '.'
    echo ""

    # Test 5: Get tool availability debug info for a group
    echo -e "${YELLOW}Test 5: Get tool availability debug info (with group)${NC}"
    # Get first server from the group
    GROUP_DETAILS=$(curl -s -X GET "$BASE_URL/mcp/groups/$GROUP_ID")
    SERVER_NAME=$(echo "$GROUP_DETAILS" | jq -r '.serverNames[0] // empty')

    if [ -n "$SERVER_NAME" ]; then
        echo "GET $BASE_URL/mcp/servers/$SERVER_NAME/tool-availability-debug?group_id=$GROUP_ID"
        curl -s -X GET "$BASE_URL/mcp/servers/$SERVER_NAME/tool-availability-debug?group_id=$GROUP_ID" | jq '.'
        echo ""
    else
        echo -e "${RED}No servers found in group${NC}"
        echo ""
    fi

    # Test 6: Check logs for mismatch warnings
    echo -e "${YELLOW}Test 6: Check application logs for POLICY-GROUP MISMATCH warnings${NC}"
    echo "Look for lines containing: '⚠️  POLICY-GROUP MISMATCH DETECTED'"
    echo ""
    echo "Example log output to look for:"
    echo "  WARN  ⚠️  POLICY-GROUP MISMATCH DETECTED for server: github-mcp, user: testuser"
    echo "        Group configured tools: [create_issue, list_repos, delete_repo]"
    echo "        Policy allowed tools: [create_issue, list_repos]"
    echo "        ❌ Tools in group config but NOT allowed by policy: [delete_repo]"
    echo ""
else
    echo -e "${YELLOW}No groups found. Creating a test scenario...${NC}"
    echo ""

    # Create a policy that restricts tools (if policy engine is available)
    echo -e "${YELLOW}Test 6: Create a test policy${NC}"
    echo "POST $POLICY_ENGINE_URL/api/v1/unified/policies"

    POLICY_RESPONSE=$(curl -s -X POST "$POLICY_ENGINE_URL/api/v1/unified/policies" \
        -H "Content-Type: application/json" \
        -d '{
            "policy_code": "test-notion-tools-restricted",
            "name": "Test Notion Tool Restrictions",
            "description": "Test policy to restrict Notion MCP tools for testing",
            "status": "active",
            "priority": 100,
            "policy_rules": [
                {
                    "rule_id": "limit-notion-tools",
                    "priority": 1,
                    "description": "Only allow specific Notion tools",
                    "conditions": {
                        "all": [
                            {
                                "field": "resource.type",
                                "operator": "equals",
                                "value": "mcp_server"
                            },
                            {
                                "field": "resource.id",
                                "operator": "equals",
                                "value": "notion-mcp"
                            },
                            {
                                "field": "tool.name",
                                "operator": "in",
                                "value": ["search_pages", "get_page"]
                            }
                        ]
                    },
                    "actions": [
                        {
                            "type": "allow"
                        }
                    ]
                }
            ],
            "resources": [
                {
                    "resource_type": "mcp_server",
                    "resource_id": "notion-mcp"
                }
            ]
        }' 2>&1)

    if echo "$POLICY_RESPONSE" | jq -e '.policy_id' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Test policy created successfully${NC}"
        echo "$POLICY_RESPONSE" | jq '.'
    else
        echo -e "${RED}❌ Failed to create test policy${NC}"
        echo "$POLICY_RESPONSE"
    fi
    echo ""
fi

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "Phase 1 implementation adds:"
echo "  ✅ PolicyAwareToolService for detecting policy-group mismatches"
echo "  ✅ API endpoint: GET /mcp/servers/{serverName}/policy-allowed-tools"
echo "  ✅ Debug endpoint: GET /mcp/servers/{serverName}/tool-availability-debug"
echo "  ✅ Logging of policy-group mismatches in group gateway"
echo ""
echo "What to look for:"
echo "  1. Check application logs for POLICY-GROUP MISMATCH warnings"
echo "  2. Use debug endpoint to see detailed tool filtering info"
echo "  3. Verify policy-allowed-tools endpoint returns correct tools"
echo ""
echo "Next steps (Phase 2):"
echo "  - Uncomment filtering logic in PolicyAwareToolService.getAvailableTools()"
echo "  - Tools will be actively filtered based on policy intersection"
echo "  - Group configuration UI will show only policy-allowed tools"
echo ""
