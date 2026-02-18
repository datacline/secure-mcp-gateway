# Contributing to Secure MCP Gateway

Thank you for your interest in contributing to the Secure MCP Gateway! We welcome contributions from the community to help make this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. By participating, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Prioritize the community's best interests

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting a bug, include:**

- Clear and descriptive title
- Exact steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, versions, etc.)
- Logs and error messages
- Screenshots if applicable

**Example:**

```markdown
**Bug:** MCP server fails to connect with SSL error

**Steps to reproduce:**
1. Configure HTTPS MCP server in mcp_servers.yaml
2. Start gateway with `docker-compose up`
3. Attempt to list tools: `curl http://localhost:8000/mcp/servers`

**Expected:** Server connects successfully
**Actual:** SSL certificate verification fails

**Environment:**
- OS: macOS 14.0
- Docker: 24.0.6
- Gateway version: 1.2.0

**Logs:**
```
ERROR - SSL verification failed for server: https://example.com
```
```

### Suggesting Enhancements

We welcome feature requests! Please:

1. Check if the feature already exists or is planned
2. Provide clear use cases
3. Explain why this would benefit users
4. Include implementation ideas if possible

### Pull Requests

We actively welcome pull requests for:

- Bug fixes
- New features
- Documentation improvements
- Performance optimizations
- Test coverage improvements

## Development Setup

### Prerequisites

- **Java 21+** (for server-java)
- **Go 1.21+** (for policy-engine-go)
- **Node.js 18+** (for frontend and stdio-proxy)
- **Docker & Docker Compose**
- **Git**

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/secure-mcp-gateway.git
cd secure-mcp-gateway
```

3. Add upstream remote:

```bash
git remote add upstream https://github.com/datacline/secure-mcp-gateway.git
```

### Local Development

#### Start All Services

```bash
docker-compose up -d
```

#### Run Services Individually

**Java Gateway (local development):**
```bash
cd server-java
./mvnw spring-boot:run
```

**Policy Engine:**
```bash
cd policy-engine-go
go run cmd/server/main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**STDIO Proxy Service:**
```bash
cd stdio-proxy-service
npm install
npm run dev
```

### Verify Setup

```bash
# Check gateway health
curl http://localhost:8000/actuator/health

# Check policy engine
curl http://localhost:9000/health

# Access frontend
open http://localhost:5173
```

## Contribution Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements

### 2. Make Your Changes

- Write clear, concise commit messages
- Follow coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add support for custom authentication methods"
```

**Commit message format:**
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

**Example:**
```
feat: add OAuth2 device code flow support

- Implement device authorization endpoint
- Add polling mechanism for token exchange
- Update auth configuration to support device flow

Closes #123
```

### 4. Keep Your Fork Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill in the PR template:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)

### 7. Address Review Feedback

- Respond to code review comments
- Make requested changes
- Push updates to the same branch

## Coding Standards

### Java (server-java)

**Style Guide:**
- Use Spring Boot conventions
- Follow standard Java naming conventions
- Use meaningful variable names
- Add Javadoc for public methods
- Prefer constructor injection over field injection

**Example:**
```java
/**
 * Service for managing MCP server configurations.
 */
@Service
public class McpConfigService {

    private final McpServerRepository repository;

    public McpConfigService(McpServerRepository repository) {
        this.repository = repository;
    }

    /**
     * Get configuration for a specific server.
     *
     * @param serverName The name of the server
     * @return Server configuration map
     * @throws IllegalArgumentException if server not found
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getServerConfig(String serverName) {
        // Implementation
    }
}
```

**Build and Format:**
```bash
cd server-java
./mvnw clean install
./mvnw spring-javaformat:apply
```

### Go (policy-engine-go)

**Style Guide:**
- Follow standard Go conventions
- Use `gofmt` for formatting
- Add comments for exported functions
- Use meaningful package names

**Example:**
```go
// PolicyService manages policy operations.
type PolicyService struct {
    storage storage.Storage
}

// GetPolicy retrieves a policy by ID.
func (s *PolicyService) GetPolicy(ctx context.Context, id string) (*models.Policy, error) {
    // Implementation
}
```

**Format and Test:**
```bash
cd policy-engine-go
gofmt -w .
go test ./...
go vet ./...
```

### TypeScript/React (frontend)

**Style Guide:**
- Use functional components with hooks
- Follow React best practices
- Use TypeScript for type safety
- Use meaningful component names

**Example:**
```typescript
interface ServerConfigProps {
  serverName: string;
  onUpdate: (config: ServerConfig) => void;
}

export const ServerConfigEditor: React.FC<ServerConfigProps> = ({
  serverName,
  onUpdate
}) => {
  const [config, setConfig] = useState<ServerConfig | null>(null);

  // Implementation

  return (
    <div>
      {/* UI components */}
    </div>
  );
};
```

**Format and Lint:**
```bash
cd frontend
npm run lint
npm run format
```

## Testing Guidelines

### Write Tests For:

- New features
- Bug fixes
- Edge cases
- Error handling

### Java Tests

```java
@SpringBootTest
class McpConfigServiceTest {

    @Autowired
    private McpConfigService service;

    @Test
    void testGetServerConfig() {
        // Arrange
        String serverName = "test-server";

        // Act
        Map<String, Object> config = service.getServerConfig(serverName);

        // Assert
        assertNotNull(config);
        assertEquals("test-server", config.get("name"));
    }
}
```

**Run tests:**
```bash
cd server-java
./mvnw test
```

### Go Tests

```go
func TestGetPolicy(t *testing.T) {
    // Setup
    service := NewPolicyService(mockStorage)

    // Execute
    policy, err := service.GetPolicy(context.Background(), "test-id")

    // Verify
    assert.NoError(t, err)
    assert.NotNil(t, policy)
    assert.Equal(t, "test-id", policy.ID)
}
```

**Run tests:**
```bash
cd policy-engine-go
go test ./...
```

### Integration Tests

```bash
# Start services
docker-compose up -d

# Run integration tests
./server-java/test-config-endpoints.sh
```

## Documentation

### When to Update Documentation

- Adding new features
- Changing existing behavior
- Adding configuration options
- Fixing bugs that affect usage

### Documentation Locations

- **README.md** - Overview, quick start, main features
- **server-java/** - Java gateway specific docs
- **policy-engine-go/** - Policy engine specific docs
- **frontend/** - Frontend specific docs
- **docs/** - General documentation

### Writing Good Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep examples up-to-date
- Use proper markdown formatting

**Example:**

````markdown
## Creating an MCP Server

To create a new MCP server:

```bash
curl -X POST http://localhost:8000/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "url": "http://localhost:3000/mcp",
    "type": "http",
    "enabled": true
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Server created successfully"
}
```
````

## Community

### Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and general discussion
- **Pull Requests** - Code contributions

### Stay Updated

- Watch the repository for updates
- Check the [CHANGELOG](CHANGELOG.md) for version updates
- Review open issues and pull requests

## Recognition

Contributors will be:

- Added to the contributors list
- Mentioned in release notes (for significant contributions)
- Credited in relevant documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Quick Reference

### First-Time Contribution Checklist

- [ ] Fork the repository
- [ ] Clone your fork locally
- [ ] Set up development environment
- [ ] Create a feature branch
- [ ] Make your changes
- [ ] Write/update tests
- [ ] Update documentation
- [ ] Commit with clear messages
- [ ] Push to your fork
- [ ] Create a pull request
- [ ] Respond to feedback

### Need Help?

Don't hesitate to:

- Ask questions in issues or discussions
- Request clarification on requirements
- Seek guidance on implementation approach
- Report unclear documentation

**We're here to help! Welcome to the community! 🎉**
