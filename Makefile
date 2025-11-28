.PHONY: init help keycloak-setup test-auth clean

# Default target - first time initialization (start services + configure Keycloak)
init:
	@echo "Initializing Secure MCP Gateway..."
	@echo ""
	@echo "Starting services..."
	@docker-compose up -d --build
	@echo "Waiting for all services to be fully ready..."
	@sleep 15
	@docker-compose ps
	@echo ""
	@$(MAKE) keycloak-setup
	@echo ""
	@echo "Initialization complete!"
	@echo ""
	@echo "Quick test:"
	@echo "  make test-auth"
	@echo ""
	@echo "API Documentation:"
	@echo "  curl http://localhost:8000/"
	@echo ""
	@echo "Available commands:"
	@echo "  make help"

# Show help
help:
	@echo "Secure MCP Gateway - Quick Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make (or make init)  - First time setup (starts all services + configures Keycloak)"
	@echo "  make keycloak-setup  - Configure Keycloak realm, client, and test users"
	@echo "  make test-auth       - Test authentication with Keycloak"
	@echo "  make clean           - Stop and remove all containers, volumes, networks"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-compose up -d       - Start services"
	@echo "  docker-compose down        - Stop services"
	@echo "  docker-compose logs -f     - View logs"
	@echo "  docker-compose restart     - Restart services"
	@echo ""
	@echo "Services:"
	@echo "  Gateway:    http://localhost:8000"
	@echo "  Keycloak:   http://localhost:8080 (admin/admin)"
	@echo "  Mock MCP:   http://localhost:3000"

# Clean everything
clean:
	@echo "Cleaning up..."
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@echo "Cleaned!"

# Initialize/Re-initialize Keycloak
keycloak-setup:
	@echo "Running Keycloak initialization..."
	@docker-compose exec mcp-gateway bash /init.sh 2>/dev/null || docker run --rm --network secure-mcp-gateway_mcp-network -v $(PWD)/docker/keycloak-init.sh:/init.sh python:3.11-slim sh -c "apt-get update > /dev/null 2>&1 && apt-get install -y curl > /dev/null 2>&1 && chmod +x /init.sh && /init.sh"
	@echo ""
	@echo "Keycloak initialized!"

# Test authentication
test-auth:
	@bash -c ' \
	TOKEN=$$(curl -s -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
	  -H "Content-Type: application/x-www-form-urlencoded" \
	  -d "username=testuser" -d "password=testpass" -d "grant_type=password" -d "client_id=mcp-gateway-client" \
	  | python3 -c "import sys, json; print(json.load(sys.stdin)[\"access_token\"])"); \
	echo "Token obtained!"; echo ""; \
	echo "Testing /mcp/servers endpoint:"; \
	curl -s -H "Authorization: Bearer $$TOKEN" http://localhost:8000/mcp | python3 -m json.tool'
