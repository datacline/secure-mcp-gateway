# Policy Engine - Deployment Guide

## Quick Start by Use Case

### Use Case 1: Development / Testing

**Recommendation**: Combined Mode

```bash
# Start
docker-compose up -d

# Access
curl http://localhost:9000/health
curl http://localhost:9000/api/v1/policies
curl -X POST http://localhost:9000/api/v1/evaluate -d '{...}'
```

**Why**: Simple, all-in-one, easy debugging

---

### Use Case 2: Production - Low Traffic (<100 req/s)

**Recommendation**: Combined Mode

```bash
# Start
docker-compose up -d

# Or scale vertically
docker-compose up -d --scale policy-engine=3
```

**Why**: Cost-effective, simpler operations

---

### Use Case 3: Production - High Traffic (>1000 req/s)

**Recommendation**: Split Mode

```bash
# Start split services
make docker-run-split

# Access
Evaluation: http://localhost:9001/api/v1/evaluate
Management: http://localhost:9002/api/v1/policies
```

**Architecture**:
```
         Load Balancer
              │
    ┌─────────┴─────────┐
    ▼         ▼         ▼
 Eval-1    Eval-2    Eval-3    (Auto-scaled, read-only)
 :9001     :9001     :9001


         Admin Portal
              │
              ▼
          Management        (Single instance, write access)
           :9002
```

**Why**: 
- Independent scaling (10x eval, 1x mgmt)
- Better performance (no write locks on eval)
- Cost optimization (smaller eval instances)

---

### Use Case 4: Multi-Region Production

**Recommendation**: Split Mode + Regional Deployment

```
Region 1 (US-East)
├─ Eval-1, Eval-2, Eval-3
├─ Eval-4, Eval-5, Eval-6
└─ Management (primary)

Region 2 (EU-West)
├─ Eval-7, Eval-8, Eval-9
└─ Read-only policy sync

Region 3 (AP-South)
├─ Eval-10, Eval-11, Eval-12
└─ Read-only policy sync
```

**Why**: 
- Low latency evaluation
- Regional compliance
- Centralized policy management

---

## Deployment Comparison

| Feature | Combined | Split | 
|---------|----------|-------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐ Moderate |
| **Scalability** | ⭐⭐ Vertical | ⭐⭐⭐⭐⭐ Horizontal |
| **Cost** | ⭐⭐⭐⭐ Low | ⭐⭐⭐ Moderate |
| **Performance** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| **Security** | ⭐⭐⭐ Basic | ⭐⭐⭐⭐⭐ Advanced |
| **Ops Complexity** | ⭐ Simple | ⭐⭐⭐ Moderate |

## Step-by-Step Deployment

### Option A: Combined Mode (Simplest)

#### Step 1: Build

```bash
# Build binary
make build-combined

# Or build Docker image
make docker-build-combined
```

#### Step 2: Configure

```bash
# Create .env file
cat > .env <<EOF
PORT=9000
POLICY_DIR=./policies
ENABLE_EVALUATION=true
ENABLE_MANAGEMENT=true
LOG_LEVEL=info
EOF
```

#### Step 3: Start

```bash
# Docker
docker-compose up -d

# Or binary
./bin/policy-engine
```

#### Step 4: Verify

```bash
# Health check
curl http://localhost:9000/health

# Test evaluation
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"admin","tool":"test"}'

# Test management
curl http://localhost:9000/api/v1/policies
```

---

### Option B: Split Mode (Production)

#### Step 1: Build

```bash
# Build all images
make docker-build

# Images created:
# - policy-evaluation:latest
# - policy-management:latest
```

#### Step 2: Deploy Evaluation Service

```bash
# Start 3 evaluation instances
docker-compose -f docker-compose.split.yml up -d --scale policy-evaluation=3

# Verify
curl http://localhost:9001/health
```

#### Step 3: Deploy Management Service

```bash
# Start single management instance
docker-compose -f docker-compose.split.yml up -d policy-management

# Verify
curl http://localhost:9002/health
```

#### Step 4: Configure Load Balancer

**Nginx Example**:
```nginx
# Evaluation endpoints (round-robin to 3 instances)
upstream policy_evaluation {
    server localhost:9001;
    server localhost:9001;
    server localhost:9001;
}

# Management endpoint (single instance)
upstream policy_management {
    server localhost:9002;
}

server {
    listen 9000;

    # Public evaluation API
    location /api/v1/evaluate {
        proxy_pass http://policy_evaluation;
    }

    # Internal management API
    location /api/v1/policies {
        # Add authentication here
        auth_basic "Policy Management";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://policy_management;
    }
}
```

#### Step 5: Verify

```bash
# Test evaluation through load balancer
curl -X POST http://localhost:9000/api/v1/evaluate \
  -d '{"user":"admin","tool":"test"}'

# Test management (with auth)
curl -u admin:password http://localhost:9000/api/v1/policies
```

---

## Kubernetes Deployment

### Combined Mode

```yaml
# policy-engine-combined.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: policy-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: policy-engine
  template:
    metadata:
      labels:
        app: policy-engine
    spec:
      containers:
      - name: policy-engine
        image: policy-engine:latest
        ports:
        - containerPort: 9000
        env:
        - name: PORT
          value: "9000"
        - name: POLICY_DIR
          value: "/app/policies"
        volumeMounts:
        - name: policies
          mountPath: /app/policies
      volumes:
      - name: policies
        persistentVolumeClaim:
          claimName: policy-storage

---
apiVersion: v1
kind: Service
metadata:
  name: policy-engine
spec:
  selector:
    app: policy-engine
  ports:
  - port: 9000
    targetPort: 9000
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f policy-engine-combined.yaml
```

### Split Mode

```yaml
# policy-evaluation.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: policy-evaluation
spec:
  replicas: 10  # Scale out for high throughput
  selector:
    matchLabels:
      app: policy-evaluation
  template:
    metadata:
      labels:
        app: policy-evaluation
    spec:
      containers:
      - name: evaluation
        image: policy-evaluation:latest
        ports:
        - containerPort: 9000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        volumeMounts:
        - name: policies
          mountPath: /app/policies
          readOnly: true
      volumes:
      - name: policies
        persistentVolumeClaim:
          claimName: policy-storage

---
apiVersion: v1
kind: Service
metadata:
  name: policy-evaluation
spec:
  selector:
    app: policy-evaluation
  ports:
  - port: 9000
    targetPort: 9000

---
# policy-management.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: policy-management
spec:
  replicas: 1  # Single instance for writes
  selector:
    matchLabels:
      app: policy-management
  template:
    metadata:
      labels:
        app: policy-management
    spec:
      containers:
      - name: management
        image: policy-management:latest
        ports:
        - containerPort: 9000
        volumeMounts:
        - name: policies
          mountPath: /app/policies
          readOnly: false
      volumes:
      - name: policies
        persistentVolumeClaim:
          claimName: policy-storage

---
apiVersion: v1
kind: Service
metadata:
  name: policy-management
spec:
  selector:
    app: policy-management
  ports:
  - port: 9000
    targetPort: 9000
  type: ClusterIP  # Internal only
```

Deploy:
```bash
kubectl apply -f policy-evaluation.yaml
kubectl apply -f policy-management.yaml

# Scale evaluation service
kubectl scale deployment policy-evaluation --replicas=20
```

---

## Auto-Scaling Configuration

### Docker Swarm

```yaml
version: '3.8'
services:
  policy-evaluation:
    image: policy-evaluation:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: on-failure
      update_config:
        parallelism: 1
        delay: 10s
    ports:
      - "9001:9000"
```

### Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: policy-evaluation-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: policy-evaluation
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Monitoring Setup

### Prometheus Metrics (Future)

```yaml
# Add to service configuration
- name: ENABLE_METRICS
  value: "true"
- name: METRICS_PORT
  value: "9090"
```

### Loki Logging

```yaml
# docker-compose.yml addition
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
  
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
```

---

## Security Best Practices

### 1. Network Segmentation

```
Public Network
     │
     ├─► API Gateway
     │        │
     │        └─► Evaluation Service (9001)
     │
Internal Network
     │
     └─► Admin VPN
              │
              └─► Management Service (9002)
```

### 2. Authentication

**Evaluation Service**: API Key / JWT
```nginx
location /api/v1/evaluate {
    auth_request /auth;
    proxy_pass http://policy_evaluation;
}
```

**Management Service**: OAuth2 / SSO
```nginx
location /api/v1/policies {
    auth_request /oauth2/auth;
    proxy_pass http://policy_management;
}
```

### 3. TLS/SSL

```bash
# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout policy-engine.key -out policy-engine.crt

# Add to nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/policy-engine.crt;
    ssl_certificate_key /etc/nginx/policy-engine.key;
}
```

---

## Troubleshooting

### Issue: Service Won't Start

```bash
# Check logs
docker-compose logs policy-engine

# Common causes:
# 1. Port already in use
sudo lsof -i :9000

# 2. Permission denied on policy directory
ls -la ./policies

# 3. Missing environment variables
docker-compose config
```

### Issue: Cannot Connect to Service

```bash
# Check if running
docker ps | grep policy

# Check health
curl http://localhost:9000/health

# Check network
docker network ls
docker network inspect policy-network
```

### Issue: Policies Not Loading

```bash
# Check policy directory
docker exec policy-engine ls -la /app/policies

# Reload policies
curl -X POST http://localhost:9000/api/v1/reload

# Check logs
docker logs policy-engine | grep policy
```

---

## Performance Tuning

### Combined Mode

```bash
# Increase replicas
docker-compose up -d --scale policy-engine=5

# Increase resources
docker-compose up -d --compatibility \
  --memory 1g --cpus 2
```

### Split Mode

```bash
# Scale evaluation aggressively
docker-compose -f docker-compose.split.yml up -d \
  --scale policy-evaluation=20

# Keep management single instance
# (writes don't benefit from horizontal scaling)
```

---

## Cost Optimization

### Small Deployment ($10-20/month)

```
1x Combined instance
  - 1 CPU
  - 512MB RAM
  - Handles 100 req/s
```

### Medium Deployment ($50-100/month)

```
3x Evaluation instances
  - 0.5 CPU each
  - 256MB RAM each
  - Handles 1000 req/s
  
1x Management instance
  - 0.5 CPU
  - 256MB RAM
```

### Large Deployment ($200-500/month)

```
20x Evaluation instances (auto-scaled)
  - 0.25 CPU each
  - 128MB RAM each
  - Handles 10,000 req/s
  
1x Management instance
  - 1 CPU
  - 512MB RAM
```

---

## Summary

### Choose Combined Mode When:
- ✅ Development/testing
- ✅ Low traffic (<100 req/s)
- ✅ Simple deployment preferred
- ✅ Single tenant
- ✅ Cost is primary concern

### Choose Split Mode When:
- ✅ Production deployment
- ✅ High traffic (>1000 req/s)
- ✅ Need independent scaling
- ✅ Security isolation required
- ✅ Multi-region deployment
- ✅ Cost optimization at scale

---

**Ready to deploy?** Pick your mode and follow the steps above!

For more details, see:
- `ARCHITECTURE.md` - Architecture overview
- `REORGANIZATION_SUMMARY.md` - Code structure
- `README.md` - Complete documentation
