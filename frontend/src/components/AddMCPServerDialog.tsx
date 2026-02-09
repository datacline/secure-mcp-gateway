import { useState, useEffect } from 'react';
import { X, Globe, Terminal, Key, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { type MCPCatalogItem } from '../data/mcpCatalog';
import { javaGatewayMcpApi, type MCPServerConfigRequest } from '../services/api';
import './AddMCPServerDialog.css';

interface AddMCPServerDialogProps {
  server: MCPCatalogItem;
  onClose: () => void;
  onSuccess: (serverName: string) => void;
}

interface AuthConfig {
  method: 'none' | 'bearer' | 'api_key';
  credential: string;
  headerName: string;
}

export default function AddMCPServerDialog({ server, onClose, onSuccess }: AddMCPServerDialogProps) {
  const serverType = server.type || server.config?.type || 'stdio';
  const isHttpServer = serverType === 'http' || serverType === 'sse';

  // Form state
  const [serverName, setServerName] = useState('');
  const [url, setUrl] = useState(server.config?.url || '');
  const [description, setDescription] = useState(server.description || '');
  const [timeout, setTimeout] = useState(60);
  const [enabled, setEnabled] = useState(true);
  
  // Auth state
  const [authMethod, setAuthMethod] = useState<'none' | 'bearer' | 'api_key'>('none');
  const [credential, setCredential] = useState('');
  const [headerName, setHeaderName] = useState('Authorization');
  const [showCredential, setShowCredential] = useState(false);
  
  // Environment variables for stdio servers
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Initialize form based on server config
  useEffect(() => {
    // Generate server name from catalog item name
    const name = server.name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setServerName(name);

    // Set URL for HTTP servers
    if (isHttpServer && server.config?.url) {
      setUrl(server.config.url);
    }

    // Detect auth method from config
    if (server.config?.auth_method === 'bearer') {
      setAuthMethod('bearer');
      setHeaderName(server.config.auth_header_name || 'Authorization');
    } else if (server.config?.auth_method === 'api_key') {
      setAuthMethod('api_key');
      setHeaderName(server.config.auth_header_name || 'X-API-Key');
    } else if (server.config?.headers) {
      // Check if headers indicate auth is needed
      const hasAuthHeader = Object.keys(server.config.headers).some(
        h => h.toLowerCase().includes('auth') || h.toLowerCase().includes('api-key')
      );
      if (hasAuthHeader) {
        const headerKey = Object.keys(server.config.headers).find(
          h => h.toLowerCase().includes('auth') || h.toLowerCase().includes('api-key')
        );
        if (headerKey?.toLowerCase() === 'authorization') {
          setAuthMethod('bearer');
          setHeaderName('Authorization');
        } else {
          setAuthMethod('api_key');
          setHeaderName(headerKey || 'X-API-Key');
        }
      }
    } else if (server.config?.env) {
      // For stdio servers, check if env vars suggest auth is needed
      const authEnvVars = Object.keys(server.config.env).filter(
        k => k.toLowerCase().includes('token') || 
             k.toLowerCase().includes('key') || 
             k.toLowerCase().includes('secret')
      );
      if (authEnvVars.length > 0) {
        setAuthMethod('bearer');
      }
    }

    // Initialize env vars for stdio servers
    if (!isHttpServer && server.config?.env) {
      const initialEnvVars: Record<string, string> = {};
      Object.keys(server.config.env).forEach(key => {
        initialEnvVars[key] = ''; // Empty initially, user fills in
      });
      setEnvVars(initialEnvVars);
    }
  }, [server, isHttpServer]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Build the server config
      const config: MCPServerConfigRequest = {
        url: isHttpServer ? url : `stdio://${serverName}`,
        type: serverType === 'sse' ? 'http' : serverType,
        timeout,
        enabled,
        description,
        tags: server.tags || [],
        metadata: {
          source: 'postman-catalog',
          catalogId: server.id,
          publisherId: server.publisher.id,
          publisherName: server.publisher.name,
          verified: server.publisher.verified,
          serverType,
          command: server.config?.command,
          args: server.config?.args,
        },
      };

      // Add auth configuration
      if (authMethod !== 'none' && credential) {
        if (authMethod === 'bearer') {
          config.auth = {
            method: 'bearer',
            location: 'header',
            name: headerName,
            format: 'prefix',
            prefix: 'Bearer ',
            // Store credential directly for now (in production, use env ref)
            credential: credential,
          };
        } else if (authMethod === 'api_key') {
          config.auth = {
            method: 'api_key',
            location: 'header',
            name: headerName,
            format: 'raw',
            credential: credential,
          };
        }
      }

      // Add env vars for stdio servers
      if (!isHttpServer && Object.keys(envVars).length > 0) {
        const filledEnvVars: Record<string, string> = {};
        Object.entries(envVars).forEach(([key, value]) => {
          if (value) {
            filledEnvVars[key] = value;
          }
        });
        if (Object.keys(filledEnvVars).length > 0) {
          config.metadata = {
            ...config.metadata,
            env: filledEnvVars,
          };
        }
      }

      await javaGatewayMcpApi.createServer(serverName, config);
      onSuccess(serverName);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to add server';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    setTesting(true);

    try {
      // Validate the inputs
      if (!serverName) {
        setTestResult({ success: false, message: 'Server name is required' });
        return;
      }

      if (isHttpServer && !url) {
        setTestResult({ success: false, message: 'URL is required for HTTP servers' });
        return;
      }

      if (authMethod !== 'none' && !credential) {
        setTestResult({ success: false, message: 'Credential is required when authentication is enabled' });
        return;
      }

      // Validate URL format for HTTP servers
      if (isHttpServer) {
        try {
          new URL(url);
        } catch {
          setTestResult({ success: false, message: 'Invalid URL format' });
          return;
        }
      }

      // All validations passed
      setTestResult({ 
        success: true, 
        message: 'Configuration is valid. Add the server to test the connection.' 
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Validation failed' });
    } finally {
      setTesting(false);
    }
  };

  const updateEnvVar = (key: string, value: string) => {
    setEnvVars(prev => ({ ...prev, [key]: value }));
  };

  const requiredEnvVars = Object.entries(server.config?.env || {}).filter(
    ([_, value]) => value.includes('{{') || value.includes('$')
  );

  return (
    <div className="add-server-overlay" onClick={onClose}>
      <div className="add-server-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title-row">
            <div className="dialog-icon">
              {isHttpServer ? <Globe size={24} /> : <Terminal size={24} />}
            </div>
            <div>
              <h2>Add {server.name}</h2>
              <span className="server-type-badge">
                {serverType.toUpperCase()} Server
              </span>
            </div>
          </div>
          <button className="dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-body">
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-section">
            <h3>Basic Configuration</h3>
            
            <div className="form-group">
              <label htmlFor="serverName">Server Name *</label>
              <input
                id="serverName"
                type="text"
                value={serverName}
                onChange={e => setServerName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="my-mcp-server"
              />
              <span className="form-help">Unique identifier for this server</span>
            </div>

            {isHttpServer && (
              <div className="form-group">
                <label htmlFor="url">Server URL *</label>
                <input
                  id="url"
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                />
              </div>
            )}

            {!isHttpServer && server.config?.command && (
              <div className="form-group">
                <label>Command</label>
                <div className="command-display">
                  <code>{server.config.command} {(server.config.args || []).join(' ')}</code>
                </div>
                <span className="form-help">This command will be used to start the MCP server</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="timeout">Timeout (seconds)</label>
                <input
                  id="timeout"
                  type="number"
                  value={timeout}
                  onChange={e => setTimeout(parseInt(e.target.value) || 60)}
                  min={1}
                  max={300}
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                  />
                  Enable server after adding
                </label>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <Key size={16} />
              Authentication
            </h3>

            <div className="form-group">
              <label htmlFor="authMethod">Authentication Method</label>
              <select
                id="authMethod"
                value={authMethod}
                onChange={e => setAuthMethod(e.target.value as any)}
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
              </select>
            </div>

            {authMethod !== 'none' && (
              <>
                <div className="form-group">
                  <label htmlFor="headerName">Header Name</label>
                  <input
                    id="headerName"
                    type="text"
                    value={headerName}
                    onChange={e => setHeaderName(e.target.value)}
                    placeholder={authMethod === 'bearer' ? 'Authorization' : 'X-API-Key'}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="credential">
                    {authMethod === 'bearer' ? 'Access Token' : 'API Key'} *
                  </label>
                  <div className="credential-input">
                    <input
                      id="credential"
                      type={showCredential ? 'text' : 'password'}
                      value={credential}
                      onChange={e => setCredential(e.target.value)}
                      placeholder={authMethod === 'bearer' ? 'Enter your access token...' : 'Enter your API key...'}
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      onClick={() => setShowCredential(!showCredential)}
                    >
                      {showCredential ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="form-help">
                    Your credentials are stored securely and used to authenticate with the MCP server
                  </span>
                </div>
              </>
            )}
          </div>

          {!isHttpServer && requiredEnvVars.length > 0 && (
            <div className="form-section">
              <h3>
                <Terminal size={16} />
                Environment Variables
              </h3>
              <p className="section-description">
                This server requires the following environment variables to be set:
              </p>

              {requiredEnvVars.map(([key, templateValue]) => (
                <div key={key} className="form-group">
                  <label htmlFor={`env-${key}`}>{key}</label>
                  <input
                    id={`env-${key}`}
                    type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                    value={envVars[key] || ''}
                    onChange={e => updateEnvVar(key, e.target.value)}
                    placeholder={`Enter value for ${key}...`}
                  />
                  <span className="form-help">Template: {templateValue}</span>
                </div>
              ))}
            </div>
          )}

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {testResult.message}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            className="btn btn-test"
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? (
              <>
                <Loader2 size={16} className="spinning" />
                Testing...
              </>
            ) : (
              'Validate'
            )}
          </button>

          <div className="footer-actions">
            <button className="btn btn-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn-save"
              onClick={handleSave}
              disabled={saving || !serverName || (isHttpServer && !url)}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Add Server
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
