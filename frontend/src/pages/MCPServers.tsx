import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield } from 'lucide-react';
import { javaGatewayMcpApi, type MCPServer } from '../services/api';
import './MCPServers.css';

export default function MCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Load servers from Java Gateway (policies loaded on detail page from policy engine directly)
      const response = await javaGatewayMcpApi.listServers();
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

    return matchesSearch;
  });

  const getServerIconLetter = (server: MCPServer) => {
    // Return first letter or specific icon letter
    if (server.name.toLowerCase().includes('notion')) return 'N';
    if (server.name.toLowerCase().includes('github')) return 'G';
    if (server.name.toLowerCase().includes('gmail')) return 'M';
    if (server.name.toLowerCase().includes('figma')) return 'F';
    if (server.name.toLowerCase().includes('slack')) return 'S';
    if (server.name.toLowerCase().includes('atlassian')) return 'A';
    if (server.name.toLowerCase().includes('aws')) return 'AWS';
    if (server.name.toLowerCase().includes('sap')) return 'SAP';
    if (server.name.toLowerCase().includes('datadog')) return 'D';
    return server.name.charAt(0).toUpperCase();
  };

  const getServerIconColor = (server: MCPServer) => {
    const name = server.name.toLowerCase();
    if (name.includes('notion')) return '#000000';
    if (name.includes('github')) return '#181717';
    if (name.includes('gmail')) return '#EA4335';
    if (name.includes('figma')) return '#F24E1E';
    if (name.includes('slack')) return '#4A154B';
    if (name.includes('atlassian')) return '#0052CC';
    if (name.includes('aws')) return '#FF9900';
    if (name.includes('sap')) return '#0FAAFF';
    if (name.includes('datadog')) return '#632CA6';
    return '#6B7280';
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
          <button onClick={loadServers} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-servers-page">
      <div className="page-header">
        <h1 className="page-title">MCP Integrations</h1>
        <p className="page-subtitle">
          Connect your AI governance platform with Model Context Protocol (MCP) servers to extend 
          capabilities and integrate with your existing tools.
        </p>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading MCP servers...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <h3>Failed to Load Servers</h3>
          <p>{error}</p>
          <button onClick={loadServers} className="btn btn-primary">
            Retry
          </button>
        </div>
      ) : (
        <>
          {searchQuery && (
            <div className="search-box">
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {filteredServers.length === 0 ? (
            <div className="empty-state">
              <p>No MCP servers found</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="btn btn-secondary">
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="integrations-grid">
              {filteredServers.map((server) => (
                <div key={server.name} className="integration-card">
                  <div className="card-content">
                    <div className="card-header">
                      <div 
                        className="server-icon"
                        style={{ backgroundColor: server.image_icon ? 'transparent' : getServerIconColor(server) }}
                      >
                        {server.image_icon ? (
                          <img src={server.image_icon} alt={server.name} className="server-icon-image" />
                        ) : (
                          <span className="icon-letter">
                            {getServerIconLetter(server)}
                          </span>
                        )}
                      </div>
                      <div className="card-title-section">
                        <h3 className="server-name">{server.name} MCP</h3>
                        <div className="status-badges">
                          {server.enabled && (
                            <span className="status-badge connected">Connected</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="server-description">
                      {server.description || 'Connect to ' + server.name + ' for enhanced capabilities and integrations.'}
                    </p>
                  </div>

                  <div className="card-actions">
                    <button 
                      className="btn btn-configure"
                      onClick={() => navigate(`/mcp-servers/${server.name}`)}
                    >
                      <Settings size={16} />
                      Configure
                    </button>
                    <button 
                      className="btn btn-add"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/mcp-servers/${server.name}?tab=permissions`);
                      }}
                    >
                      <Shield size={16} />
                      Policies
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
