# Policy Management UI - Setup Guide

## Quick Setup (5 minutes)

### Option 1: Development Mode (Recommended for testing)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local

# 4. Start development server
npm run dev
```

UI will be available at: http://localhost:3000

### Option 2: Docker (Production-like)

```bash
# 1. Build and start with Docker Compose
cd frontend
docker-compose up -d

# 2. Access UI
open http://localhost:3000
```

## Prerequisites

### For Development Mode
- Node.js 18 or higher
- npm 9 or higher
- Policy Engine running on port 9002

### For Docker Mode
- Docker 20.10+
- Docker Compose 2.0+

## Step-by-Step Setup

### 1. Install Node.js

**macOS:**
```bash
brew install node@18
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download from https://nodejs.org/

Verify installation:
```bash
node --version  # Should be v18+
npm --version   # Should be v9+
```

### 2. Install Dependencies

```bash
cd frontend
npm install
```

This installs:
- React 18
- TypeScript
- Vite
- React Router
- React Query
- Axios
- And more...

### 3. Configure Environment

Create `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Policy Management API (required)
VITE_API_URL=http://localhost:9002

# Optional: Evaluation API for testing
VITE_EVAL_API_URL=http://localhost:9001
```

**Important**: Update `VITE_API_URL` to match your Policy Engine URL.

### 4. Start Policy Engine

The UI needs the Policy Engine Management Service running.

**Option A: Combined Mode**
```bash
cd ../policy-engine-go
docker-compose up -d
# Management API on port 9000
```

**Option B: Management-Only Mode**
```bash
cd ../policy-engine-go
make docker-run-management
# Management API on port 9002
```

Verify it's running:
```bash
curl http://localhost:9002/health
# Should return: {"status":"healthy","service":"policy-management"}
```

### 5. Start UI Development Server

```bash
cd frontend
npm run dev
```

Output:
```
  VITE v5.0.11  ready in 342 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Open http://localhost:3000 in your browser.

## Verification

### 1. Check Dashboard

Navigate to Dashboard - you should see:
- Service Status: ● Healthy
- Total Policies: (number)
- Stats cards populated

### 2. Create a Test Policy

1. Click **"Create Policy"**
2. Enter:
   - Name: "Test Policy"
   - Description: "My first test policy"
   - Add a rule with conditions and actions
3. Click **"Create Policy"**
4. You should be redirected to the policy view

### 3. Verify API Connection

Open browser console (F12) and check for:
- ✅ No CORS errors
- ✅ Successful API calls (200 status)
- ❌ Any 404 or 500 errors

## Troubleshooting

### Cannot Connect to API

**Problem**: "No response from server" error

**Solutions**:

1. **Check Policy Engine is running:**
   ```bash
   curl http://localhost:9002/health
   ```

2. **Check API URL in `.env.local`:**
   ```bash
   cat .env.local
   # Should match Policy Engine URL
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

### CORS Errors

**Problem**: CORS policy blocking requests

**Solution**: Update Policy Engine to allow CORS

Add to Policy Engine configuration (if using Go):
```go
router.Use(cors.New(cors.Config{
    AllowOrigins: []string{"http://localhost:3000"},
    AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
    AllowHeaders: []string{"Content-Type", "Authorization"},
}))
```

### Port 3000 Already in Use

**Problem**: Port 3000 is occupied

**Solution**: Change port in `package.json`:
```json
{
  "scripts": {
    "dev": "vite --port 3001"
  }
}
```

Or kill the process:
```bash
lsof -ti:3000 | xargs kill
```

### Dependencies Won't Install

**Problem**: `npm install` fails

**Solutions**:

1. **Clear cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use specific Node version:**
   ```bash
   nvm install 18
   nvm use 18
   npm install
   ```

### Build Fails

**Problem**: `npm run build` errors

**Solution**:
```bash
# Check TypeScript errors
npm run lint

# Fix formatting
npm run format

# Rebuild
npm run build
```

## Docker Setup

### Build Image

```bash
docker build -t policy-ui:latest .
```

### Run Container

```bash
docker run -d \
  -p 3000:80 \
  -e VITE_API_URL=http://localhost:9002 \
  --name policy-ui \
  policy-ui:latest
```

### With Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f policy-ui

# Stop services
docker-compose down
```

## Production Deployment

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Deploy to Static Hosting

#### Netlify

```bash
# Build command
npm run build

# Publish directory
dist

# Environment variables
VITE_API_URL=https://your-api.com
```

#### Vercel

```bash
npm install -g vercel
vercel --prod
```

#### AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

## Environment Variables

### Development (`.env.local`)

```env
VITE_API_URL=http://localhost:9002
VITE_EVAL_API_URL=http://localhost:9001
```

### Production (`.env.production`)

```env
VITE_API_URL=https://api.yourdomain.com
VITE_EVAL_API_URL=https://eval.yourdomain.com
```

### Docker

Pass via docker-compose.yml or docker run:
```bash
docker run -e VITE_API_URL=http://api:9002 ...
```

## Next Steps

1. ✅ **Verify Setup** - Check all features work
2. ✅ **Create Policies** - Test CRUD operations
3. ✅ **Customize** - Adjust styles/features as needed
4. ✅ **Deploy** - Follow production deployment steps

## Quick Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build

# Code Quality
npm run lint          # Lint code
npm run format        # Format code

# Docker
docker-compose up -d  # Start with Docker
docker-compose logs   # View logs
docker-compose down   # Stop services
```

## Support

- **Policy Engine Docs**: `../policy-engine-go/README.md`
- **Frontend README**: `README.md`
- **API Reference**: `../policy-engine-go/API_CRUD.md`

---

**Setup complete!** 🎉 You're ready to manage policies through the UI.

Access: http://localhost:3000
