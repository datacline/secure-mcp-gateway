# VS Code MCP Client Setup with OAuth2 Authentication

Complete guide for setting up VS Code as an authenticated MCP client to connect to the Secure MCP Gateway using Keycloak OAuth2 authentication.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Keycloak Client for VS Code](#step-1-create-keycloak-client-for-vs-code)
3. [Step 2: Configure Client Scopes](#step-2-configure-client-scopes)
4. [Step 3: Create Test User](#step-3-create-test-user)
5. [Step 4: Configure VS Code MCP Settings](#step-4-configure-vs-code-mcp-settings)
6. [Step 5: Authenticate and Connect](#step-5-authenticate-and-connect)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Secure MCP Gateway running with OAuth enabled (`AUTH_ENABLED=true` in `.env`)
- ✅ Keycloak running and accessible at `http://localhost:8080`
- ✅ VS Code with MCP extension installed
- ✅ `mcp-gateway` realm created in Keycloak
- ✅ Access to Keycloak Admin Console

### Verify Services are Running

```bash
# Check if all containers are running
docker-compose ps

# Expected output:
# mcp-gateway         running
# mcp-gateway-keycloak running
# mcp-gateway-db       running

# Check MCP Gateway health
curl http://localhost:8000/health

# Check Keycloak is accessible
curl http://localhost:8080/realms/mcp-gateway/.well-known/openid-configuration
```

---

## Step 1: Create Keycloak Client for VS Code

### 1.1 Access Keycloak Admin Console

1. Open browser and navigate to: **http://localhost:8080**
2. Click **"Administration Console"**
3. Login with admin credentials:
   - Username: `admin`
   - Password: `admin`

### 1.2 Select the MCP Gateway Realm

1. Click the dropdown in the top-left (currently shows "Master")
2. Select **"mcp-gateway"** realm

### 1.3 Create New Client

1. Click **"Clients"** in the left sidebar
2. Click **"Create client"** button
3. Fill in the **General Settings**:
   - **Client type**: `OpenID Connect`
   - **Client ID**: `vscode-mcp-client`
   - **Name**: `VS Code MCP Client`
   - **Description**: `OAuth2 client for VS Code MCP extension`
   - **Always display in UI**: `ON` (optional)

4. Click **"Next"**

### 1.4 Configure Capability Config

1. **Authentication flow**:
   - ✅ Standard flow (Authorization Code Flow)
   - ❌ Direct access grants
   - ❌ Implicit flow
   - ❌ Service accounts roles

2. Click **"Next"**

### 1.5 Configure Login Settings

1. **Root URL**: (leave empty)
2. **Home URL**: (leave empty)
3. **Valid redirect URIs**: Add both:
   ```
   http://127.0.0.1:*
   http://localhost:*
   https://vscode.dev/redirect
   https://insiders.vscode.dev/redirect
   ```
   > **Important**: The `*` wildcard allows any port, which is required because VS Code uses random ports for OAuth callbacks.

4. **Valid post logout redirect URIs**:
   `
   Leave Empty
   `

5. **Web origins**: Add:
   ```
   http://127.0.0.1:33418
   http://127.0.0.1/
   https://vscode.dev
   https://insiders.vscode.dev
   ```
6. Click **"Save"**

### 1.6 Configure Client Settings

1. After saving, go to the **"Settings"** tab
2. Verify the following:
   - **Client authentication**: `OFF` (this makes it a public client)
   - **Authorization**: `OFF`
   - **Standard flow enabled**: `ON`
   - **Direct access grants enabled**: `OFF`
   - **Implicit flow enabled**: `OFF`
   - **Service accounts roles enabled**: `OFF`
   - **OAuth 2.0 Device Authorization Grant enabled**: `OFF`

3. **Advanced Settings** → **Proof Key for Code Exchange Code Challenge Method**:
   - Set to: `S256` (SHA-256)

4. Click **"Save"**

---

## Step 2: Configure Client Scopes

### 2.1 Create MCP Tools Scope

1. Click **"Client scopes"** in the left sidebar
2. Click **"Create client scope"**
3. Fill in:
   - **Name**: `mcp:tools`
   - **Description**: `Access to MCP tools and resources`
   - **Type**: `Optional`
   - **Display on consent screen**: `ON`
   - **Include in token scope**: `ON`

4. Click **"Save"**

### 2.2 Add Audience Mapper to mcp:tools Scope

This is **critical** - it adds the custom audience to the access token.

1. Stay in the `mcp:tools` client scope settings
2. Click the **"Mappers"** tab
3. Click **"Add mapper"** → **"By configuration"**
4. Select **"Audience"**
5. Fill in the mapper configuration:
   - **Name**: `mcp-audience`
   - **Mapper type**: `Audience`
   - **Included Client Audience**: (leave empty)
   - **Included Custom Audience**: `http://localhost:8000/mcp`
   - **Add to ID token**: `ON`
   - **Add to access token**: `ON`

6. Click **"Save"**

> **Why is this important?** The MCP Gateway validates that the JWT token's `aud` (audience) claim matches `http://localhost:8000/mcp`. This prevents token reuse attacks where tokens issued for other services could be misused.

### 2.3 Assign Scopes to VS Code Client

1. Click **"Clients"** in the left sidebar
2. Click on **"vscode-mcp-client"**
3. Click the **"Client scopes"** tab
4. Click **"Add client scope"**
5. Find and select **"mcp:tools"**
6. Choose **"Default"** (not Optional)
7. Click **"Add"**

### 2.4 Verify Default Scopes

Ensure these default scopes are assigned:
- ✅ `openid`
- ✅ `profile`
- ✅ `email`
- ✅ `mcp:tools`

These will all be included in the OAuth flow automatically.

---

## Step 3: Create Test User 
(This is only if you want to create a new user, testuser is already created when you run `make` command)

### 3.1 Create User Account

1. Click **"Users"** in the left sidebar
2. Click **"Create new user"** (This is only if you want to create a new user, testuser is already created when you run `make` command)
3. Fill in:
   - **Username**: `testuser`
   - **Email**: `testuser@example.com`
   - **First name**: `Test`
   - **Last name**: `User`
   - **Email verified**: `ON`
   - **Enabled**: `ON`

4. Click **"Create"**

### 3.2 Set User Password

1. After creating the user, click the **"Credentials"** tab
2. Click **"Set password"**
3. Fill in:
   - **Password**: `testpassword`
   - **Password confirmation**: `testpassword`
   - **Temporary**: `OFF` (so user doesn't need to change password on first login)

4. Click **"Save"**
5. Confirm **"Set password"** in the dialog

### 3.3 Assign Role (Optional)

If you have role-based access control:
1. Click the **"Role mapping"** tab
2. Click **"Assign role"**
3. Select appropriate roles
4. Click **"Assign"**

---

## Step 4: Configure VS Code MCP Settings

### 4.1 Locate MCP Configuration File

The VS Code MCP configuration is stored in:

**macOS/Linux:**
```bash
~/.config/Code/User/mcp.json
# or
~/Library/Application Support/Code/User/mcp.json
```

**Windows:**
```
%APPDATA%\Code\User\mcp.json
```

### 4.2 Create/Edit mcp.json

Open or create `mcp.json` with the following content:

```json
{
  "servers": {
    "secure-mcp-gateway": {
      "url": "http://localhost:8000/mcp",
      "transport": {
        "type": "http"
      },
      "oauth": {
        "authorizationUrl": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/auth",
        "tokenUrl": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token",
        "clientId": "vscode-mcp-client",
        "scopes": ["openid", "mcp:tools"]
      }
    }
  },
  "input": []
}
```

**Configuration Breakdown:**

- `servers` → Object containing all MCP server configurations
- `secure-mcp-gateway` → Unique identifier for this server
- `url` → MCP Gateway endpoint URL
- `transport.type` → Use HTTP transport (vs stdio)
- `oauth.authorizationUrl` → Keycloak authorization endpoint
- `oauth.tokenUrl` → Keycloak token endpoint
- `oauth.clientId` → Must match the Keycloak client ID
- `oauth.scopes` → Required OAuth scopes

### 4.3 Alternative: Configuration Without OAuth Block

If VS Code has cached credentials and you need to trigger the manual client ID input:

```json
{
  "servers": {
    "secure-mcp-gateway": {
      "url": "http://localhost:8000/mcp",
      "transport": {
        "type": "http"
      }
    }
  },
  "input": []
}
```

> VS Code will discover OAuth settings from the server's `initialize` response and prompt for client ID if needed.

### 4.4 Save and Reload VS Code

1. Save the `mcp.json` file
2. **Completely restart VS Code** (not just reload window)
   - macOS: `Cmd + Q` then reopen
   - Windows: `Alt + F4` then reopen
   - Linux: Close all windows and reopen

---

## Step 5: Authenticate and Connect

### 5.1 Initial Connection Attempt

1. Open VS Code
2. Open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Type **"MCP"** to see MCP-related commands
4. Look for **"MCP: Connect to Server"** or similar

Alternatively, the MCP extension may auto-connect on startup.

### 5.2 OAuth Flow

When VS Code attempts to connect, the following will happen:

1. **Discovery Phase:**
   - VS Code calls `GET /mcp` to discover server capabilities
   - Server returns OAuth configuration

2. **Authentication Redirect:**
   - VS Code opens your default browser
   - Browser navigates to Keycloak login page
   - URL will look like:
     ```
     http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/auth
     ?client_id=vscode-mcp-client
     &response_type=code
     &code_challenge=...
     &code_challenge_method=S256
     &scope=openid+profile+email+mcp:tools
     &resource=http://localhost:8000/mcp
     &redirect_uri=http://127.0.0.1:12345/
     &state=...
     ```

3. **Login to Keycloak:**
   - Enter username: `testuser`
   - Enter password: `testpass`
   - Click **"Sign In"**

4. **Grant Consent (if prompted):**
   - Review the requested permissions
   - Click **"Yes"** or **"Allow"** to grant access

5. **Redirect Back to VS Code:**
   - Browser will redirect to `http://127.0.0.1:<port>/`
   - You may see a message like "You can close this window"
   - Return to VS Code

### 5.3 Verify Connection

After successful authentication:

1. VS Code should show **"Connected"** status for the MCP server
2. Check VS Code's Output panel:
   - Open Output: `View` → `Output`
   - Select **"MCP"** from the dropdown
   - You should see logs like:
     ```
     [info] Connection state: Running
     [info] Populated auth metadata
     [info] Successfully authenticated
     ```

3. Test the connection:
   - Try using MCP tools
   - Access prompts or resources provided by the gateway

### 5.4 Check MCP Gateway Logs

Verify successful authentication on the server side:

```bash
docker-compose logs mcp-gateway | tail -50
```

Expected logs:
```
INFO - MCP RPC request: initialize
INFO - Initialize response includes OAuth configuration
INFO - MCP RPC request: notifications/initialized
INFO - Received notification: notifications/initialized
INFO - MCP RPC request: tools/list
INFO - Successfully validated JWT token for user: testuser
INFO - Authenticated MCP request: user=testuser, client=vscode-mcp-client
```

---

## Troubleshooting

### Issue 1: VS Code Uses Wrong Client ID

**Symptom:** Browser opens with URL containing a UUID client ID like `client_id=37ee826b-...` instead of `client_id=vscode-mcp-client`.

**Cause:** VS Code cached OAuth credentials from a previous authentication attempt.

**Solution:**
1. Clear VS Code's OAuth cache (method varies by OS)
2. Delete the `mcp.json` OAuth block temporarily
3. Restart VS Code completely
4. VS Code should prompt for manual client ID entry
5. Enter: `vscode-mcp-client`
6. Optionally restore OAuth block to `mcp.json` for future use

### Issue 2: "Invalid Redirect URI" Error

**Symptom:** Keycloak shows error: "Invalid parameter: redirect_uri"

**Cause:** The redirect URI used by VS Code is not whitelisted in Keycloak.

**Solution:**
1. Go to Keycloak Admin Console
2. Navigate to: Clients → vscode-mcp-client → Settings
3. Ensure Valid Redirect URIs includes:
   ```
   http://127.0.0.1:*
   http://localhost:*
   ```
4. Click "Save"

### Issue 3: "Invalid Issuer" Error in MCP Gateway Logs

**Symptom:** Gateway logs show:
```
ERROR - JWT validation failed: Invalid issuer
```

**Cause:** JWT token issuer doesn't match expected issuer.

**Solution:** This should be automatically handled by the gateway's flexible issuer validation. If still occurring:
1. Check `.env` file has: `KEYCLOAK_URL=http://localhost:8080`
2. Rebuild gateway: `docker-compose up -d --build mcp-gateway`
3. Clear browser cookies and retry authentication

### Issue 4: "Invalid Audience" Error

**Symptom:** Gateway logs show:
```
WARNING - Token audience mismatch
```

**Cause:** Token doesn't have the correct audience claim.

**Solution:**
1. Verify the audience mapper in Keycloak:
   - Client Scopes → mcp:tools → Mappers → mcp-audience
   - Included Custom Audience: `http://localhost:8000/mcp`
   - Add to access token: `ON`
2. Get a fresh token by re-authenticating

### Issue 5: "User Did Not Consent to Login"

**Symptom:** VS Code shows error: "User did not consent to login"

**Possible Causes:**
- Browser window was closed before completing login
- OAuth flow was interrupted
- Network connectivity issue

**Solution:**
1. Restart VS Code
2. Try authentication again
3. Complete the full login flow without closing the browser
4. Check network connectivity to Keycloak (`http://localhost:8080`)

### Issue 6: Scope Missing in Token

**Symptom:** Gateway logs show:
```
WARNING - Token missing required scopes: ['mcp:tools']
```

**Cause:** The `mcp:tools` scope wasn't included in the access token.

**Solution:**
1. Verify scope assignment in Keycloak:
   - Clients → vscode-mcp-client → Client Scopes
   - Ensure `mcp:tools` is in "Assigned default client scopes"
2. Check scope mapper:
   - Client Scopes → mcp:tools → Mappers
   - Verify audience mapper exists and is configured correctly
3. Re-authenticate to get a new token

### Issue 7: Connection Works But Tools Don't Load

**Symptom:** VS Code connects successfully but no tools/prompts/resources appear.

**Cause:** The MCP Gateway might not be connected to backend MCP servers.

**Solution:**
1. Check `mcp_servers.yaml` configuration
2. Verify backend MCP servers are running
3. Check gateway logs for connection errors:
   ```bash
   docker-compose logs mcp-gateway | grep ERROR
   ```

### Issue 8: Token Expired

**Symptom:** Connection works initially but fails after some time.

**Cause:** Access token has a limited lifetime (typically 5-60 minutes).

**Solution:**
- VS Code should automatically refresh the token using the refresh token
- If refresh fails, re-authenticate:
  1. Disconnect from MCP server
  2. Reconnect (will trigger new OAuth flow)

### Enable Debug Logging

For more detailed troubleshooting:

**VS Code:**
1. Open Output panel (`View` → `Output`)
2. Select "MCP" from dropdown
3. Look for detailed connection logs

**MCP Gateway:**
```bash
# Watch live logs
docker-compose logs -f mcp-gateway

# Filter for authentication-related logs
docker-compose logs mcp-gateway | grep -E "(auth|JWT|OAuth)"

# Check last 100 lines
docker-compose logs --tail=100 mcp-gateway
```

**Keycloak:**
```bash
# Check Keycloak logs
docker-compose logs keycloak | grep -E "(vscode-mcp-client|testuser)"
```

---

## Testing Checklist

Use this checklist to verify your setup:

- [ ] Keycloak is accessible at http://localhost:8080
- [ ] `vscode-mcp-client` client exists in `mcp-gateway` realm
- [ ] Client is configured as **Public** (Client Authentication: OFF)
- [ ] Valid Redirect URIs include `http://127.0.0.1:*` and `http://localhost:*`
- [ ] `mcp:tools` client scope exists
- [ ] Audience mapper in `mcp:tools` has custom audience: `http://localhost:8000/mcp`
- [ ] `mcp:tools` is assigned as default scope to `vscode-mcp-client`
- [ ] Test user (`testuser`) exists with password set
- [ ] MCP Gateway is running (`docker-compose ps`)
- [ ] `mcp.json` is correctly configured with OAuth settings
- [ ] VS Code is completely restarted after config changes
- [ ] Browser opens Keycloak login page with correct `client_id=vscode-mcp-client`
- [ ] Login succeeds and redirects back to VS Code
- [ ] VS Code shows "Connected" status
- [ ] Gateway logs show successful JWT validation
- [ ] Tools/prompts/resources are accessible in VS Code

---

## Security Best Practices

1. **Use HTTPS in Production:**
   - Replace `http://localhost:8080` with `https://your-keycloak-domain.com`
   - Replace `http://localhost:8000` with `https://your-gateway-domain.com`
   - Update redirect URIs accordingly

2. **Rotate Secrets Regularly:**
   - Change test user passwords periodically
   - Rotate Keycloak admin password

3. **Limit Token Lifetime:**
   - Set reasonable access token lifespan (15-60 minutes)
   - Configure refresh token rotation

4. **Review Granted Permissions:**
   - Regularly audit client scope assignments
   - Remove unnecessary permissions

5. **Monitor Authentication Logs:**
   - Check Keycloak logs for suspicious activity
   - Monitor failed authentication attempts

6. **Use Strong Passwords:**
   - Enforce password policies in Keycloak
   - Require multi-factor authentication (MFA) for sensitive environments

---

## Quick Reference

### Keycloak Admin Console
- URL: http://localhost:8080
- Username: `admin`
- Password: `admin`
- Realm: `mcp-gateway`

### Test User Credentials
- Username: `testuser`
- Password: `testpassword`

### Client Configuration
- Client ID: `vscode-mcp-client`
- Client Type: Public (no secret)
- Redirect URIs: `http://127.0.0.1:*`, `http://localhost:*`
- Scopes: `openid`, `profile`, `email`, `mcp:tools`

### MCP Gateway
- URL: http://localhost:8000/mcp
- Health Check: http://localhost:8000/health
- OAuth Metadata: http://localhost:8000/.well-known/oauth-protected-resource

### Useful Commands
```bash
# Restart gateway
docker-compose restart mcp-gateway

# Rebuild gateway
docker-compose up -d --build mcp-gateway

# View logs
docker-compose logs -f mcp-gateway

# Check running containers
docker-compose ps

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

---

## Next Steps

After successfully connecting VS Code to the MCP Gateway:

1. **Explore Available Tools:**
   - Use VS Code's MCP interface to browse available tools
   - Test tool execution with authentication

2. **Connect Additional MCP Servers:**
   - Add backend MCP servers to `mcp_servers.yaml`
   - Configure tool aggregation

3. **Set Up Additional Clients:**
   - Create clients for Claude Desktop, custom applications, etc.
   - Follow similar OAuth setup process

4. **Production Deployment:**
   - Move to HTTPS endpoints
   - Configure proper DNS and certificates
   - Set up production-grade Keycloak instance
   - Implement monitoring and alerting

5. **Advanced Configuration:**
   - Fine-grained role-based access control (RBAC)
   - Custom claims in JWT tokens
   - Token exchange for service-to-service auth

---

## Additional Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP OAuth Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth Troubleshooting Guide](./OAUTH_TROUBLESHOOTING.md)
