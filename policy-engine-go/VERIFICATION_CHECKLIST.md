# Policy Engine Reorganization - Verification Checklist

## Quick Verification (5 minutes)

Run these commands to verify the reorganization is complete and working:

### Step 1: Verify File Structure

```bash
cd policy-engine-go

# Check new service layer files exist
ls -la internal/services/evaluation/service.go
ls -la internal/services/management/service.go

# Check new API layer files exist
ls -la internal/api/evaluation/handler.go
ls -la internal/api/management/handler.go
ls -la internal/api/health/handler.go

# Check new config file exists
ls -la internal/config/config.go

# Check new entry points exist
ls -la cmd/server/main.go
ls -la cmd/evaluation/main.go
ls -la cmd/management/main.go

# Check new Docker files exist
ls -la Dockerfile.split
ls -la docker-compose.split.yml

# Check new documentation exists
ls -la ARCHITECTURE.md
ls -la DEPLOYMENT_GUIDE.md
ls -la START_HERE.md
ls -la REORGANIZATION_COMPLETE.md
ls -la FINAL_SUMMARY.md
ls -la VISUAL_GUIDE.md
```

**Expected**: All files exist ✅

---

### Step 2: Update Dependencies

```bash
# Run go mod tidy to update dependencies
go mod tidy

# Verify no errors
echo $?
# Should output: 0
```

**Expected**: No errors, exit code 0 ✅

---

### Step 3: Build All Binaries

```bash
# Build all three binaries
make build

# Verify binaries were created
ls -lh bin/

# You should see:
# - policy-engine (combined)
# - policy-evaluation (evaluation-only)
# - policy-management (management-only)
```

**Expected**: Three binaries created ✅

---

### Step 4: Test Combined Mode

```bash
# Start combined service
make docker-run

# Wait 5 seconds for startup
sleep 5

# Test health check
curl http://localhost:9000/health

# Expected output:
# {"status":"healthy","service":"policy-engine"}

# Test evaluation endpoint
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"test","tool":"test"}'

# Should return policy evaluation result

# Test management endpoint
curl http://localhost:9000/api/v1/policies

# Should return list of policies

# Stop service
make docker-stop
```

**Expected**: All endpoints work ✅

---

### Step 5: Test Split Mode

```bash
# Start split services
make docker-run-split

# Wait 10 seconds for startup
sleep 10

# Test evaluation service
curl http://localhost:9001/health
# Expected: {"status":"healthy","service":"policy-evaluation"}

curl -X POST http://localhost:9001/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"test","tool":"test"}'
# Should return evaluation result

# Test management service
curl http://localhost:9002/health
# Expected: {"status":"healthy","service":"policy-management"}

curl http://localhost:9002/api/v1/policies
# Should return list of policies

# Stop services
make docker-stop
```

**Expected**: Both services work independently ✅

---

### Step 6: Test Makefile Commands

```bash
# Test all make targets
make help
# Should list all available commands

# Test build targets
make clean
make build-combined
make build-evaluation
make build-management

# Verify all binaries created
ls -lh bin/
```

**Expected**: All make commands work ✅

---

## Detailed Verification

### Code Quality Checks

```bash
# Format code
make fmt

# Run linter (if golangci-lint installed)
make lint

# Run tests
make test

# Expected: All pass
```

---

### Documentation Verification

```bash
# Verify all documentation files exist and are readable
docs=(
  "START_HERE.md"
  "ARCHITECTURE.md"
  "DEPLOYMENT_GUIDE.md"
  "REORGANIZATION_SUMMARY.md"
  "REORGANIZATION_COMPLETE.md"
  "FINAL_SUMMARY.md"
  "VISUAL_GUIDE.md"
  "VERIFICATION_CHECKLIST.md"
  "README.md"
  "QUICKSTART.md"
  "API_CRUD.md"
)

for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    echo "✅ $doc"
  else
    echo "❌ $doc MISSING"
  fi
done
```

---

### Service Independence Test

```bash
# Test that services can run independently

# Test 1: Run evaluation only
make build-evaluation
POLICY_DIR=./policies PORT=9000 ./bin/policy-evaluation &
EVAL_PID=$!
sleep 3

curl http://localhost:9000/api/v1/evaluate \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"user":"test","tool":"test"}'

# Should work ✅

# Test that management endpoints DON'T work
curl http://localhost:9000/api/v1/policies
# Should return 404 ✅

kill $EVAL_PID

# Test 2: Run management only
make build-management
POLICY_DIR=./policies PORT=9000 ./bin/policy-management &
MGMT_PID=$!
sleep 3

curl http://localhost:9000/api/v1/policies
# Should work ✅

# Test that evaluation endpoints DON'T work
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"test","tool":"test"}'
# Should return 404 ✅

kill $MGMT_PID
```

**Expected**: Services are truly independent ✅

---

### Docker Image Build Test

```bash
# Build all Docker images
make docker-build

# Verify images were created
docker images | grep policy

# You should see:
# - policy-engine:latest
# - policy-evaluation:latest
# - policy-management:latest
```

**Expected**: Three Docker images created ✅

---

### Configuration Test

```bash
# Test environment variable configuration

# Test 1: Combined mode (default)
ENABLE_EVALUATION=true ENABLE_MANAGEMENT=true go run cmd/server/main.go &
SERVER_PID=$!
sleep 3
curl http://localhost:9000/health
kill $SERVER_PID

# Test 2: Evaluation only
ENABLE_EVALUATION=true ENABLE_MANAGEMENT=false go run cmd/server/main.go &
SERVER_PID=$!
sleep 3
curl http://localhost:9000/health
# Should say "policy-evaluation" ✅
kill $SERVER_PID

# Test 3: Management only
ENABLE_EVALUATION=false ENABLE_MANAGEMENT=true go run cmd/server/main.go &
SERVER_PID=$!
sleep 3
curl http://localhost:9000/health
# Should say "policy-management" ✅
kill $SERVER_PID
```

**Expected**: Configuration controls service mode ✅

---

## Backward Compatibility Verification

### Test 1: Existing Setup Still Works

```bash
# Use old command (combined mode)
docker-compose up -d

# Test all original endpoints
curl http://localhost:9000/health
curl http://localhost:9000/api/v1/policies
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"test","tool":"test"}'

docker-compose down
```

**Expected**: All original functionality works ✅

### Test 2: CRUD API Still Works

```bash
# Start service
make docker-run
sleep 5

# Run CRUD test script
./test-crud.sh

# Stop service
make docker-stop
```

**Expected**: All CRUD operations work ✅

---

## Performance Verification

### Binary Size Comparison

```bash
make clean
make build

ls -lh bin/ | awk '{print $5, $9}'

# Expected output (approximate):
# 15M policy-engine
# 10M policy-evaluation
#  8M policy-management
```

**Expected**: Specialized binaries are smaller ✅

### Memory Usage Comparison

```bash
# Test combined mode
make docker-run
sleep 5
docker stats --no-stream | grep policy

# Note memory usage of combined service

make docker-stop

# Test split mode
make docker-run-split
sleep 10
docker stats --no-stream | grep policy

# Note memory usage of each service
# Evaluation should use ~50MB
# Management should use ~40MB

make docker-stop
```

**Expected**: Specialized services use less memory ✅

---

## Integration Test

### Full Workflow Test

```bash
# 1. Start split mode
make docker-run-split
sleep 10

# 2. Create a policy via management service
curl -X POST http://localhost:9002/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Verification Policy",
    "enabled": true,
    "enforcement": "blocking",
    "rules": [{
      "id": "test-rule",
      "priority": 100,
      "conditions": [{
        "type": "user",
        "operator": "eq",
        "field": "",
        "value": "blocked-user"
      }],
      "actions": [{
        "type": "deny"
      }]
    }]
  }'

# 3. Wait for sync (immediate in split mode)
sleep 2

# 4. Test evaluation via evaluation service
curl -X POST http://localhost:9001/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"blocked-user","tool":"test"}'

# Should return: should_block: true ✅

# 5. Test with allowed user
curl -X POST http://localhost:9001/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"allowed-user","tool":"test"}'

# Should return: should_block: false ✅

# 6. Delete policy
curl -X DELETE http://localhost:9002/api/v1/policies/Test-Verification-Policy

# 7. Clean up
make docker-stop
```

**Expected**: Full workflow works end-to-end ✅

---

## Final Checklist

### Code

- [ ] All new service files exist
- [ ] All new API files exist
- [ ] All new config files exist
- [ ] All entry points exist
- [ ] All binaries build successfully
- [ ] No compilation errors
- [ ] go mod tidy runs successfully

### Docker

- [ ] Docker images build successfully
- [ ] Combined mode runs
- [ ] Split mode runs
- [ ] Evaluation-only runs
- [ ] Management-only runs
- [ ] All health checks pass

### Functionality

- [ ] Evaluation endpoints work
- [ ] Management endpoints work
- [ ] CRUD operations work
- [ ] Policy sync works
- [ ] Services are independent
- [ ] Configuration controls mode

### Documentation

- [ ] All documentation files exist
- [ ] Documentation is readable
- [ ] Examples work
- [ ] Commands are correct

### Backward Compatibility

- [ ] Old commands still work
- [ ] Existing setup unchanged
- [ ] No breaking changes
- [ ] CRUD test script passes

### Performance

- [ ] Specialized binaries are smaller
- [ ] Memory usage is lower
- [ ] Services start faster
- [ ] No performance regression

---

## Quick Test Script

Save this as `verify-reorganization.sh`:

```bash
#!/bin/bash

echo "Policy Engine Reorganization Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test 1: Files exist
echo "1. Checking file structure..."
if [ -f "internal/services/evaluation/service.go" ] && \
   [ -f "internal/services/management/service.go" ] && \
   [ -f "cmd/evaluation/main.go" ] && \
   [ -f "cmd/management/main.go" ]; then
  echo -e "${GREEN}✓ File structure correct${NC}"
else
  echo -e "${RED}✗ Missing files${NC}"
  exit 1
fi

# Test 2: Build
echo "2. Building binaries..."
if make build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Build successful${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi

# Test 3: Combined mode
echo "3. Testing combined mode..."
make docker-run > /dev/null 2>&1
sleep 5
if curl -s http://localhost:9000/health | grep -q "healthy"; then
  echo -e "${GREEN}✓ Combined mode works${NC}"
else
  echo -e "${RED}✗ Combined mode failed${NC}"
  make docker-stop > /dev/null 2>&1
  exit 1
fi
make docker-stop > /dev/null 2>&1

# Test 4: Split mode
echo "4. Testing split mode..."
make docker-run-split > /dev/null 2>&1
sleep 10
if curl -s http://localhost:9001/health | grep -q "healthy" && \
   curl -s http://localhost:9002/health | grep -q "healthy"; then
  echo -e "${GREEN}✓ Split mode works${NC}"
else
  echo -e "${RED}✗ Split mode failed${NC}"
  make docker-stop > /dev/null 2>&1
  exit 1
fi
make docker-stop > /dev/null 2>&1

echo ""
echo -e "${GREEN}✓✓✓ All tests passed!${NC}"
echo ""
echo "Reorganization verified successfully!"
```

Run it:
```bash
chmod +x verify-reorganization.sh
./verify-reorganization.sh
```

---

## Success Criteria

✅ **All files created**  
✅ **All binaries build**  
✅ **All modes work**  
✅ **Documentation complete**  
✅ **Backward compatible**  
✅ **Performance improved**  

**If all checkboxes above are checked, the reorganization is complete and successful!** 🎉
