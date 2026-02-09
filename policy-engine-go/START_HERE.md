# 🚀 Policy Engine - START HERE

## Choose Your Path

### Path 1: I Want to Use It NOW (Combined Mode)

```bash
# 1. Navigate to directory
cd policy-engine-go

# 2. Start the service
docker-compose up -d

# 3. Verify it's running
curl http://localhost:9000/health

# 4. Test it
./test-crud.sh
```

**Done!** All endpoints available on port 9000.

---

### Path 2: I Want Production Split Mode

```bash
# 1. Navigate to directory
cd policy-engine-go

# 2. Start split services
make docker-run-split

# 3. Verify services
curl http://localhost:9001/health  # Evaluation
curl http://localhost:9002/health  # Management

# 4. Test
curl -X POST http://localhost:9001/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"admin","tool":"test"}'
```

**Done!** Evaluation on 9001, Management on 9002.

---

### Path 3: I Want to Understand the Architecture

**Read in this order**:

1. **REORGANIZATION_COMPLETE.md** ← Start here for overview
2. **ARCHITECTURE.md** ← Detailed architecture
3. **DEPLOYMENT_GUIDE.md** ← Step-by-step deployment
4. **REORGANIZATION_SUMMARY.md** ← Code changes

---

## Quick Command Reference

### Build

```bash
make build                  # All binaries
make build-evaluation       # Evaluation only
make build-management       # Management only
```

### Run Locally

```bash
make run                    # Combined
make run-evaluation         # Evaluation only
make run-management         # Management only
```

### Docker

```bash
make docker-run             # Combined (9000)
make docker-run-split       # Split (9001, 9002)
make docker-stop            # Stop all
```

### Test

```bash
make test                   # Unit tests
make test-crud              # API tests
```

---

## What's Available

### Combined Mode (Port 9000)

✅ `POST /api/v1/evaluate`  
✅ `POST /api/v1/evaluate/batch`  
✅ `GET /api/v1/policies`  
✅ `POST /api/v1/policies`  
✅ `PUT /api/v1/policies/:id`  
✅ `DELETE /api/v1/policies/:id`  
✅ All health endpoints  

### Evaluation Mode (Port 9001)

✅ `POST /api/v1/evaluate`  
✅ `POST /api/v1/evaluate/batch`  
✅ Health endpoints  
❌ Management endpoints  

### Management Mode (Port 9002)

✅ `GET /api/v1/policies`  
✅ `POST /api/v1/policies`  
✅ `PUT /api/v1/policies/:id`  
✅ `DELETE /api/v1/policies/:id`  
✅ All policy operations  
✅ Health endpoints  
❌ Evaluation endpoints  

---

## Which Mode Should I Use?

### Use Combined If:
- ✅ Development / testing
- ✅ Low traffic (<100 req/s)
- ✅ Simple deployment
- ✅ Getting started

### Use Split If:
- ✅ Production
- ✅ High traffic (>1000 req/s)
- ✅ Need independent scaling
- ✅ Security isolation

---

## Help!

### Service Won't Start

```bash
# Check logs
docker-compose logs

# Check ports
lsof -i :9000
```

### Can't Connect

```bash
# Verify it's running
docker ps | grep policy

# Check health
curl http://localhost:9000/health
```

### Need More Help

- See `README.md` for complete docs
- See `DEPLOYMENT_GUIDE.md` for deployment help
- See `ARCHITECTURE.md` for technical details

---

## Next Steps

1. ✅ **Start the service** (above)
2. ✅ **Test CRUD API**: `./test-crud.sh`
3. ✅ **Create your first policy**: See `API_CRUD.md`
4. ✅ **Read architecture**: See `ARCHITECTURE.md`
5. ✅ **Deploy to production**: See `DEPLOYMENT_GUIDE.md`

---

**🎯 You're ready to go!** Pick a path above and start using the Policy Engine.
