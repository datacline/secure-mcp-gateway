# MCP Gateway Frontend

React frontend for managing and viewing MCP servers in the Secure MCP Gateway.

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environme

The frontend needs to connect to the backend API. Create a `.env.local` file (already created):

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=mcp-gateway
VITE_KEYCLOAK_CLIENT_ID=mcp-gateway-client
```

## Running the Frontend

### Option 1: Without Authentication (Development)

If the backend is running with `AUTH_ENABLED=false`:

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

### Option 2: With Authentication (Production)

If the backend is running with `AUTH_ENABLED=true`, you need to use the auth-enabled version:

1. Replace `src/App.tsx` with `src/App-with-auth.tsx`:

```bash
cp src/App-with-auth.tsx src/App.tsx
```

2. Start the frontend:

```bash
npm run dev
```

3. Login with test credentials:
   - Username: `testuser`
   - Password: `testpass`

## Backend Configuration

The frontend expects the backend to be running on `http://localhost:8000`.

### Disable Authentication (Quick Development)

Edit `.env` in the project root:

```bash
AUTH_ENABLED=false
```

Then restart the backend:

```bash
docker-compose restart mcp-gateway
```

### Enable Authentication (Production)

Edit `.env` in the project root:

```bash
AUTH_ENABLED=true
```

Then restart the backend:

```bash
docker-compose restart mcp-gateway
```

## Troubleshooting

### 401 Unauthorized Error

**Problem**: Frontend shows "Failed to fetch servers" or 401 error.

**Solution 1** (Quick): Disable authentication in the backend:

```bash
# In project root .env file
AUTH_ENABLED=false

# Restart backend
docker-compose restart mcp-gateway
```

**Solution 2** (Proper): Enable authentication in the frontend:

```bash
# Use the auth-enabled App.tsx
cp src/App-with-auth.tsx src/App.tsx

# Restart frontend
npm run dev
```

### CORS Errors

If you see CORS errors, the backend should already have CORS enabled for `localhost:5173`. Check the backend logs:

```bash
docker-compose logs mcp-gateway
```

### Backend Not Running

Make sure the backend services are running:

```bash
cd ..
docker-compose up -d
```

## Features

- View all registered MCP servers
- See server status (enabled/disabled)
- View server details (URL, type, description, tags)
- Responsive design with Tailwind CSS
- Optional authentication with Keycloak

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Development

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── MCPManager.tsx      # Main component showing MCP servers
│   │   └── Login.tsx            # Login component (for auth)
│   ├── context/
│   │   └── AuthContext.tsx      # Authentication context
│   ├── App.tsx                  # Main app (no auth)
│   ├── App-with-auth.tsx        # Main app (with auth)
│   └── main.tsx                 # Entry point
├── .env.local                   # Environment variables
└── vite.config.ts               # Vite configuration
```

### Technologies

- React 19
- TypeScript
- Vite
- Axios
- Tailwind CSS (via index.css)
