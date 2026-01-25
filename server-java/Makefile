.PHONY: help dev build test clean docker docker-up docker-down docker-logs native docker-native

# Default goal
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(CYAN)MCP Gateway - Java/Spring Boot$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""

##@ Development

dev: ## Start application in dev mode (live reload)
	@echo "$(GREEN)Starting Spring Boot in dev mode...$(NC)"
	./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

dev-debug: ## Start application in dev mode with debugger on port 5005
	@echo "$(GREEN)Starting Spring Boot in dev mode with debugger...$(NC)"
	./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"

##@ Building

build: ## Build the application (JVM mode)
	@echo "$(GREEN)Building application...$(NC)"
	./mvnw clean package

build-skip-tests: ## Build without running tests
	@echo "$(GREEN)Building application (skipping tests)...$(NC)"
	./mvnw clean package -DskipTests

native: ## Build native executable (requires GraalVM)
	@echo "$(GREEN)Building native executable...$(NC)"
	@echo "$(YELLOW)Note: Native compilation requires GraalVM and additional Spring Boot configuration$(NC)"
	./mvnw -Pnative native:compile

native-container: ## Build native executable using Docker
	@echo "$(GREEN)Building native executable in container...$(NC)"
	@echo "$(YELLOW)Note: Native compilation requires additional Spring Boot configuration$(NC)"
	docker build -f Dockerfile.native -t mcp-gateway-java:native .

##@ Testing

test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	./mvnw test

test-integration: ## Run integration tests
	@echo "$(GREEN)Running integration tests...$(NC)"
	./mvnw verify

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	./mvnw verify jacoco:report
	@echo "$(GREEN)Coverage report: target/site/jacoco/index.html$(NC)"

##@ Docker

docker: build-skip-tests ## Build Docker image (JVM)
	@echo "$(GREEN)Building Docker image (JVM)...$(NC)"
	docker build -t mcp-gateway-java:latest .
	@echo "$(GREEN)Image built: mcp-gateway-java:latest$(NC)"

docker-native: ## Build Docker image (Native)
	@echo "$(GREEN)Building Docker image (Native)...$(NC)"
	@echo "$(YELLOW)This may take 3-5 minutes...$(NC)"
	docker build -f Dockerfile.native -t mcp-gateway-java:native .
	@echo "$(GREEN)Image built: mcp-gateway-java:native$(NC)"

docker-up: ## Start all services with docker-compose
	@echo "$(GREEN)Starting Docker services...$(NC)"
	@if [ ! -f mcp_servers.yaml ]; then \
		echo "$(YELLOW)Copying default mcp_servers.yaml...$(NC)"; \
		cp ../mcp_servers.yaml . 2>/dev/null || echo "$(RED)Warning: mcp_servers.yaml not found$(NC)"; \
	fi
	docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(CYAN)Gateway: http://localhost:8000$(NC)"
	@echo "$(CYAN)Keycloak: http://localhost:8080 (admin/admin)$(NC)"
	@echo ""
	@echo "Run 'make docker-logs' to view logs"

docker-down: ## Stop all services
	@echo "$(GREEN)Stopping Docker services...$(NC)"
	docker-compose down

docker-restart: docker-down docker-up ## Restart all services

docker-logs: ## View logs from all services
	docker-compose logs -f

docker-logs-gateway: ## View logs from gateway only
	docker-compose logs -f mcp-gateway-java

docker-clean: docker-down ## Stop services and remove volumes
	@echo "$(YELLOW)Removing volumes...$(NC)"
	docker-compose down -v
	@echo "$(GREEN)Cleanup complete$(NC)"

##@ Cleanup

clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	./mvnw clean
	rm -rf target/

clean-all: clean docker-clean ## Clean everything (build + docker)
	@echo "$(GREEN)All clean!$(NC)"

##@ Database

db-console: ## Open database console (H2 dev mode)
	@echo "$(CYAN)H2 Console available at:$(NC)"
	@echo "http://localhost:8000/h2-console"
	@echo "$(YELLOW)JDBC URL: jdbc:h2:mem:mcp_gateway$(NC)"

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	./mvnw flyway:migrate

db-reset: ## Reset database (dev only!)
	@echo "$(RED)Resetting database...$(NC)"
	docker-compose down -v postgres
	docker-compose up -d postgres
	@echo "$(GREEN)Database reset complete$(NC)"

##@ Utilities

fmt: ## Format code
	@echo "$(GREEN)Formatting code...$(NC)"
	./mvnw formatter:format

lint: ## Run linters
	@echo "$(GREEN)Running linters...$(NC)"
	./mvnw checkstyle:check

deps: ## Update dependencies
	@echo "$(GREEN)Updating dependencies...$(NC)"
	./mvnw versions:display-dependency-updates

deps-update: ## Update dependencies to latest versions
	@echo "$(GREEN)Updating dependencies to latest versions...$(NC)"
	./mvnw versions:use-latest-versions

health: ## Check application health
	@echo "$(GREEN)Checking application health...$(NC)"
	@curl -s http://localhost:8000/actuator/health | jq . || echo "$(RED)Application not running$(NC)"

metrics: ## Show application metrics
	@echo "$(GREEN)Fetching metrics...$(NC)"
	@curl -s http://localhost:8000/actuator/metrics | head -20

info: ## Show application info
	@echo "$(CYAN)Application Information:$(NC)"
	@echo "  Java Version: $(shell java -version 2>&1 | head -1)"
	@echo "  Maven Version: $(shell ./mvnw -version 2>&1 | head -1)"
	@echo "  Spring Boot Version: $(shell grep '<parent>' -A 2 pom.xml | grep version | sed 's/.*>\(.*\)<.*/\1/')"
	@echo ""
	@if docker ps | grep -q mcp-gateway-java; then \
		echo "$(GREEN)✓ Gateway is running$(NC)"; \
	else \
		echo "$(RED)✗ Gateway is not running$(NC)"; \
	fi

##@ Setup

init: ## Initial setup (first time)
	@echo "$(GREEN)Initializing project...$(NC)"
	@if [ ! -f mcp_servers.yaml ]; then \
		echo "$(YELLOW)Copying mcp_servers.yaml...$(NC)"; \
		cp ../mcp_servers.yaml . || echo "$(RED)Error: Could not copy mcp_servers.yaml$(NC)"; \
	fi
	@echo "$(GREEN)Building project...$(NC)"
	./mvnw clean install -DskipTests
	@echo "$(GREEN)Starting Docker services...$(NC)"
	$(MAKE) docker-up
	@echo ""
	@echo "$(GREEN)✓ Initialization complete!$(NC)"
	@echo ""
	@echo "$(CYAN)Next steps:$(NC)"
	@echo "  1. Run 'make dev' to start in development mode"
	@echo "  2. Visit http://localhost:8000/actuator for Spring Boot Actuator endpoints"
	@echo "  3. Run 'make test' to run tests"
	@echo ""

verify: ## Verify setup
	@echo "$(GREEN)Verifying setup...$(NC)"
	@echo -n "Java 21: "
	@java -version 2>&1 | grep -q "21\." && echo "$(GREEN)✓$(NC)" || echo "$(RED)✗ (run: sdk use java 21.0.1-tem)$(NC)"
	@echo -n "Maven: "
	@command -v mvn >/dev/null 2>&1 && echo "$(GREEN)✓$(NC)" || echo "$(RED)✗$(NC)"
	@echo -n "Docker: "
	@docker ps >/dev/null 2>&1 && echo "$(GREEN)✓$(NC)" || echo "$(RED)✗$(NC)"
	@echo -n "mcp_servers.yaml: "
	@test -f mcp_servers.yaml && echo "$(GREEN)✓$(NC)" || echo "$(RED)✗$(NC)"
