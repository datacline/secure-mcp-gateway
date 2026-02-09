.PHONY: help build build-combined build-evaluation build-management run run-evaluation run-management \
        test test-crud test-coverage clean \
        docker-build docker-build-combined docker-build-evaluation docker-build-management \
        docker-run docker-run-split docker-run-evaluation docker-run-management docker-stop \
        lint fmt

# Default target
help:
	@echo "Policy Engine - Makefile Help"
	@echo "=============================="
	@echo ""
	@echo "Build Commands:"
	@echo "  build                  - Build all binaries (combined, evaluation, management)"
	@echo "  build-combined         - Build combined service only"
	@echo "  build-evaluation       - Build evaluation service only"
	@echo "  build-management       - Build management service only"
	@echo ""
	@echo "Run Commands:"
	@echo "  run                    - Run combined service locally (port 9000)"
	@echo "  run-evaluation         - Run evaluation service locally (port 9000)"
	@echo "  run-management         - Run management service locally (port 9000)"
	@echo ""
	@echo "Test Commands:"
	@echo "  test                   - Run tests"
	@echo "  test-crud              - Test CRUD API (requires running service)"
	@echo "  test-coverage          - Run tests with coverage"
	@echo ""
	@echo "Docker Build Commands:"
	@echo "  docker-build           - Build all Docker images"
	@echo "  docker-build-combined  - Build combined Docker image"
	@echo "  docker-build-evaluation- Build evaluation Docker image"
	@echo "  docker-build-management- Build management Docker image"
	@echo ""
	@echo "Docker Run Commands:"
	@echo "  docker-run             - Run combined service (port 9000)"
	@echo "  docker-run-split       - Run split services (eval:9001, mgmt:9002)"
	@echo "  docker-run-evaluation  - Run evaluation service only (port 9001)"
	@echo "  docker-run-management  - Run management service only (port 9002)"
	@echo "  docker-stop            - Stop all Docker Compose services"
	@echo ""
	@echo "Utility Commands:"
	@echo "  clean                  - Clean build artifacts"
	@echo "  lint                   - Run Go linter"
	@echo "  fmt                    - Format Go code"
	@echo ""

# ============================================================================
# Build Commands
# ============================================================================

# Build all binaries
build:
	@echo "Building all policy engine binaries..."
	@mkdir -p bin
	@go build -o bin/policy-engine cmd/server/main.go
	@go build -o bin/policy-evaluation cmd/evaluation/main.go
	@go build -o bin/policy-management cmd/management/main.go
	@echo "✓ Build complete:"
	@echo "  - bin/policy-engine (combined)"
	@echo "  - bin/policy-evaluation (evaluation-only)"
	@echo "  - bin/policy-management (management-only)"

# Build combined service only
build-combined:
	@echo "Building combined service..."
	@mkdir -p bin
	@go build -o bin/policy-engine cmd/server/main.go
	@echo "✓ Build complete: bin/policy-engine"

# Build evaluation service only
build-evaluation:
	@echo "Building evaluation service..."
	@mkdir -p bin
	@go build -o bin/policy-evaluation cmd/evaluation/main.go
	@echo "✓ Build complete: bin/policy-evaluation"

# Build management service only
build-management:
	@echo "Building management service..."
	@mkdir -p bin
	@go build -o bin/policy-management cmd/management/main.go
	@echo "✓ Build complete: bin/policy-management"

# ============================================================================
# Run Commands
# ============================================================================

# Run combined service locally
run:
	@echo "Running combined service on port 9000..."
	@POLICY_DIR=./policies PORT=9000 go run cmd/server/main.go

# Run evaluation service locally
run-evaluation:
	@echo "Running evaluation service on port 9000..."
	@POLICY_DIR=./policies PORT=9000 go run cmd/evaluation/main.go

# Run management service locally
run-management:
	@echo "Running management service on port 9000..."
	@POLICY_DIR=./policies PORT=9000 go run cmd/management/main.go

# ============================================================================
# Test Commands
# ============================================================================

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Test CRUD API (requires running service)
test-crud:
	@echo "Testing CRUD API..."
	@./test-crud.sh

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	@go test -cover -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "✓ Coverage report: coverage.html"

# ============================================================================
# Docker Build Commands
# ============================================================================

# Docker build - all variants
docker-build:
	@echo "Building all Docker images..."
	@docker build --target combined -t policy-engine:latest -f Dockerfile.split .
	@docker build --target evaluation -t policy-evaluation:latest -f Dockerfile.split .
	@docker build --target management -t policy-management:latest -f Dockerfile.split .
	@echo "✓ Docker build complete:"
	@echo "  - policy-engine:latest (combined)"
	@echo "  - policy-evaluation:latest (evaluation-only)"
	@echo "  - policy-management:latest (management-only)"

# Docker build - combined only
docker-build-combined:
	@echo "Building combined Docker image..."
	@docker build -t policy-engine:latest .
	@echo "✓ Docker build complete: policy-engine:latest"

# Docker build - evaluation only
docker-build-evaluation:
	@echo "Building evaluation Docker image..."
	@docker build --target evaluation -t policy-evaluation:latest -f Dockerfile.split .
	@echo "✓ Docker build complete: policy-evaluation:latest"

# Docker build - management only
docker-build-management:
	@echo "Building management Docker image..."
	@docker build --target management -t policy-management:latest -f Dockerfile.split .
	@echo "✓ Docker build complete: policy-management:latest"

# ============================================================================
# Docker Run Commands
# ============================================================================

# Run with Docker Compose - combined mode
docker-run:
	@echo "Starting combined service with Docker Compose..."
	@docker-compose up -d
	@echo "✓ Combined service started on port 9000"
	@echo "  Health: http://localhost:9000/health"

# Run with Docker Compose - split mode
docker-run-split:
	@echo "Starting split services with Docker Compose..."
	@docker-compose -f docker-compose.split.yml --profile split up -d
	@echo "✓ Split services started:"
	@echo "  - Evaluation on port 9001 (3 replicas)"
	@echo "  - Management on port 9002"

# Run evaluation service only
docker-run-evaluation:
	@echo "Starting evaluation service..."
	@docker-compose -f docker-compose.split.yml up -d policy-evaluation
	@echo "✓ Evaluation service started on port 9001"

# Run management service only
docker-run-management:
	@echo "Starting management service..."
	@docker-compose -f docker-compose.split.yml up -d policy-management
	@echo "✓ Management service started on port 9002"

# Stop Docker Compose
docker-stop:
	@echo "Stopping all Docker Compose services..."
	@docker-compose down 2>/dev/null || true
	@docker-compose -f docker-compose.split.yml down 2>/dev/null || true
	@echo "✓ All services stopped"

# ============================================================================
# Utility Commands
# ============================================================================

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html
	@go clean
	@echo "✓ Clean complete"

# Run linter
lint:
	@echo "Running linter..."
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed. Install: https://golangci-lint.run/usage/install/"; \
	fi

# Format code
fmt:
	@echo "Formatting code..."
	@go fmt ./...
	@echo "✓ Code formatted"
