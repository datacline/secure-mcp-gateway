import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, Globe, Terminal, Plus, RefreshCw, ArrowRight, CheckCircle, XCircle, Search } from 'lucide-react';
import { javaGatewayMcpApi, type MCPServer } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import './MCPServers.css';

export default function MCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'http' | 'stdio'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await javaGatewayMcpApi.listServersWithPolicies();
      setServers(response.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const serverType = server.type || 'http';
    const matchesType =
      filterType === 'all' ||
      (filterType === 'stdio' && serverType === 'stdio') ||
      (filterType === 'http' && serverType !== 'stdio');

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'enabled' && server.enabled) ||
      (filterStatus === 'disabled' && !server.enabled);

    return matchesSearch && matchesType && matchesStatus;
  });

  const getServerIconLetter = (server: MCPServer) => {
    if (server.name.toLowerCase().includes('notion')) return 'N';
    if (server.name.toLowerCase().includes('github')) return 'G';
    if (server.name.toLowerCase().includes('gmail')) return 'M';
    if (server.name.toLowerCase().includes('figma')) return 'F';
    if (server.name.toLowerCase().includes('slack')) return 'S';
    return server.name.charAt(0).toUpperCase();
  };

  const getServerIconColor = (server: MCPServer) => {
    const name = server.name.toLowerCase();
    if (name.includes('notion')) return '#000000';
    if (name.includes('github')) return '#181717';
    if (name.includes('gmail')) return '#EA4335';
    if (name.includes('figma')) return '#F24E1E';
    if (name.includes('slack')) return '#4A154B';
    return 'var(--primary)';
  };

  const handleConvertToHttp = async (server: MCPServer) => {
    if (!confirm(`Convert "${server.name}" from STDIO to HTTP?\n\nThis will spawn an mcp-proxy process to wrap the STDIO server and expose it via HTTP.`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await javaGatewayMcpApi.convertStdioToHttp(server.name);

      // Reload servers to show the updated configuration
      await loadServers();

      alert(`Successfully converted "${server.name}" to HTTP!\n\nNew URL: ${result.url}\nProxy Port: ${result.proxy_port}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert server';
      alert(`Failed to convert "${server.name}" to HTTP:\n\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: servers.length,
    enabled: servers.filter(s => s.enabled).length,
    disabled: servers.filter(s => !s.enabled).length,
    stdio: servers.filter(s => (s.type || 'http') === 'stdio').length,
    http: servers.filter(s => (s.type || 'http') !== 'stdio').length,
  };

  if (loading) {
    return (
      <div className="mcp-servers-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading MCP servers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mcp-servers-page">
        <div className="error-state">
          <h3>Failed to Load Servers</h3>
          <p>{error}</p>
          <Button onClick={loadServers} icon={<RefreshCw size={16} />}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-servers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Available MCPs</h1>
          <p className="page-subtitle">
            Manage MCP servers added to your organization. Configure credentials, policies, and monitor connections.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={loadServers} icon={<RefreshCw size={16} />}>
            Refresh
          </Button>
          <Button onClick={() => navigate('/mcp-catalog')} icon={<Plus size={16} />}>
            Add from Catalog
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-label">Total Servers</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value text-success">{stats.enabled}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive</div>
          <div className="stat-value text-secondary">{stats.disabled}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">HTTP Servers</div>
          <div className="stat-value">{stats.http}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">STDIO Servers</div>
          <div className="stat-value">{stats.stdio}</div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="filters-row">
          <div className="search-box-with-icon">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">Type:</span>
            <button
              className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filterType === 'http' ? 'active' : ''}`}
              onClick={() => setFilterType('http')}
            >
              <Globe size={14} /> HTTP
            </button>
            <button
              className={`filter-btn ${filterType === 'stdio' ? 'active' : ''}`}
              onClick={() => setFilterType('stdio')}
            >
              <Terminal size={14} /> STDIO
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <button
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filterStatus === 'enabled' ? 'active' : ''}`}
              onClick={() => setFilterStatus('enabled')}
            >
              Enabled
            </button>
            <button
              className={`filter-btn ${filterStatus === 'disabled' ? 'active' : ''}`}
              onClick={() => setFilterStatus('disabled')}
            >
              Disabled
            </button>
          </div>
        </div>
      </Card>

      {/* Servers Grid */}
      {filteredServers.length === 0 ? (
        <div className="empty-state">
          {searchQuery || filterType !== 'all' || filterStatus !== 'all' ? (
            <>
              <p>No servers match your filters</p>
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterStatus('all');
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <p>No MCP servers added yet</p>
              <Button onClick={() => navigate('/mcp-catalog')} icon={<Plus size={16} />}>
                Browse Catalog
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="servers-grid">
          {filteredServers.map((server) => {
            const isStdio = (server.type || 'http') === 'stdio';
            const policyCount = server.policy_count || 0;

            return (
              <Card key={server.name} className="server-card">
                <div className="server-card-header">
                  <div
                    className="server-icon"
                    style={{
                      backgroundColor: server.image_icon ? 'transparent' : getServerIconColor(server),
                      border: server.image_icon ? '1px solid var(--border)' : 'none'
                    }}
                  >
                    {server.image_icon ? (
                      <img src={server.image_icon} alt={server.name} className="server-icon-image" />
                    ) : (
                      <span className="icon-letter">{getServerIconLetter(server)}</span>
                    )}
                  </div>
                  <div className="server-header-info">
                    <h3 className="server-name">{server.name}</h3>
                    <div className="server-badges">
                      {server.enabled ? (
                        <span className="badge badge-success">
                          <CheckCircle size={10} /> Active
                        </span>
                      ) : (
                        <span className="badge badge-secondary">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                      <span className={`badge badge-type ${isStdio ? 'stdio' : 'http'}`}>
                        {isStdio ? <Terminal size={10} /> : <Globe size={10} />}
                        {isStdio ? 'STDIO' : 'HTTP'}
                      </span>
                      {policyCount > 0 && (
                        <span className="badge badge-outline">
                          <Shield size={10} /> {policyCount} {policyCount === 1 ? 'policy' : 'policies'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="server-description">
                  {server.description || `MCP server for ${server.name} integration`}
                </p>

                {server.url && (
                  <div className="server-url-info">
                    <span className="label">Endpoint:</span>
                    <code>{server.url}</code>
                  </div>
                )}

                <div className="server-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/mcp-servers/${server.name}?tab=configure`)}
                    icon={<Settings size={14} />}
                  >
                    Configure
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/mcp-servers/${server.name}?tab=permissions`)}
                    icon={<Shield size={14} />}
                  >
                    Policies {policyCount > 0 && `(${policyCount})`}
                  </Button>

                  {isStdio && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConvertToHttp(server)}
                      icon={<ArrowRight size={14} />}
                      title="Convert STDIO server to HTTP endpoint"
                    >
                      Convert to HTTP
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
