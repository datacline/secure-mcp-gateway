import { useState } from 'react';
import axios from 'axios';

interface MCPServer {
    name: string;
    url: string;
    type: string;
    enabled: boolean;
    description: string;
    tags: string[];
}

interface ConfigureModalProps {
    server: MCPServer;
    onClose: () => void;
    onUpdate: () => void;
}

const ConfigureModal = ({ server, onClose, onUpdate }: ConfigureModalProps) => {
    const [formData, setFormData] = useState({
        enabled: server.enabled,
        description: server.description,
        tags: server.tags.join(', ')
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

            // Call the backend API to update server configuration
            await axios.patch(`${apiBaseUrl}/mcp/server/${server.name}`, {
                enabled: formData.enabled,
                description: formData.description,
                tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
            });

            setSuccess(true);
            setTimeout(() => {
                onUpdate();
                onClose();
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update server');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '1rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--gray-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--gray-900)',
                            marginBottom: '0.25rem'
                        }}>
                            Configure Server
                        </h2>
                        <p style={{
                            fontSize: '0.875rem',
                            color: 'var(--gray-500)',
                            fontFamily: 'monospace'
                        }}>
                            {server.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: 'var(--gray-100)',
                            color: 'var(--gray-600)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-200)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '1.5rem'
                }}>
                    {success && (
                        <div style={{
                            backgroundColor: 'var(--green-50)',
                            border: '1px solid var(--green-200)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--green-600)' }}>
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span style={{ color: 'var(--green-700)', fontSize: '0.875rem', fontWeight: 500 }}>
                                Server updated successfully!
                            </span>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            backgroundColor: 'var(--red-50)',
                            border: '1px solid var(--red-200)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            marginBottom: '1rem',
                            color: 'var(--red-700)',
                            fontSize: '0.875rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Read-only fields */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            marginBottom: '0.5rem'
                        }}>
                            Server Name
                        </label>
                        <input
                            type="text"
                            value={server.name}
                            disabled
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                border: '1px solid var(--gray-300)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                backgroundColor: 'var(--gray-100)',
                                color: 'var(--gray-600)',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            marginBottom: '0.5rem'
                        }}>
                            URL
                        </label>
                        <input
                            type="text"
                            value={server.url}
                            disabled
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                border: '1px solid var(--gray-300)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                backgroundColor: 'var(--gray-100)',
                                color: 'var(--gray-600)',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    {/* Editable fields */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer'
                                }}
                            />
                            Enable Server
                        </label>
                        <p style={{
                            fontSize: '0.75rem',
                            color: 'var(--gray-500)',
                            marginTop: '0.25rem',
                            marginLeft: '1.625rem'
                        }}>
                            When disabled, this server will not be available for tool execution
                        </p>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            marginBottom: '0.5rem'
                        }}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                border: '1px solid var(--gray-300)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                outline: 'none',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary-600)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--gray-300)'}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            marginBottom: '0.5rem'
                        }}>
                            Tags
                        </label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            placeholder="production, logging, database"
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                border: '1px solid var(--gray-300)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary-600)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--gray-300)'}
                        />
                        <p style={{
                            fontSize: '0.75rem',
                            color: 'var(--gray-500)',
                            marginTop: '0.25rem'
                        }}>
                            Comma-separated tags for organizing servers
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--gray-200)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    backgroundColor: 'var(--gray-50)'
                }}>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            backgroundColor: 'white',
                            border: '1px solid var(--gray-300)',
                            borderRadius: '0.375rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = 'var(--gray-100)')}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: saving ? 'var(--gray-400)' : 'var(--primary-600)',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = 'var(--primary-700)')}
                        onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = 'var(--primary-600)')}
                    >
                        {saving && (
                            <div style={{
                                width: '14px',
                                height: '14px',
                                border: '2px solid white',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 0.6s linear infinite'
                            }}></div>
                        )}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ConfigureModal;
