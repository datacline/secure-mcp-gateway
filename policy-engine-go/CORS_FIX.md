# CORS Fix for Policy Management UI

## Problem
Frontend (running on http://localhost:3000) was getting CORS errors when trying to access the Policy Engine API.

## Solution
Added CORS middleware to all Policy Engine entry points using `gin-contrib/cors`.

## Changes Made

### 1. Updated go.mod
Added the CORS package:
```go
github.com/gin-contrib/cors v1.7.2
```

### 2. Updated All Main Files
Added CORS configuration to:
- `cmd/server/main.go` (Combined service)
- `cmd/evaluation/main.go` (Evaluation-only service)
- `cmd/management/main.go` (Management-only service)

### 3. CORS Configuration
```go
router.Use(cors.New(cors.Config{
    AllowOrigins:     []string{
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000"
    },
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
    ExposeHeaders:    []string{"Content-Length"},
    AllowCredentials: true,
    MaxAge:           12 * time.Hour,
}))
```

## How to Apply

### Step 1: Download Dependencies
```bash
cd policy-engine-go
go mod tidy
```

### Step 2: Rebuild
```bash
make build
```

Or build specific services:
```bash
make build-combined      # Combined service
make build-management    # Management only
make build-evaluation    # Evaluation only
```

### Step 3: Restart the Service

**If running locally:**
```bash
# Stop current service (Ctrl+C)

# Start combined service
./bin/policy-engine

# OR start management-only service
./bin/policy-management
```

**If running with Docker:**
```bash
# Rebuild and restart
make docker-build
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

**If running with Make:**
```bash
make run
```

### Step 4: Test CORS

Open browser console (F12) and check:
- ✅ No more CORS errors
- ✅ API calls succeed with 200 status
- ✅ Health check works: http://localhost:9000/health

### Step 5: Test Frontend

```bash
cd ../frontend
npm run dev
```

Then open http://localhost:3000 and:
- ✅ Dashboard loads
- ✅ Policy list loads
- ✅ Create policy works
- ✅ No CORS errors in console

## Allowed Origins

The CORS configuration allows requests from:
- `http://localhost:3000` (default Vite dev server)
- `http://localhost:3001` (alternative port)
- `http://127.0.0.1:3000` (alternative localhost)

### To Add More Origins

Edit the CORS config in main.go files:
```go
AllowOrigins: []string{
    "http://localhost:3000",
    "http://yourdomain.com",
    "https://production.com",
},
```

### For Production

Use environment variables for allowed origins:
```go
origins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
if len(origins) == 0 {
    origins = []string{"http://localhost:3000"}
}

router.Use(cors.New(cors.Config{
    AllowOrigins: origins,
    // ... rest of config
}))
```

Then set:
```bash
export ALLOWED_ORIGINS="https://app.yourdomain.com,https://admin.yourdomain.com"
```

## Testing

### Test Health Endpoint
```bash
curl -i http://localhost:9000/health
```

Should see CORS headers:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

### Test with Frontend
```bash
# Terminal 1: Policy Engine
cd policy-engine-go
./bin/policy-engine

# Terminal 2: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000 - No CORS errors!

## Troubleshooting

### Still Getting CORS Errors?

1. **Check service is running:**
   ```bash
   curl http://localhost:9000/health
   ```

2. **Check you rebuilt:**
   ```bash
   # Make sure binary is fresh
   ls -lh bin/policy-engine
   make build
   ```

3. **Check the port:**
   - Frontend expects API on port 9000
   - Check `.env.local`: `VITE_API_URL=http://localhost:9000`

4. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or open in incognito mode

5. **Check browser console:**
   - Look for the actual error message
   - Verify the request URL is correct

### Port Mismatch?

If your Policy Engine runs on a different port:

**Update frontend `.env.local`:**
```bash
VITE_API_URL=http://localhost:YOUR_PORT
```

**Update CORS config in main.go:**
```go
AllowOrigins: []string{
    "http://localhost:3000",
    // add any other origins
},
```

---

## Summary

✅ CORS middleware added to all services
✅ Frontend origins whitelisted
✅ All HTTP methods allowed
✅ Credentials support enabled
✅ 12-hour cache for preflight requests

**Next Step**: Run `go mod tidy && make build` and restart the service!
