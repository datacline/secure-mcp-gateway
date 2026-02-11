import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Zap } from 'lucide-react';
import { type MCPServer, javaGatewayMcpApi } from '../services/api';
import './MCPServerConfigureForm.css';

interface MCPServerConfig {
  name: string;
  url: string;
  type: string;
  timeout: number;
  enabled: boolean;
  description: string;
  image_icon?: string;
  policy_id?: string;
  tags: string[];
  auth?: {
    method?: string;
    location?: string;
    name?: string;
    format?: string;
    prefix?: string;
    credential_ref?: string;
    credential?: string; // Actual credential value
  };
  metadata?: {
    cluster?: string;
    region?: string;
    [key: string]: any;
  };
}

interface MCPServerConfigureFormProps {
  server: MCPServer;
  onSave: (config: MCPServerConfig) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function MCPServerConfigureForm({ server, onSave, onDelete }: MCPServerConfigureFormProps) {
  const [config, setConfig] = useState<MCPServerConfig>({
    name: server.name,
    url: server.url || '',
    type: server.type || 'http',
    timeout: (server as any).timeout || 60,
    enabled: server.enabled,
    description: server.description || '',
    image_icon: server.image_icon || '',
    policy_id: server.policy_id || '',
    tags: server.tags || [],
    auth: (server as any).auth || undefined,
    metadata: (server as any).metadata || {},
  });

  const [tagsInput, setTagsInput] = useState('');
  const [showAuth, setShowAuth] = useState(!!config.auth?.method || !!server.auth?.has_credential);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showCredential, setShowCredential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Helper to mask credential for display
  const getMaskedCredential = (cred: string | undefined) => {
    if (!cred) return '';
    if (cred.length <= 8) return '••••••••';
    return cred.substring(0, 4) + '••••••••' + cred.substring(cred.length - 4);
  };

  useEffect(() => {
    setTagsInput(config.tags.join(', '));
  }, [config.tags]);

  // Test connection to the MCP server - saves config first, then tests
  const handleTestConnection = async () => {
    setTestResult(null);
    setTesting(true);
    setError(null);

    try {
      // First, save the current configuration so the test uses latest auth settings
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

      // Prepare auth config - don't send empty credential if there's existing one on server
      let authToSend = config.auth;
      if (authToSend && !authToSend.credential && server.auth?.has_credential) {
        // Remove credential field entirely to preserve existing on server
        const { credential, ...authWithoutCredential } = authToSend;
        authToSend = authWithoutCredential;
      }

      const updatedConfig = {
        ...config,
        tags,
        auth: authToSend,
      };

      // Save the config first
      await onSave(updatedConfig);

      // Now test the connection with the saved config
      const response = await javaGatewayMcpApi.listTools(server.name);
      
      if (response && response.tools) {
        setTestResult({
          success: true,
          message: `Connection successful! Found ${response.tools.length} tools.`
        });
      } else {
        setTestResult({
          success: true,
          message: 'Connection successful!'
        });
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Connection failed';
      setTestResult({
        success: false,
        message: `Connection failed: ${message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      // Parse tags
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

      // Prepare auth config - don't send empty credential if there's existing one on server
      let authToSend = config.auth;
      if (authToSend && !authToSend.credential && server.auth?.has_credential) {
        // Remove credential field entirely to preserve existing on server
        const { credential, ...authWithoutCredential } = authToSend;
        authToSend = authWithoutCredential;
      }

      const updatedConfig = {
        ...config,
        tags,
        auth: authToSend,
      };

      await onSave(updatedConfig);
      setSuccessMessage('Configuration saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete the MCP server "${server.name}"? This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        setSaving(true);
        await onDelete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete server');
        setSaving(false);
      }
    }
  };

  return (
    <form className="mcp-configure-form" onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          {successMessage}
        </div>
      )}

      <div className="form-section">
        <h3 className="section-title">Basic Information</h3>

        <div className="form-group">
          <label htmlFor="name" className="form-label required">
            Server Name
          </label>
          <input
            id="name"
            type="text"
            className="form-input"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            required
            disabled
            title="Server name cannot be changed"
          />
          <p className="form-hint">Server name cannot be changed after creation</p>
        </div>

        <div className="form-group">
          <label htmlFor="url" className="form-label required">
            Server URL
          </label>
          <input
            id="url"
            type="url"
            className="form-input"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            placeholder="https://api.example.com/mcp"
            required
          />
          <p className="form-hint">The URL where the MCP server is hosted</p>
        </div>

        {/* STDIO Server Configuration */}
        {config.type === 'stdio' && (
          <>
            <div className="form-group">
              <label htmlFor="command" className="form-label">
                Command
              </label>
              <input
                id="command"
                type="text"
                className="form-input"
                value={config.metadata?.command || ''}
                onChange={(e) => setConfig({
                  ...config,
                  metadata: { ...config.metadata, command: e.target.value }
                })}
                placeholder="npx"
                disabled={!!config.metadata?.source}
                title={config.metadata?.source ? 'Command is set from catalog and cannot be changed' : ''}
              />
              <p className="form-hint">
                {config.metadata?.source
                  ? 'Command from catalog (read-only)'
                  : 'The command to execute for this STDIO server'}
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="args" className="form-label">
                Arguments
              </label>
              <input
                id="args"
                type="text"
                className="form-input"
                value={Array.isArray(config.metadata?.args)
                  ? config.metadata.args.join(' ')
                  : (config.metadata?.args || '')}
                onChange={(e) => {
                  const argsArray = e.target.value.split(' ').filter(arg => arg.trim());
                  setConfig({
                    ...config,
                    metadata: { ...config.metadata, args: argsArray }
                  });
                }}
                placeholder="-y @modelcontextprotocol/server-example"
                disabled={!!config.metadata?.source}
                title={config.metadata?.source ? 'Arguments are set from catalog and cannot be changed' : ''}
              />
              <p className="form-hint">
                {config.metadata?.source
                  ? 'Arguments from catalog (read-only)'
                  : 'Space-separated arguments for the command'}
              </p>
            </div>

            {config.metadata?.env && Object.keys(config.metadata.env).length > 0 && (
              <div className="form-group">
                <label className="form-label">Environment Variables</label>
                <div className="env-vars-display">
                  {Object.entries(config.metadata.env).map(([key, value]) => (
                    <div key={key} className="env-var-item">
                      <code className="env-var-key">{key}</code>
                      <span>=</span>
                      <code className="env-var-value">{typeof value === 'string' ? value : JSON.stringify(value)}</code>
                    </div>
                  ))}
                </div>
                <p className="form-hint">Environment variables from catalog configuration</p>
              </div>
            )}
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="type" className="form-label required">
              Server Type
            </label>
            <select
              id="type"
              className="form-input"
              value={config.type}
              onChange={(e) => setConfig({ ...config, type: e.target.value })}
              required
            >
              <option value="http">HTTP</option>
              <option value="stdio">STDIO</option>
              <option value="sse">SSE</option>
              <option value="websocket">WebSocket</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="timeout" className="form-label">
              Timeout (seconds)
            </label>
            <input
              id="timeout"
              type="number"
              className="form-input"
              value={config.timeout}
              onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 60 })}
              min="1"
              max="300"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <span>Enable this server</span>
          </label>
          <p className="form-hint">Disabled servers will not be accessible</p>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description
          </label>
          <textarea
            id="description"
            className="form-textarea"
            value={config.description}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            placeholder="Describe what this MCP server does"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            className="form-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g., github, code, repository"
          />
          <p className="form-hint">Comma-separated tags for categorization</p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="imageIcon" className="form-label">
              Image Icon URL
            </label>
            <div className="image-icon-input-row">
              <input
                id="imageIcon"
                type="url"
                className="form-input"
                value={config.image_icon || ''}
                onChange={(e) => setConfig({ ...config, image_icon: e.target.value })}
                placeholder="https://example.com/icon.png"
              />
              {config.image_icon && (
                <div className="image-icon-preview">
                  <img 
                    src={config.image_icon} 
                    alt="Icon preview" 
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>
            <p className="form-hint">Optional icon URL for this MCP server</p>
          </div>

          <div className="form-group">
            <label htmlFor="policyId" className="form-label">
              Policy ID
            </label>
            <input
              id="policyId"
              type="text"
              className="form-input"
              value={config.policy_id || ''}
              onChange={(e) => setConfig({ ...config, policy_id: e.target.value })}
              placeholder="policy-123"
            />
            <p className="form-hint">Policy ID for server-level access rules</p>
          </div>
        </div>

      </div>

      {/* Authentication Section */}
      <div className="form-section">
        <div className="section-header">
          <h3 className="section-title">Authentication</h3>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => setShowAuth(!showAuth)}
          >
            {showAuth ? '▼ Hide' : '▶ Show'}
          </button>
        </div>

        {showAuth && (
          <div className="section-content">
            <div className="form-group">
              <label htmlFor="auth-method" className="form-label">
                Authentication Method
              </label>
              <select
                id="auth-method"
                className="form-input"
                value={config.auth?.method || 'none'}
                onChange={(e) => {
                  const method = e.target.value;
                  if (method === 'none') {
                    setConfig({ ...config, auth: undefined });
                  } else if (method === 'bearer') {
                    // Set sensible defaults for Bearer token
                    setConfig({
                      ...config,
                      auth: {
                        ...config.auth,
                        method,
                        location: 'header',
                        name: 'Authorization',
                        format: 'prefix',
                        prefix: 'Bearer ',
                      },
                    });
                  } else if (method === 'api_key') {
                    // Set sensible defaults for API key
                    setConfig({
                      ...config,
                      auth: {
                        ...config.auth,
                        method,
                        location: 'header',
                        name: config.auth?.name || 'X-API-Key',
                        format: 'raw',
                      },
                    });
                  } else {
                    setConfig({
                      ...config,
                      auth: {
                        ...config.auth,
                        method,
                      },
                    });
                  }
                }}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth2</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {config.auth && config.auth.method !== 'none' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="auth-location" className="form-label">
                      Location
                    </label>
                    <select
                      id="auth-location"
                      className="form-input"
                      value={config.auth.location || 'header'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          auth: { ...config.auth!, location: e.target.value },
                        })
                      }
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Parameter</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="auth-name" className="form-label">
                      Header/Parameter Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      className="form-input"
                      value={config.auth.name || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          auth: { ...config.auth!, name: e.target.value },
                        })
                      }
                      placeholder="e.g., Authorization"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="auth-format" className="form-label">
                      Format
                    </label>
                    <select
                      id="auth-format"
                      className="form-input"
                      value={config.auth.format || 'raw'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          auth: { ...config.auth!, format: e.target.value },
                        })
                      }
                    >
                      <option value="raw">Raw</option>
                      <option value="prefix">Prefix</option>
                      <option value="template">Template</option>
                    </select>
                  </div>

                  {config.auth.format === 'prefix' && (
                    <div className="form-group">
                      <label htmlFor="auth-prefix" className="form-label">
                        Prefix
                      </label>
                      <input
                        id="auth-prefix"
                        type="text"
                        className="form-input"
                        value={config.auth.prefix || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            auth: { ...config.auth!, prefix: e.target.value },
                          })
                        }
                        placeholder="e.g., Bearer "
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="auth-credential" className="form-label">
                    {config.auth?.method === 'bearer' ? 'Access Token' : 'API Key / Credential'}
                  </label>
                  <div className="credential-input-wrapper">
                    <input
                      id="auth-credential"
                      type={showCredential ? 'text' : 'password'}
                      className="form-input credential-input"
                      value={config.auth?.credential || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          auth: { ...config.auth!, credential: e.target.value },
                        })
                      }
                      placeholder={
                        server.auth?.has_credential 
                          ? 'Leave blank to keep existing credential...' 
                          : (config.auth?.method === 'bearer' ? 'Enter your access token...' : 'Enter your API key...')
                      }
                    />
                    <button
                      type="button"
                      className="toggle-visibility-btn"
                      onClick={() => setShowCredential(!showCredential)}
                      title={showCredential ? 'Hide credential' : 'Show credential'}
                    >
                      {showCredential ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Show server-stored masked credential if exists */}
                  {server.auth?.has_credential && server.auth?.credential_masked && !config.auth?.credential && (
                    <p className="form-hint credential-stored">
                      <CheckCircle size={12} /> Credential stored: {server.auth.credential_masked}
                    </p>
                  )}
                  {/* Show local input preview */}
                  {config.auth?.credential && (
                    <p className="form-hint credential-masked">
                      New credential: {getMaskedCredential(config.auth.credential)}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="auth-credential-ref" className="form-label">
                    Credential Reference (Optional)
                  </label>
                  <input
                    id="auth-credential-ref"
                    type="text"
                    className="form-input"
                    value={config.auth?.credential_ref || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        auth: { ...config.auth!, credential_ref: e.target.value },
                      })
                    }
                    placeholder="e.g., env://GITHUB_TOKEN"
                  />
                  <p className="form-hint">
                    Alternative: Use env://VAR_NAME to reference an environment variable
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Metadata Section */}
      <div className="form-section">
        <div className="section-header">
          <h3 className="section-title">Metadata</h3>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            {showMetadata ? '▼ Hide' : '▶ Show'}
          </button>
        </div>

        {showMetadata && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="meta-cluster" className="form-label">
                  Cluster
                </label>
                <input
                  id="meta-cluster"
                  type="text"
                  className="form-input"
                  value={config.metadata?.cluster || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      metadata: { ...config.metadata, cluster: e.target.value },
                    })
                  }
                  placeholder="e.g., production"
                />
              </div>

              <div className="form-group">
                <label htmlFor="meta-region" className="form-label">
                  Region
                </label>
                <input
                  id="meta-region"
                  type="text"
                  className="form-input"
                  value={config.metadata?.region || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      metadata: { ...config.metadata, region: e.target.value },
                    })
                  }
                  placeholder="e.g., us-east-1"
                />
              </div>
            </div>

            <p className="form-hint">Additional metadata for organizing and filtering servers</p>
          </div>
        )}
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <div className="actions-left">
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={saving || testing}
            >
              Delete Server
            </button>
          )}
        </div>
        <div className="actions-right">
          <button
            type="button"
            className="btn btn-test"
            onClick={handleTestConnection}
            disabled={saving || testing}
            title="Saves configuration and tests the connection"
          >
            {testing ? (
              <>
                <Loader2 size={16} className="spinning" />
                Saving & Testing...
              </>
            ) : (
              <>
                <Zap size={16} />
                Save & Test Connection
              </>
            )}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || testing}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </form>
  );
}
