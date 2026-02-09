# Policy Management UI

A modern React + TypeScript web application for managing policies in the MCP Gateway Policy Engine.

## Features

### ✅ Complete Policy Management
- **Dashboard** - Overview of policies and system status
- **List Policies** - View all policies with search and filtering
- **Create Policy** - Create new policies with rules, conditions, and actions
- **Edit Policy** - Update existing policies
- **View Policy** - Detailed view of policy configuration
- **Delete Policy** - Remove policies
- **Enable/Disable** - Toggle policy status

### ✅ Dynamic Rule Builder
- Add multiple rules per policy
- Each rule supports:
  - Multiple conditions (user, time, resource, tool, data, rate)
  - Multiple actions (allow, deny, redact, rate_limit, etc.)
  - Priority-based evaluation
  - Condition operators (eq, neq, in, gt, lt, matches, contains, etc.)

### ✅ Modern UI/UX
- Clean, intuitive interface
- Responsive design
- Real-time updates
- Form validation
- Loading states
- Error handling

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Navigation
- **React Query** - Data fetching & caching
- **React Hook Form** - Form management
- **Axios** - HTTP client
- **Lucide React** - Icons
- **date-fns** - Date formatting

## Prerequisites

- Node.js 18+ and npm
- Policy Engine running (default: http://localhost:9002)

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env.local` file:

```env
# Policy Management API URL (Management Service)
VITE_API_URL=http://localhost:9002

# Optional: Policy Evaluation API URL
VITE_EVAL_API_URL=http://localhost:9001
```

### 3. Start Development Server

```bash
npm run dev
```

The UI will be available at http://localhost:3000

### 4. Start Policy Engine

Make sure the Policy Engine is running:

```bash
# From policy-engine-go directory
# Option 1: Combined mode
docker-compose up -d

# Option 2: Management service only
make docker-run-management
```

## Usage

### Dashboard

View system overview:
- Total policies
- Enabled/disabled counts
- Service status
- Recent policies

### Creating a Policy

1. Click **"Create Policy"** in sidebar or dashboard
2. Fill in basic information:
   - Name (required)
   - Description (optional)
   - Status (enabled/disabled)
   - Enforcement mode (blocking/audit_only)
3. Define rules:
   - Add rule ID and priority
   - Add conditions (e.g., `user eq admin`)
   - Add actions (e.g., `allow`)
4. Click **"Create Policy"**

### Editing a Policy

1. Navigate to policy (List → View → Edit)
2. Modify any field
3. Click **"Save Changes"**
4. Version is auto-incremented

### Deleting a Policy

1. Go to Policy List or Policy View
2. Click **"Delete"** button
3. Confirm deletion

### Enabling/Disabling

Toggle policy status:
- From Policy List (toggle icon)
- From Policy View ("Enable"/"Disable" button)

## API Integration

The UI communicates with the Policy Engine Management API:

### Endpoints Used

- `GET /api/v1/policies` - List all policies
- `GET /api/v1/policies/:id` - Get specific policy
- `POST /api/v1/policies` - Create new policy
- `PUT /api/v1/policies/:id` - Update policy
- `DELETE /api/v1/policies/:id` - Delete policy
- `POST /api/v1/policies/:id/enable` - Enable policy
- `POST /api/v1/policies/:id/disable` - Disable policy
- `POST /api/v1/policies/validate` - Validate policy
- `POST /api/v1/reload` - Reload from disk
- `GET /health` - Health check

### API Configuration

API base URL is configured via environment variable:

```typescript
// src/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9002';
```

### Authentication (Optional)

To add authentication, update `src/services/api.ts`:

```typescript
// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
frontend/
├── src/
│   ├── components/           # Reusable components
│   │   ├── ui/              # UI components (Button, Card, Input)
│   │   ├── Layout.tsx       # App layout with sidebar
│   │   └── PolicyForm.tsx   # Policy form component
│   │
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx    # Dashboard page
│   │   ├── PolicyList.tsx   # Policy list page
│   │   ├── PolicyCreate.tsx # Create policy page
│   │   ├── PolicyEdit.tsx   # Edit policy page
│   │   └── PolicyView.tsx   # View policy page
│   │
│   ├── services/            # API services
│   │   └── api.ts          # API client & endpoints
│   │
│   ├── types/               # TypeScript types
│   │   └── policy.ts       # Policy type definitions
│   │
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
│
├── index.html               # HTML template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── README.md                # This file
```

### Adding New Features

#### Add New Page

1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/Layout.tsx`

#### Add New API Endpoint

1. Add function to `src/services/api.ts`
2. Use with React Query in component:

```typescript
const { data, isLoading } = useQuery('key', apiFunction);
```

#### Add New Component

1. Create component in `src/components/`
2. Create accompanying CSS file
3. Import and use in pages

## Styling

### CSS Variables

Theme colors are defined in `src/index.css`:

```css
:root {
  --primary: #3b82f6;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --bg: #f8fafc;
  --text: #1e293b;
  /* ... */
}
```

### Component Styles

Each component has its own CSS file:

- Scoped to component
- Uses CSS variables
- Responsive design
- Consistent spacing

## Production Build

### Build

```bash
npm run build
```

Output: `dist/` directory

### Deploy

#### Static Hosting (Netlify, Vercel, etc.)

```bash
# Build command
npm run build

# Publish directory
dist

# Environment variables
VITE_API_URL=https://your-policy-engine.com
```

#### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://policy-engine:9002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Cannot Connect to API

1. Check Policy Engine is running:
   ```bash
   curl http://localhost:9002/health
   ```

2. Verify API URL in `.env.local`

3. Check browser console for CORS errors

### CORS Issues

If running on different domain, configure Policy Engine to allow CORS.

In Go service, add:

```go
router.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"http://localhost:3000"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
    AllowHeaders:     []string{"Content-Type", "Authorization"},
    AllowCredentials: true,
}))
```

### Build Errors

```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Follow existing code style
2. Use TypeScript for type safety
3. Add CSS for new components
4. Test on multiple screen sizes
5. Update README if adding features

## License

Same as MCP Gateway Policy Engine

---

## Quick Reference

### Common Tasks

**Start Development:**
```bash
npm run dev
```

**Create Policy:**
1. Dashboard → Create Policy
2. Fill form → Create

**Edit Policy:**
1. Policies → Click policy → Edit
2. Modify → Save

**Delete Policy:**
1. Policies → Click delete icon
2. Confirm

**Check Status:**
- Dashboard shows service health
- Green = Healthy
- Red = Offline

### Keyboard Shortcuts

- `/` - Focus search (on Policy List)
- `Ctrl/Cmd + S` - Save form (in Create/Edit)
- `Esc` - Cancel/Go back

### Tips

- Use **Audit Only** mode to test policies before enforcing
- Higher priority numbers (200) = higher precedence
- Add descriptive names and descriptions
- Test policies after creation
- Keep rules simple and focused
- Use search to find policies quickly

---

**Ready to manage your policies!** 🚀

For Policy Engine documentation, see: `../policy-engine-go/README.md`
