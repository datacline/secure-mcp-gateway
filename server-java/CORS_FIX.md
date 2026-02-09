# CORS Fix for MCP Configuration API

## Problem

When trying to save MCP configuration from the frontend, you get a CORS error like:

```
Access to XMLHttpRequest at 'http://localhost:8000/mcp/servers/notion/config' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
The value of the 'Access-Control-Allow-Credentials' header in the response 
is '' which must be 'true' when the request's credentials mode is 'include'.
```

## Root Cause

The original CORS configuration used:
- `allowedOrigins("*")` - Wildcard origin
- `allowCredentials(false)` - No credentials allowed

This doesn't work because:
1. When credentials are needed, you **cannot** use wildcard (`*`) origins
2. The frontend needs to send `Authorization` headers (credentials)

## Solution

Updated `WebFluxConfig.java` to:

### **Before** ❌
```java
registry.addMapping("/**")
    .allowedOrigins("*")
    .allowedMethods("*")
    .allowedHeaders("*")
    .allowCredentials(false)
    .maxAge(3600);
```

### **After** ✅
```java
registry.addMapping("/**")
    .allowedOriginPatterns(
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://[::1]:*"
    )
    .allowedMethods(
        "GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"
    )
    .allowedHeaders(
        "Origin", "Content-Type", "Accept", "Authorization",
        "X-Requested-With", "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    )
    .exposedHeaders(
        "Content-Length", "Content-Type", "X-Content-Type-Options"
    )
    .allowCredentials(true)
    .maxAge(7200);
```

## Key Changes

1. **`allowedOriginPatterns` instead of `allowedOrigins`**
   - Supports pattern matching like `http://localhost:*`
   - Works with any port on localhost (3000, 3001, 5173, etc.)

2. **`allowCredentials(true)`**
   - Allows sending cookies and authorization headers
   - Required for authenticated API calls

3. **Explicit methods**
   - Lists all HTTP methods explicitly
   - Includes OPTIONS for preflight requests

4. **Explicit headers**
   - Includes `Authorization` header
   - Required for JWT/Bearer tokens

5. **Exposed headers**
   - Allows frontend to read response headers

6. **Longer maxAge**
   - 2 hours cache for preflight requests
   - Reduces OPTIONS requests

## Test the Fix

### **1. Restart Java Gateway**

```bash
cd server-java
./mvnw spring-boot:run
```

### **2. Test from Browser Console**

Open `http://localhost:3000` and run:

```javascript
fetch('http://localhost:8000/mcp/servers', {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Should return server list without CORS error.

### **3. Test Configuration Update**

```javascript
fetch('http://localhost:8000/mcp/servers/notion/config', {
  method: 'PUT',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token-here'
  },
  body: JSON.stringify({
    url: 'http://localhost:8081/mcp',
    type: 'http',
    enabled: true
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Should return success without CORS error.

### **4. Test from Frontend UI**

1. Navigate to MCP Servers
2. Click any server
3. Click Configure tab
4. Change any field
5. Click Save Configuration
6. Should save without CORS error

## Verification

Check browser Network tab:

### **OPTIONS Preflight Request** (should see):
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, ...
Access-Control-Max-Age: 7200
```

### **Actual Request** (should see):
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

## Supported Origins

The configuration now supports:
- ✅ `http://localhost:3000` (default frontend)
- ✅ `http://localhost:3001` (alternative port)
- ✅ `http://localhost:5173` (Vite default)
- ✅ `http://localhost:8080` (any port)
- ✅ `http://127.0.0.1:3000` (IP address)
- ✅ `http://[::1]:3000` (IPv6 localhost)

## Production Considerations

For production, you should:

1. **Use environment variable for origins**:
   ```java
   @Value("${cors.allowed-origins}")
   private String allowedOrigins;
   
   registry.addMapping("/**")
       .allowedOriginPatterns(allowedOrigins.split(","))
       // ...
   ```

2. **In `application.yml`**:
   ```yaml
   cors:
     allowed-origins: https://app.example.com,https://admin.example.com
   ```

3. **Don't use patterns in production**:
   - Use explicit origins
   - No wildcards
   - HTTPS only

## Troubleshooting

### **Still getting CORS error?**

1. **Clear browser cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear site data in DevTools

2. **Check Java Gateway restarted**:
   ```bash
   curl http://localhost:8000/actuator/health
   ```

3. **Check frontend origin**:
   - Open DevTools Network tab
   - Look at request Origin header
   - Make sure it matches allowed patterns

4. **Check request has credentials**:
   ```javascript
   // Make sure frontend uses:
   credentials: 'include'
   ```

### **CORS still failing for specific request?**

Check the request method:
- Is it in the allowed methods list?
- Is it sending OPTIONS preflight?

Check the headers:
- Is the header in the allowed headers list?
- Add it if missing

## Summary

✅ **CORS configured for all localhost ports**  
✅ **Credentials enabled (Authorization header works)**  
✅ **All HTTP methods allowed**  
✅ **All necessary headers allowed**  
✅ **Preflight requests cached for 2 hours**  

**Just restart the Java Gateway and the CORS error should be gone!** 🎉
