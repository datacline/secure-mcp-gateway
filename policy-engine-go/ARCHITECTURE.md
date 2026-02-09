## Policy Engine - Modular Architecture

### Overview

The Policy Engine is designed with a **modular, service-oriented architecture** that allows for easy splitting into separate microservices for evaluation and management.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Combined Mode (Default)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Policy Engine (Port 9000)                   │   │
│  │  ┌────────────────────┐    ┌───────────────────────┐    │   │
│  │  │  Evaluation Service│    │  Management Service   │    │   │
│  │  │  (Read Policies)   │◄───┤  (CRUD Policies)      │    │   │
│  │  └────────────────────┘    └───────────────────────┘    │   │
│  │           │                          │                   │   │
│  │           ▼                          ▼                   │   │
│  │  ┌────────────────────┐    ┌───────────────────────┐    │   │
│  │  │ Evaluation Engine  │    │   Storage Layer       │    │   │
│  │  │ (Policy Matching)  │    │   (YAML Files)        │    │   │
│  │  └────────────────────┘    └───────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          Split Mode                              │
│  ┌──────────────────────┐         ┌──────────────────────────┐  │
│  │  Evaluation Service  │         │  Management Service      │  │
│  │    (Port 9001)       │         │    (Port 9002)           │  │
│  │  ┌────────────────┐  │         │  ┌───────────────────┐  │  │
│  │  │   Evaluation   │  │         │  │    Management     │  │  │
│  │  │     Service    │  │         │  │      Service      │  │  │
│  │  └────────────────┘  │         │  └───────────────────┘  │  │
│  │         │             │         │           │             │  │
│  │         ▼             │         │           ▼             │  │
│  │  ┌────────────────┐  │         │  ┌───────────────────┐  │  │
│  │  │ Evaluation Eng │  │         │  │  Storage Layer    │  │  │
│  │  │ (Read-Only)    │  │         │  │  (Read-Write)     │  │  │
│  │  └────────────────┘  │         │  └───────────────────┘  │  │
│  │         │             │         │           │             │  │
│  │         ▼             │         │           ▼             │  │
│  │  ┌────────────────┐  │         │  ┌───────────────────┐  │  │
│  │  │ Policy Files   │◄─┼─────────┼─►│  Policy Files     │  │  │
│  │  │  (Read-Only)   │  │         │  │  (Read-Write)     │  │  │
│  │  └────────────────┘  │         │  └───────────────────┘  │  │
│  └──────────────────────┘         └──────────────────────────┘  │
│           │                                     │                │
│           └─────────────────┬───────────────────┘                │
│                             ▼                                    │
│                    Shared Policy Storage                         │
│                    (File System / NFS)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
policy-engine-go/
├── cmd/
│   ├── server/          # Combined service (default)
│   │   └── main.go
│   ├── evaluation/      # Evaluation-only service
│   │   └── main.go
│   └── management/      # Management-only service
│       └── main.go
│
├── internal/
│   ├── api/             # HTTP handlers (separated by concern)
│   │   ├── evaluation/
│   │   │   └── handler.go
│   │   ├── management/
│   │   │   └── handler.go
│   │   └── health/
│   │       └── handler.go
│   │
│   ├── services/        # Business logic (separated by concern)
│   │   ├── evaluation/
│   │   │   └── service.go
│   │   └── management/
│   │       └── service.go
│   │
│   ├── engine/          # Policy evaluation engine
│   │   └── evaluator.go
│   │
│   ├── storage/         # Persistence layer
│   │   └── storage.go
│   │
│   ├── models/          # Shared data models
│   │   └── types.go
│   │
│   └── config/          # Configuration management
│       ├── config.go
│       └── loader.go
│
├── pkg/
│   └── client/          # Go client library
│       └── client.go
│
├── Dockerfile           # Combined service
├── Dockerfile.split     # Multi-target for split services
├── docker-compose.yml   # Combined deployment
└── docker-compose.split.yml  # Split deployment
```

## Layer Responsibilities

### 1. API Layer (`internal/api/*`)

**Purpose**: HTTP request handling and routing

**Packages**:
- `evaluation/handler.go` - Evaluation endpoints
- `management/handler.go` - CRUD endpoints
- `health/handler.go` - Health checks

**Responsibilities**:
- Parse HTTP requests
- Validate input
- Call service layer
- Format responses
- Error handling

**Independence**: Each handler can be deployed separately

### 2. Service Layer (`internal/services/*`)

**Purpose**: Business logic and orchestration

**Packages**:
- `evaluation/service.go` - Policy evaluation logic
- `management/service.go` - Policy CRUD logic

**Responsibilities**:
- Coordinate between layers
- Implement business rules
- Transaction management
- Logging

**Independence**: Services are completely independent and can be deployed separately

### 3. Engine Layer (`internal/engine/`)

**Purpose**: Core policy evaluation

**Responsibilities**:
- Policy matching
- Condition evaluation
- Action determination
- Rule priority handling

**Shared**: Used by evaluation service only

### 4. Storage Layer (`internal/storage/`)

**Purpose**: Data persistence

**Responsibilities**:
- YAML file operations
- CRUD operations
- Validation
- Version management

**Shared**: Used by management service only

### 5. Models Layer (`internal/models/`)

**Purpose**: Shared data structures

**Shared**: Used by all layers

### 6. Config Layer (`internal/config/`)

**Purpose**: Configuration management

**Shared**: Used by all services

## Deployment Modes

### 1. Combined Mode (Default)

**Use Case**: Development, small deployments, single-tenant

**Configuration**:
```bash
ENABLE_EVALUATION=true
ENABLE_MANAGEMENT=true
PORT=9000
```

**Start**:
```bash
# Docker
docker-compose up -d

# Binary
./policy-engine

# Go
go run cmd/server/main.go
```

**Endpoints Available**:
- `POST /api/v1/evaluate` ✅
- `POST /api/v1/evaluate/batch` ✅
- `GET /api/v1/policies` ✅
- `POST /api/v1/policies` ✅
- `PUT /api/v1/policies/:id` ✅
- `DELETE /api/v1/policies/:id` ✅
- All health endpoints ✅

### 2. Evaluation-Only Mode

**Use Case**: High-throughput production, read-only, horizontal scaling

**Configuration**:
```bash
ENABLE_EVALUATION=true
ENABLE_MANAGEMENT=false
PORT=9000
```

**Start**:
```bash
# Docker
docker-compose -f docker-compose.split.yml up policy-evaluation

# Binary
./policy-evaluation

# Go
go run cmd/evaluation/main.go
```

**Endpoints Available**:
- `POST /api/v1/evaluate` ✅
- `POST /api/v1/evaluate/batch` ✅
- Health endpoints ✅
- Management endpoints ❌

**Characteristics**:
- ✅ Read-only policy access
- ✅ High performance (no write locks)
- ✅ Horizontally scalable
- ✅ Lower memory footprint
- ❌ Cannot modify policies

### 3. Management-Only Mode

**Use Case**: Administrative control plane, policy management UI backend

**Configuration**:
```bash
ENABLE_EVALUATION=false
ENABLE_MANAGEMENT=true
PORT=9000
```

**Start**:
```bash
# Docker
docker-compose -f docker-compose.split.yml up policy-management

# Binary
./policy-management

# Go
go run cmd/management/main.go
```

**Endpoints Available**:
- `GET /api/v1/policies` ✅
- `POST /api/v1/policies` ✅
- `PUT /api/v1/policies/:id` ✅
- `DELETE /api/v1/policies/:id` ✅
- `POST /api/v1/policies/:id/enable` ✅
- `POST /api/v1/policies/:id/disable` ✅
- `POST /api/v1/policies/validate` ✅
- Health endpoints ✅
- Evaluation endpoints ❌

**Characteristics**:
- ✅ Full CRUD operations
- ✅ Policy validation
- ✅ File persistence
- ❌ Cannot evaluate policies

### 4. Split Mode (Evaluation + Management)

**Use Case**: Production, multi-tenant, separation of concerns

**Configuration**:
```yaml
# Evaluation Service (scaled to 3 instances)
- ENABLE_EVALUATION=true
- ENABLE_MANAGEMENT=false
- Volumes: read-only

# Management Service (single instance)
- ENABLE_EVALUATION=false
- ENABLE_MANAGEMENT=true
- Volumes: read-write
```

**Start**:
```bash
docker-compose -f docker-compose.split.yml --profile split up -d
```

**Architecture**:
```
Load Balancer
      │
      ├─► Evaluation Service (9001) - Instance 1
      ├─► Evaluation Service (9001) - Instance 2
      └─► Evaluation Service (9001) - Instance 3
      
Admin Portal
      │
      └─► Management Service (9002) - Single Instance
```

## Benefits of Split Architecture

### 1. **Independent Scaling**

```bash
# Scale evaluation service to 10 replicas
docker-compose -f docker-compose.split.yml up -d --scale policy-evaluation=10

# Keep management service at 1 replica
# (CRUD operations don't need horizontal scaling)
```

### 2. **Security Isolation**

```
Evaluation Service:
- Exposed to public/internal API gateway
- Read-only access
- High traffic
- No write permissions

Management Service:
- Internal only / Admin network
- Read-write access
- Low traffic
- Requires authentication
```

### 3. **Performance Optimization**

```
Evaluation:
- No write locks
- Memory-mapped policy files
- Aggressive caching
- No disk I/O on hot path

Management:
- Write optimized
- Transaction support
- Validation overhead acceptable
```

### 4. **Deployment Flexibility**

```
Development:
└─► Combined (single container)

Staging:
├─► Evaluation (2 replicas)
└─► Management (1 replica)

Production:
├─► Evaluation (10 replicas, multiple regions)
└─► Management (1 replica, primary region only)
```

## Migration Path

### Phase 1: Combined (Current)

```bash
docker-compose up -d
# Single service handling both concerns
```

### Phase 2: Split Preparation

```bash
# Test split mode locally
docker-compose -f docker-compose.split.yml --profile split up -d
# Verify both services work independently
```

### Phase 3: Production Split

```bash
# Deploy evaluation services (multiple regions)
kubectl apply -f k8s/evaluation-deployment.yaml
kubectl scale deployment policy-evaluation --replicas=10

# Deploy management service (single region)
kubectl apply -f k8s/management-deployment.yaml
```

## Shared Storage Considerations

### Option 1: Shared File System (NFS/EFS)

```yaml
volumes:
  policy-storage:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server,rw
      device: ":/policies"

services:
  policy-evaluation:
    volumes:
      - policy-storage:/app/policies:ro
  
  policy-management:
    volumes:
      - policy-storage:/app/policies:rw
```

### Option 2: Git-based Sync

```bash
# Management service commits to git
policy-management --> Git Repository

# Evaluation services pull from git
Git Repository --> policy-evaluation (cron job)
```

### Option 3: Event-driven Sync

```bash
# Management service publishes changes
policy-management --> Message Queue (Kafka/Redis)

# Evaluation services subscribe to changes
Message Queue --> policy-evaluation (auto-reload)
```

## Configuration Matrix

| Mode | Binary | Port | Endpoints | Scaling | Use Case |
|------|--------|------|-----------|---------|----------|
| Combined | `policy-engine` | 9000 | All | Vertical | Dev/Test |
| Evaluation | `policy-evaluation` | 9001 | Eval only | Horizontal | Production data plane |
| Management | `policy-management` | 9002 | CRUD only | Vertical | Production control plane |

## API Gateway Integration

### Recommended Setup

```
                    ┌─────────────────────┐
                    │   API Gateway       │
                    │   (Kong/Nginx)      │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │  Evaluation    │ │  Evaluation    │ │  Evaluation    │
   │  Instance 1    │ │  Instance 2    │ │  Instance 3    │
   └────────────────┘ └────────────────┘ └────────────────┘
   
   
                    ┌─────────────────────┐
                    │   Admin Portal      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Management        │
                    │   Service           │
                    └─────────────────────┘
```

### Nginx Configuration Example

```nginx
# Public API - Evaluation
upstream policy_evaluation {
    server policy-evaluation-1:9000;
    server policy-evaluation-2:9000;
    server policy-evaluation-3:9000;
}

location /api/v1/evaluate {
    proxy_pass http://policy_evaluation;
}

# Internal API - Management
upstream policy_management {
    server policy-management:9000;
}

location /api/v1/policies {
    # Require authentication
    auth_request /auth;
    proxy_pass http://policy_management;
}
```

## Monitoring & Observability

### Health Checks

All services expose:
- `/health` - General health
- `/ready` - Readiness (dependencies OK)
- `/live` - Liveness (service alive)

### Metrics (Future)

```
# Evaluation metrics
policy_evaluation_requests_total
policy_evaluation_duration_seconds
policy_evaluation_matches_total

# Management metrics
policy_crud_operations_total
policy_validation_errors_total
policy_reload_duration_seconds
```

## Summary

The modular architecture provides:

✅ **Easy splitting** - Services can be separated with minimal code changes  
✅ **Independent scaling** - Scale evaluation and management independently  
✅ **Clear boundaries** - Well-defined responsibilities for each layer  
✅ **Flexible deployment** - Combined or split based on needs  
✅ **Maintainability** - Changes to one service don't affect others  
✅ **Performance** - Optimize each service for its specific workload  

**Current Status**: ✅ Fully implemented and ready for deployment in any mode!
