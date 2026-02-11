import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, ShieldCheck, ShieldAlert, Plus, Trash2, Edit2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { 
  javaGatewayMcpApi, 
  mcpServerApi, 
  unifiedPolicyApi,
  type MCPServer, 
  type MCPTool, 
  type MCPServerConfigRequest,
  type MCPServerConfigResponse,
} from '../services/api';
import type { UnifiedPolicy, PolicyStatus } from '../types/policy';
import NewAccessRuleDialog from '../components/NewAccessRuleDialog';
import MCPServerConfigureForm from '../components/MCPServerConfigureForm';
import './MCPServerDetail.css';

export default function MCPServerDetail() {
  const { serverName } = useParams<{ serverName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [serverConfig, setServerConfig] = useState<MCPServerConfigResponse | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [policies, setPolicies] = useState<UnifiedPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'not_tested' | 'connected' | 'failed'>('not_tested');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Get initial tab from URL query param or default to 'permissions'
  const initialTab = (searchParams.get('tab') as 'overview' | 'configure' | 'security' | 'permissions') || 'permissions';
  const [activeTab, setActiveTab] = useState<'overview' | 'configure' | 'security' | 'permissions'>(initialTab);
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  useEffect(() => {
    if (serverName) {
      loadServerDetails();
    }
  }, [serverName]);

  // Load policies when permissions tab is active or when returning to page
  // Use a separate effect that waits for server to load first
  useEffect(() => {
    if (serverName && activeTab === 'permissions' && !loading) {
      loadPolicies();
    }
  }, [serverName, activeTab, loading]);

  // Load tools lazily when overview tab is active and connection not already failed
  useEffect(() => {
    if (serverName && activeTab === 'overview' && !loading && tools.length === 0 && connectionStatus !== 'failed') {
      loadTools();
    }
  }, [serverName, activeTab, loading, connectionStatus]);

  const loadTools = async () => {
    // Only load tools if server is enabled
    if (server && !server.enabled) {
      setConnectionStatus('not_tested');
      setConnectionError('Server is disabled');
      return;
    }

    try {
      // Attempt to list tools - this also tests the connection
      const toolsResponse = await mcpServerApi.getTools(serverName!);
      setTools(toolsResponse.tools);
      setConnectionStatus('connected');
      setConnectionError(null);
    } catch (err) {
      console.warn('Failed to connect to MCP server:', err);
      setConnectionStatus('failed');
      setConnectionError(err instanceof Error ? err.message : 'Failed to connect to server');
      setTools([]);
    }
  };

  const loadServerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load server config with policies from Java Gateway
      try {
        const config = await javaGatewayMcpApi.getConfig(serverName!);
        setServerConfig(config);
        
        // Create a server object from the config
        setServer({
          name: serverName!,
          url: config.url,
          type: config.type,
          timeout: config.timeout,
          enabled: config.enabled,
          description: config.description,
          image_icon: config.image_icon,
          policy_id: config.policy_id,
          tags: config.tags,
          auth: config.auth,
          metadata: config.metadata,
          policies: config.policies,
          policy_count: config.policy_count,
        });

        // Don't use embedded policies here - loadPolicies() will fetch fresh data
        // This prevents race condition where stale embedded data overwrites fresh API data
      } catch (configErr) {
        console.warn('Failed to load config from Java Gateway, falling back:', configErr);
        
        // Fallback to proxy API
        const serversResponse = await mcpServerApi.list();
        const foundServer = serversResponse.servers.find(s => s.name === serverName);
        
        if (!foundServer) {
          setError('Server not found');
          return;
        }
        
        setServer(foundServer);
      }

      // Tools are loaded lazily when needed (e.g., in NewAccessRuleDialog when user selects specific tools)
      // No need to load them proactively here to improve performance
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server details');
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async () => {
    if (!serverName) return;
    
    try {
      setPoliciesLoading(true);
      // Call policy engine directly for policies bound to this MCP server
      const response = await unifiedPolicyApi.getByResource('mcp_server', serverName, true, true);
      setPolicies(response.policies || []);
    } catch (err) {
      console.warn('Failed to load policies:', err);
      // Keep existing policies if fetch fails
    } finally {
      setPoliciesLoading(false);
    }
  };

  const handlePolicyCreated = async () => {
    // Reload policies after a new access rule is created
    await loadPolicies();
  };

  const getStatusIcon = (status: PolicyStatus) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="status-icon active" />;
      case 'draft': return <Edit2 size={14} className="status-icon draft" />;
      case 'suspended': return <Clock size={14} className="status-icon suspended" />;
      case 'retired': return <XCircle size={14} className="status-icon retired" />;
      default: return <AlertCircle size={14} className="status-icon" />;
    }
  };

  const getStatusLabel = (status: PolicyStatus) => {
    switch (status) {
      case 'active': return 'Active';
      case 'draft': return 'Draft';
      case 'suspended': return 'Suspended';
      case 'retired': return 'Retired';
      default: return status;
    }
  };

  const getActionLabel = (rules: any) => {
    if (!rules || !Array.isArray(rules) || rules.length === 0) return 'No rules';
    // policy_rules is an array of rule objects, each with actions
    const firstRule = rules[0];
    if (!firstRule || !firstRule.actions || !Array.isArray(firstRule.actions) || firstRule.actions.length === 0) {
      return 'No rules';
    }
    const firstAction = firstRule.actions[0]?.type;
    if (firstAction === 'allow') return 'Allow';
    if (firstAction === 'deny' || firstAction === 'block') return 'Deny';
    if (firstAction === 'redact') return 'Redact';
    if (firstAction === 'audit') return 'Audit';
    return firstAction || 'Mixed';
  };

  const handleSaveConfig = async (config: MCPServerConfigRequest) => {
    if (!serverName) return;
    
    try {
      await javaGatewayMcpApi.updateConfig(serverName, config);
      // Reload server details
      await loadServerDetails();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  };

  const handleDeleteServer = async () => {
    if (!serverName) return;
    
    try {
      await javaGatewayMcpApi.deleteServer(serverName);
      // Navigate back to servers list
      navigate('/mcp-servers');
    } catch (error) {
      console.error('Failed to delete server:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="mcp-server-detail-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading server details...</p>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="mcp-server-detail-page">
        <div className="error-state">
          <h3>Failed to Load Server</h3>
          <p>{error || 'Server not found'}</p>
          <button onClick={() => navigate('/mcp-servers')} className="btn btn-secondary">
            Back to Servers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-server-detail-page">
      <div className="breadcrumb">
        <button onClick={() => navigate('/mcp-servers')} className="breadcrumb-link">
          🔌 MCPs
        </button>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">{server.name}</span>
      </div>

      <div className="server-header">
        <div className="header-left">
          <div className="server-icon-large">
            {server.image_icon ? (
              <img src={server.image_icon} alt={server.name} className="server-profile-image" />
            ) : (
              server.name.toLowerCase().includes('github') ? '🐙' : '🔌'
            )}
          </div>
          <div className="server-info">
            <h1>{server.name}</h1>
            <div className="server-meta">
              <span className={`status-badge ${server.enabled ? 'status-active' : 'status-inactive'}`}>
                <span className="status-dot"></span>
                {server.enabled ? 'Active' : 'Inactive'}
              </span>
              {server.type && (
                <span className="meta-item">
                  {server.type === 'http' ? '🌐 Hosted' : '📡 ' + server.type}
                </span>
              )}
            </div>
            {server.description && (
              <p className="server-description">{server.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'configure' ? 'active' : ''}`}
          onClick={() => setActiveTab('configure')}
        >
          Configure
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
        <button
          className={`tab ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          Permissions
        </button>
      </div>

      {activeTab === 'permissions' && (
        <div className="permissions-content">
          <div className="section-header">
            <div className="section-title">
              <ShieldCheck size={20} className="section-icon-svg" />
              <h2>Policies</h2>
            </div>
            <p className="section-description">
              Policies control access and behavior for this MCP server. Active policies are enforced during tool invocations.
            </p>
          </div>

          {policiesLoading ? (
            <div className="policies-loading">
              <div className="spinner-small"></div>
              <span>Loading policies...</span>
            </div>
          ) : policies.length === 0 ? (
            <div className="policies-empty">
              <ShieldAlert size={48} className="empty-icon" />
              <h3>No Policies Configured</h3>
              <p>This MCP server has no policies applied. Attach an existing policy to control access and behavior.</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowAccessDialog(true)}
              >
                <Plus size={16} />
                Add Access Policy
              </button>
            </div>
          ) : (
            <>
              <div className="policies-summary">
                <div className="summary-stat">
                  <span className="stat-value">{policies.length}</span>
                  <span className="stat-label">Total Policies</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{policies.filter(p => p.status === 'active').length}</span>
                  <span className="stat-label">Active</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{policies.filter(p => !p.scopes || p.scopes.length === 0).length}</span>
                  <span className="stat-label">Global</span>
                </div>
              </div>

              <div className="policies-table">
                <div className="table-header">
                  <div className="col col-policy">Policy</div>
                  <div className="col col-status">Status</div>
                  <div className="col col-action">Action</div>
                  <div className="col col-priority">Priority</div>
                  <div className="col col-scope">Scope</div>
                  <div className="col col-actions">Actions</div>
                </div>

                <div className="table-body">
                  {policies.map((policy) => (
                    <div key={policy.policy_id} className="table-row policy-row">
                      <div className="col col-policy">
                        <div className="policy-info">
                          <Shield size={16} className="policy-icon" />
                          <div className="policy-details">
                            <span className="policy-name">{policy.name || policy.policy_code}</span>
                            {policy.description && (
                              <span className="policy-description" title={policy.description}>
                                {policy.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col col-status">
                        <span className={`status-badge status-${policy.status}`}>
                          {getStatusIcon(policy.status)}
                          {getStatusLabel(policy.status)}
                        </span>
                      </div>
                      <div className="col col-action">
                        <span className={`action-badge action-${getActionLabel(policy.policy_rules).toLowerCase()}`}>
                          {getActionLabel(policy.policy_rules)}
                        </span>
                      </div>
                      <div className="col col-priority">
                        <span className="priority-value">{policy.priority}</span>
                      </div>
                      <div className="col col-scope">
                        {(!policy.scopes || policy.scopes.length === 0) ? (
                          <span className="scope-badge global">Global</span>
                        ) : (
                          <span className="scope-badge scoped">
                            {policy.scopes.length} principal{policy.scopes.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="col col-actions">
                        <button 
                          className="action-btn" 
                          title="View Policy"
                          onClick={() => navigate(`/policies/${policy.policy_id}`)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="action-btn danger" 
                          title="Remove from Server"
                          onClick={async () => {
                            try {
                              await unifiedPolicyApi.removeResource(
                                policy.policy_id, 
                                'mcp_server', 
                                serverName!
                              );
                              await loadPolicies();
                            } catch (err) {
                              console.error('Failed to remove policy:', err);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-primary"
                onClick={() => setShowAccessDialog(true)}
              >
                <Plus size={16} />
                Add Access Policy
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === 'configure' && (
        <div className="configure-content">
          <MCPServerConfigureForm
            server={server}
            onSave={handleSaveConfig}
            onDelete={handleDeleteServer}
          />
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="overview-content">
          <div className="info-grid">
            <div className="info-card">
              <h3>Server Details</h3>
              <div className="info-row">
                <span className="info-label">Name:</span>
                <span className="info-value">{server.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Type:</span>
                <span className="info-value">{server.type || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">URL:</span>
                <span className="info-value">{server.url || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">{server.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div className="info-card">
              <h3>Available Tools</h3>
              {connectionStatus === 'not_tested' && (
                <p className="info-value text-muted">Connection not tested yet</p>
              )}
              {connectionStatus === 'failed' && (
                <div className="connection-error">
                  <XCircle size={16} className="error-icon" />
                  <p className="error-message">Connection failed: {connectionError}</p>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setConnectionStatus('not_tested');
                      loadTools();
                    }}
                  >
                    Retry Connection
                  </button>
                </div>
              )}
              {connectionStatus === 'connected' && (
                <>
                  <p className="info-value">
                    <CheckCircle size={14} className="success-icon" style={{ marginRight: '4px' }} />
                    {tools.length} tools
                  </p>
                  {tools.length > 0 && (
                    <ul className="tools-list">
                      {tools.slice(0, 5).map((tool) => (
                        <li key={tool.name}>{tool.name}</li>
                      ))}
                      {tools.length > 5 && (
                        <li className="more">+ {tools.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>

            {server.tags && server.tags.length > 0 && (
              <div className="info-card">
                <h3>Tags</h3>
                <div className="tags-container">
                  {server.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAccessDialog && (
        <NewAccessRuleDialog
          serverName={server.name}
          onClose={() => setShowAccessDialog(false)}
          onCreated={handlePolicyCreated}
        />
      )}
    </div>
  );
}
