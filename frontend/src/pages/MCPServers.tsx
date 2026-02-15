import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, Globe, Terminal, Plus, RefreshCw, ArrowRight, CheckCircle, XCircle, Search, Menu, ChevronRight, AlertCircle, Trash2, X } from 'lucide-react';
import { javaGatewayMcpApi, type MCPServer, type MCPServerGroup } from '../services/api';
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
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<MCPServerGroup[]>([]);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showAddToGroupMenu, setShowAddToGroupMenu] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configServerName, setConfigServerName] = useState<string>('');
  const [configGroupId, setConfigGroupId] = useState<string>('');
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [policyFilteredTools, setPolicyFilteredTools] = useState(false);
  const [totalServerTools, setTotalServerTools] = useState(0);
  const [invalidToolsWarning, setInvalidToolsWarning] = useState<string[]>([]);
  const navigate = useNavigate();
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadServers();
    loadGroups();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
        setShowAddToGroupMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const loadGroups = async () => {
    try {
      const response = await javaGatewayMcpApi.listGroups();
      setGroups(response.groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
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

  const selectedServerCount = selectedServers.size;
  const selectedServerList = Array.from(selectedServers);

  // Check which selected servers are STDIO (need conversion)
  const getStdioServers = () => {
    return selectedServerList.filter(serverName => {
      const server = servers.find(s => s.name === serverName);
      return server && (server.type || 'http') === 'stdio';
    });
  };

  const stdioServers = getStdioServers();
  const hasStdioServers = stdioServers.length > 0;

  const handleServerSelection = (serverName: string, checked: boolean) => {
    setSelectedServers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serverName);
      else next.delete(serverName);
      return next;
    });
  };

  const handleOpenCreateGroup = () => {
    if (selectedServerCount === 0) return;
    
    // Check if any selected servers are STDIO
    if (hasStdioServers) {
      alert(
        `The following servers must be converted to HTTP before adding to a group:\n\n${stdioServers.join(', ')}\n\n` +
        `Please use the "Convert to HTTP" button on each server's card first.`
      );
      return;
    }
    
    setShowActionsMenu(false);
    setShowAddToGroupMenu(false);
    setIsCreatingGroup(true);
  };

  const handleCreateGroup = async () => {
    const groupName = newGroupName.trim();
    if (!groupName || selectedServerCount === 0) return;

    try {
      await javaGatewayMcpApi.createGroup(groupName, undefined, selectedServerList);
      await loadGroups();
      setNewGroupName('');
      setIsCreatingGroup(false);
      setSelectedServers(new Set());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      alert(`Failed to create group: ${errorMessage}`);
    }
  };

  const handleAddToGroup = async (groupId: string) => {
    if (selectedServerCount === 0) return;

    // Check if any selected servers are STDIO
    if (hasStdioServers) {
      alert(
        `The following servers must be converted to HTTP before adding to a group:\n\n${stdioServers.join(', ')}\n\n` +
        `Please use the "Convert to HTTP" button on each server's card first.`
      );
      return;
    }

    try {
      await javaGatewayMcpApi.addServersToGroup(groupId, selectedServerList);
      await loadGroups();
      setShowActionsMenu(false);
      setShowAddToGroupMenu(false);
      setSelectedServers(new Set());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add servers to group';
      alert(`Failed to add servers to group: ${errorMessage}`);
    }
  };

  const removeServerFromGroup = async (groupId: string, serverName: string) => {
    try {
      await javaGatewayMcpApi.removeServerFromGroup(groupId, serverName);
      await loadGroups();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove server from group';
      alert(`Failed to remove server from group: ${errorMessage}`);
    }
  };

  const deleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await javaGatewayMcpApi.deleteGroup(groupId);
      await loadGroups();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete group';
      alert(`Failed to delete group: ${errorMessage}`);
    }
  };

  const getServerByName = (serverName: string) => {
    return servers.find((server) => server.name === serverName);
  };

  const openToolConfigDialog = async (groupId: string, serverName: string, group: MCPServerGroup) => {
    setConfigGroupId(groupId);
    setConfigServerName(serverName);
    setConfigDialogOpen(true);
    setLoadingTools(true);
    setInvalidToolsWarning([]);

    try {
      // PHASE 3: Fetch policy-allowed tools instead of all tools
      const response = await javaGatewayMcpApi.getPolicyAllowedTools(serverName);
      const toolNames = response.tools.map((tool: any) => tool.name);
      setAvailableTools(toolNames);
      setPolicyFilteredTools(response.policy_filtered || false);
      setTotalServerTools(response.total_server_tools || toolNames.length);

      // Set currently selected tools for this server
      const currentTools = group.tool_config?.[serverName] || [];

      // PHASE 3: Check if any configured tools are NOT allowed by policy
      const invalidTools = currentTools.filter(tool => !toolNames.includes(tool));
      if (invalidTools.length > 0) {
        setInvalidToolsWarning(invalidTools);
      }

      // Only keep tools that are actually allowed by policy
      const validSelectedTools = currentTools.filter(tool => toolNames.includes(tool));
      setSelectedTools(validSelectedTools);
    } catch (err) {
      console.error('Failed to load tools:', err);
      alert('Failed to load tools for this server');
      setConfigDialogOpen(false);
    } finally {
      setLoadingTools(false);
    }
  };

  const saveToolConfiguration = async () => {
    try {
      await javaGatewayMcpApi.configureServerTools(configGroupId, configServerName, selectedTools);
      await loadGroups();
      setConfigDialogOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to configure tools';
      alert(`Failed to configure tools: ${errorMessage}`);
    }
  };

  const toggleToolSelection = (toolName: string) => {
    setSelectedTools(prev => 
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const selectAllTools = () => {
    setSelectedTools([...availableTools]);
  };

  const deselectAllTools = () => {
    setSelectedTools([]);
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

      <div className="selection-actions-bar">
        <div className="selection-summary">
          {selectedServerCount > 0
            ? `${selectedServerCount} MCP ${selectedServerCount === 1 ? 'server' : 'servers'} selected`
            : 'Select MCP servers to perform group actions'}
        </div>

        <div className="actions-menu-wrapper" ref={actionsMenuRef}>
          <button
            className="actions-menu-trigger"
            onClick={() => {
              if (selectedServerCount === 0) return;
              setShowActionsMenu((prev) => !prev);
              setShowAddToGroupMenu(false);
            }}
            disabled={selectedServerCount === 0}
          >
            <Menu size={16} />
            Actions
          </button>

          {showActionsMenu && (
            <div className="actions-menu-dropdown">
              <button className="actions-menu-item" onClick={handleOpenCreateGroup}>
                <Plus size={14} />
                Create Group
              </button>
              <button
                className={`actions-menu-item ${showAddToGroupMenu ? 'active' : ''}`}
                onClick={() => setShowAddToGroupMenu((prev) => !prev)}
                disabled={groups.length === 0}
              >
                Add to Group
                <ChevronRight size={14} />
              </button>

              {showAddToGroupMenu && groups.length > 0 && (
                <div className="actions-submenu">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      className="actions-submenu-item"
                      onClick={() => handleAddToGroup(group.id)}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
                <label className="server-select-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedServers.has(server.name)}
                    onChange={(e) => handleServerSelection(server.name, e.target.checked)}
                  />
                </label>

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

      {(isCreatingGroup || groups.length > 0) && (
        <div className="groups-section">
          <h2>Groups</h2>

          {isCreatingGroup && (
            <Card className="group-card create-group-card">
              <div className="group-title-row">
                <div className="group-name-input-wrapper">
                  <label htmlFor="group-name">Group Name</label>
                  <input
                    id="group-name"
                    type="text"
                    placeholder="Enter group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
              </div>

              <div className="group-members-title">MCP servers:</div>
              {selectedServerList.length === 0 ? (
                <div className="group-empty-text">No MCP servers selected.</div>
              ) : (
                <>
                  {hasStdioServers && (
                    <div className="group-warning-box">
                      <AlertCircle size={16} />
                      <div>
                        <strong>Conversion Required:</strong> The following servers must be converted to HTTP first:
                        <div className="stdio-servers-list">{stdioServers.join(', ')}</div>
                      </div>
                    </div>
                  )}
                  <div className="group-members-list">
                    {selectedServerList.map((serverName) => {
                      const server = getServerByName(serverName);
                      const isStdio = server && (server.type || 'http') === 'stdio';
                      return (
                        <div key={serverName} className={`group-member-row ${isStdio ? 'stdio-warning' : ''}`}>
                          <div className="group-member-info">
                            <span>{server?.name || serverName}</span>
                            {isStdio ? (
                              <span className="badge badge-type stdio">
                                <Terminal size={10} />
                                STDIO
                              </span>
                            ) : (
                              <span className="badge badge-type http">
                                <Globe size={10} />
                                HTTP
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="group-create-actions">
                <Button variant="outline" onClick={() => setIsCreatingGroup(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedServerCount === 0}>
                  Create
                </Button>
              </div>
            </Card>
          )}

          {groups.map((group) => (
            <Card key={group.id} className="group-card">
              <div className="group-title-row">
                <h3>{group.name}</h3>
                <button
                  className="group-delete-btn"
                  onClick={() => deleteGroup(group.id, group.name)}
                  title="Delete group"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {group.gateway_url && (
                <div className="group-gateway-info">
                  <div className="gateway-label">
                    <Globe size={14} />
                    MCP Gateway URL:
                  </div>
                  <code className="gateway-url">{group.gateway_url}</code>
                  <button
                    className="copy-gateway-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(group.gateway_url || '');
                      alert('Gateway URL copied to clipboard!');
                    }}
                    title="Copy gateway URL"
                  >
                    Copy
                  </button>
                </div>
              )}

              <div className="group-members-title">MCP servers ({group.serverNames.length}):</div>
              {group.serverNames.length === 0 ? (
                <div className="group-empty-text">No MCP servers in this group.</div>
              ) : (
                <div className="group-members-list">
                  {group.serverNames.map((serverName) => {
                    const server = getServerByName(serverName);
                    const toolConfig = group.tool_config?.[serverName];
                    const toolsConfigured = toolConfig && toolConfig.length > 0 && !toolConfig.includes('*');
                    
                    return (
                      <div key={`${group.id}-${serverName}`} className="group-member-row">
                        <div className="group-member-info">
                          <span>{server?.name || serverName}</span>
                          <span className="badge badge-type http">
                            <Globe size={10} />
                            HTTP
                          </span>
                          {toolsConfigured && (
                            <span className="badge badge-tools-configured" title={`${toolConfig.length} tools configured`}>
                              {toolConfig.length} tools
                            </span>
                          )}
                        </div>
                        <div className="group-member-actions">
                          <button
                            className="group-member-configure"
                            title="Configure tools"
                            onClick={() => openToolConfigDialog(group.id, serverName, group)}
                          >
                            <Settings size={14} />
                          </button>
                          <button
                            className="group-member-remove"
                            title="Remove from group"
                            onClick={() => removeServerFromGroup(group.id, serverName)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Tool Configuration Dialog */}
      {configDialogOpen && (
        <div className="modal-overlay" onClick={() => setConfigDialogOpen(false)}>
          <div className="modal-content tool-config-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configure Tools for {configServerName}</h3>
              <button className="modal-close" onClick={() => setConfigDialogOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {loadingTools ? (
                <div className="loading-tools">
                  <div className="spinner"></div>
                  <p>Loading available tools...</p>
                </div>
              ) : (
                <>
                  {/* PHASE 3: Policy restriction warning */}
                  {invalidToolsWarning.length > 0 && (
                    <div className="group-warning-box" style={{ marginBottom: '16px' }}>
                      <AlertCircle size={16} />
                      <div>
                        <strong>Policy Restriction:</strong> The following tools were configured but are not allowed by your policies and will be removed:
                        <div className="stdio-servers-list" style={{ marginTop: '8px' }}>
                          {invalidToolsWarning.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PHASE 3: Policy filtering info */}
                  {policyFilteredTools && totalServerTools > availableTools.length && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #90caf9',
                      borderRadius: '4px',
                      marginBottom: '16px',
                      fontSize: '14px'
                    }}>
                      <AlertCircle size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                      <strong>Policy Filtering Active:</strong> Showing {availableTools.length} of {totalServerTools} tools allowed by your policies.
                    </div>
                  )}

                  <p className="tool-config-description">
                    Select which tools from this server should be exposed through the group gateway.
                    {policyFilteredTools
                      ? ' Only tools allowed by your policies are shown.'
                      : ' Leave all unchecked to expose all tools.'}
                  </p>

                  <div className="tool-config-actions">
                    <button className="link-btn" onClick={selectAllTools}>
                      Select All
                    </button>
                    <span className="separator">|</span>
                    <button className="link-btn" onClick={deselectAllTools}>
                      Deselect All
                    </button>
                    <span className="tool-count">{selectedTools.length} of {availableTools.length} selected</span>
                  </div>

                  <div className="tools-list">
                    {availableTools.length === 0 ? (
                      <p className="no-tools">
                        {policyFilteredTools
                          ? 'No tools are allowed by your policies for this server.'
                          : 'No tools available for this server.'}
                      </p>
                    ) : (
                      availableTools.map((toolName) => (
                        <label key={toolName} className="tool-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedTools.includes(toolName)}
                            onChange={() => toggleToolSelection(toolName)}
                          />
                          <span className="tool-name">{toolName}</span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveToolConfiguration} disabled={loadingTools}>
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
