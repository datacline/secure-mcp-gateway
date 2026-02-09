# Policy Management UI - Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Install

```bash
cd frontend
npm install
```

### Step 2: Configure

```bash
# Create environment file
cp .env.example .env.local

# Edit if needed (default: http://localhost:9002)
# VITE_API_URL=http://localhost:9002
```

### Step 3: Run

```bash
npm run dev
```

**✅ Done!** Open http://localhost:3000

---

## 📋 Prerequisites

Make sure Policy Engine is running:

```bash
# Check if running
curl http://localhost:9002/health

# If not, start it
cd ../policy-engine-go
make docker-run-management
```

---

## 🎯 What You Can Do

### 1. Dashboard
- View policy statistics
- Check service health
- See recent policies
- Quick create button

**Access**: http://localhost:3000/dashboard

### 2. List Policies
- View all policies
- Search by name/description
- Filter by status
- Quick actions (view/edit/delete/toggle)

**Access**: http://localhost:3000/policies

### 3. Create Policy
- Fill policy name & description
- Set enforcement mode
- Add rules with conditions & actions
- Save and done!

**Access**: http://localhost:3000/policies/new

### 4. View Policy
- See all policy details
- View rules, conditions, actions
- Quick edit/delete/toggle

**Access**: http://localhost:3000/policies/:id

### 5. Edit Policy
- Update any field
- Add/remove rules
- Version auto-increments

**Access**: http://localhost:3000/policies/:id/edit

---

## 📝 Create Your First Policy

**Example: Block Guest Users**

1. Click **"Create Policy"**
2. Enter:
   ```
   Name: Block Guest Users
   Description: Deny all actions from guest user
   Status: Enabled
   Enforcement: blocking
   ```
3. Add Rule:
   ```
   Rule ID: block-guests
   Priority: 100
   
   Condition:
   - type: user
   - operator: eq
   - value: guest
   
   Action:
   - type: deny
   ```
4. Click **"Create Policy"**

**✅ Done!** Your policy is live.

---

## 🐳 Docker Quick Start

```bash
# Build and start
docker-compose up -d

# Access
open http://localhost:3000

# Stop
docker-compose down
```

---

## 🔧 Common Commands

```bash
# Development
npm run dev           # Start dev server (port 3000)
npm run build         # Build for production
npm run preview       # Preview production build

# Code Quality
npm run lint          # Check code issues
npm run format        # Format code with Prettier

# Docker
docker-compose up -d  # Start all services
docker-compose logs   # View logs
docker-compose down   # Stop all services
```

---

## 🔍 API Endpoints Used

```
GET    /api/v1/policies          # List policies
GET    /api/v1/policies/:id      # Get policy
POST   /api/v1/policies          # Create policy
PUT    /api/v1/policies/:id      # Update policy
DELETE /api/v1/policies/:id      # Delete policy
POST   /api/v1/policies/:id/enable   # Enable
POST   /api/v1/policies/:id/disable  # Disable
POST   /api/v1/reload            # Reload from disk
GET    /health                   # Health check
```

---

## ⚠️ Troubleshooting

### Cannot Connect to API

```bash
# 1. Check Policy Engine
curl http://localhost:9002/health

# 2. Check .env.local
cat .env.local

# 3. Restart UI
npm run dev
```

### Port Already in Use

```bash
# Option 1: Kill process
lsof -ti:3000 | xargs kill

# Option 2: Use different port
vite --port 3001
```

### CORS Errors

Policy Engine must allow CORS from http://localhost:3000

---

## 📖 Documentation

- **Full README**: `README.md`
- **Setup Guide**: `SETUP.md`
- **Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **Policy Engine**: `../policy-engine-go/README.md`

---

## ✨ Features

✅ Dashboard with stats  
✅ List all policies  
✅ Search & filter  
✅ Create policies  
✅ Edit policies  
✅ View policy details  
✅ Delete policies  
✅ Enable/disable  
✅ Dynamic rule builder  
✅ Responsive design  
✅ Real-time updates  
✅ Type-safe (TypeScript)  

---

## 🎓 Example Policy Scenarios

### 1. Allow Only Admins

```yaml
Rule: allow-admins
Condition: user in ["admin", "root"]
Action: allow
Priority: 200
```

### 2. Block After Hours

```yaml
Rule: block-after-hours
Condition: time gt hour:18
Action: deny
Priority: 150
```

### 3. Rate Limit API Calls

```yaml
Rule: rate-limit-api
Condition: tool eq "api_call"
Action: rate_limit (limit: 100, window: 60)
Priority: 100
```

---

## 💡 Tips

- **Audit Mode First**: Test policies in audit_only before blocking
- **Higher Priority Wins**: Use 200 for critical rules, 100 for normal
- **Descriptive Names**: Use clear names like "Block-Guest-Users"
- **Test After Create**: Always verify policies work as expected
- **Search Feature**: Use search bar to find policies quickly
- **Reload Button**: Sync changes from disk if modified externally

---

## 🚀 Next Steps

1. ✅ Start the UI (`npm run dev`)
2. ✅ Create a test policy
3. ✅ Try all CRUD operations
4. ✅ Check dashboard stats
5. ✅ Deploy to production (see `README.md`)

---

**Ready to manage policies!** 🎉

**UI**: http://localhost:3000  
**API**: http://localhost:9002  
**Docs**: `README.md`
