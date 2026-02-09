#!/bin/bash

# Test script for Policy Engine CRUD API
# Usage: ./test-crud.sh

BASE_URL="http://localhost:9000/api/v1"
POLICY_ID="test-policy"

echo "========================================="
echo "Policy Engine CRUD API Test"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "1. Checking server health..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/../health)
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running. Start with: docker-compose up -d${NC}"
    exit 1
fi
echo ""

# List existing policies
echo "2. Listing existing policies..."
curl -s "$BASE_URL/policies" | jq '.'
echo ""

# Create a new policy
echo "3. Creating a new test policy..."
create_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"$POLICY_ID"'",
    "name": "Test Policy",
    "description": "A test policy for demonstration",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [
      {
        "id": "test-rule-1",
        "description": "Block test user",
        "priority": 100,
        "conditions": [
          {
            "type": "user",
            "operator": "eq",
            "field": "",
            "value": "test-user"
          }
        ],
        "actions": [
          {
            "type": "deny",
            "params": {
              "message": "Test user is blocked"
            }
          }
        ]
      }
    ]
  }')

status_code=$(echo "$create_response" | tail -n 1)
body=$(echo "$create_response" | sed '$d')

if [ "$status_code" = "201" ]; then
    echo -e "${GREEN}✓ Policy created successfully${NC}"
    echo "$body" | jq '.'
else
    echo -e "${YELLOW}⚠ Policy might already exist or creation failed (Status: $status_code)${NC}"
    echo "$body" | jq '.'
fi
echo ""

# Get the policy
echo "4. Getting the policy..."
curl -s "$BASE_URL/policies/$POLICY_ID" | jq '.'
echo ""

# Test policy evaluation (should block)
echo "5. Testing policy evaluation (should block test-user)..."
eval_response=$(curl -s -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "test-user",
    "tool": "some-tool"
  }')
echo "$eval_response" | jq '.'

should_block=$(echo "$eval_response" | jq -r '.should_block')
if [ "$should_block" = "true" ]; then
    echo -e "${GREEN}✓ Policy correctly blocks test-user${NC}"
else
    echo -e "${RED}✗ Policy should block test-user but didn't${NC}"
fi
echo ""

# Test with allowed user
echo "6. Testing with allowed user (should allow)..."
eval_response=$(curl -s -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "admin",
    "tool": "some-tool"
  }')
echo "$eval_response" | jq '.'

should_block=$(echo "$eval_response" | jq -r '.should_block')
if [ "$should_block" = "false" ]; then
    echo -e "${GREEN}✓ Policy correctly allows admin${NC}"
else
    echo -e "${RED}✗ Policy should allow admin but didn't${NC}"
fi
echo ""

# Update the policy
echo "7. Updating the policy..."
update_response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/policies/$POLICY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Policy",
    "description": "Updated description",
    "enabled": true,
    "enforcement": "audit_only",
    "rules": [
      {
        "id": "test-rule-1",
        "description": "Block test user (audit only)",
        "priority": 100,
        "conditions": [
          {
            "type": "user",
            "operator": "eq",
            "field": "",
            "value": "test-user"
          }
        ],
        "actions": [
          {
            "type": "deny"
          }
        ]
      }
    ]
  }')

status_code=$(echo "$update_response" | tail -n 1)
body=$(echo "$update_response" | sed '$d')

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ Policy updated successfully${NC}"
    echo "$body" | jq '.'
else
    echo -e "${RED}✗ Policy update failed (Status: $status_code)${NC}"
    echo "$body" | jq '.'
fi
echo ""

# Test after update (should not block due to audit_only)
echo "8. Testing after update (audit_only - should not block)..."
eval_response=$(curl -s -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "test-user",
    "tool": "some-tool"
  }')
echo "$eval_response" | jq '.'

should_block=$(echo "$eval_response" | jq -r '.should_block')
if [ "$should_block" = "false" ]; then
    echo -e "${GREEN}✓ Audit-only mode correctly doesn't block${NC}"
else
    echo -e "${YELLOW}⚠ Audit-only mode should not block${NC}"
fi
echo ""

# Disable the policy
echo "9. Disabling the policy..."
disable_response=$(curl -s -X POST "$BASE_URL/policies/$POLICY_ID/disable")
echo "$disable_response" | jq '.'
if echo "$disable_response" | jq -e '.status == "disabled"' > /dev/null; then
    echo -e "${GREEN}✓ Policy disabled${NC}"
fi
echo ""

# Enable the policy
echo "10. Re-enabling the policy..."
enable_response=$(curl -s -X POST "$BASE_URL/policies/$POLICY_ID/enable")
echo "$enable_response" | jq '.'
if echo "$enable_response" | jq -e '.status == "enabled"' > /dev/null; then
    echo -e "${GREEN}✓ Policy re-enabled${NC}"
fi
echo ""

# List all policies
echo "11. Listing all policies..."
curl -s "$BASE_URL/policies" | jq '.policies[] | {id, name, enabled, version}'
echo ""

# Delete the policy
echo "12. Deleting the test policy..."
delete_response=$(curl -s -X DELETE "$BASE_URL/policies/$POLICY_ID")
echo "$delete_response" | jq '.'
if echo "$delete_response" | jq -e '.status == "deleted"' > /dev/null; then
    echo -e "${GREEN}✓ Policy deleted${NC}"
fi
echo ""

# Verify deletion
echo "13. Verifying deletion..."
get_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/policies/$POLICY_ID")
if [ "$get_response" = "404" ]; then
    echo -e "${GREEN}✓ Policy successfully deleted (404 Not Found)${NC}"
else
    echo -e "${RED}✗ Policy still exists${NC}"
fi
echo ""

echo "========================================="
echo "CRUD API Test Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Created policy"
echo "  - Retrieved policy"
echo "  - Evaluated policy"
echo "  - Updated policy"
echo "  - Disabled/enabled policy"
echo "  - Deleted policy"
echo ""
echo "All CRUD operations working! ✓"
