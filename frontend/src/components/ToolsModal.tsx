import { useEffect, useState } from 'react';
import axios from 'axios';

interface Tool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
    };
}

interface ToolsModalProps {
    serverName: string;
    onClose: () => void;
}

const ToolsModal = ({ serverName, onClose }: ToolsModalProps) => {
    const [tools, setTools] = useState<Tool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTools = async () => {
            try {
                setLoading(true);
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                const response = await axios.get(`${apiBaseUrl}/mcp/list-tools`, {
                    params: { mcp_server: serverName }
                });
                setTools(response.data.tools || []);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch tools');
            } finally {
                setLoading(false);
            }
        };

        fetchTools();
    }, [serverName]);

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
                maxWidth: '800px',
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
                            Available Tools
                        </h2>
                        <p style={{
                            fontSize: '0.875rem',
                            color: 'var(--gray-500)'
                        }}>
                            Server: <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{serverName}</span>
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
                    {loading && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3rem'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid var(--gray-200)',
                                borderTopColor: 'var(--primary-600)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></div>
                            <p style={{
                                marginTop: '1rem',
                                color: 'var(--gray-600)',
                                fontSize: '0.875rem'
                            }}>
                                Loading tools...
                            </p>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            backgroundColor: 'var(--red-50)',
                            border: '1px solid var(--red-200)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            color: 'var(--red-700)',
                            fontSize: '0.875rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {!loading && !error && tools.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            color: 'var(--gray-500)'
                        }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem', color: 'var(--gray-400)' }}>
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                            </svg>
                            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>No tools available</p>
                            <p style={{ fontSize: '0.875rem' }}>This server doesn't expose any tools.</p>
                        </div>
                    )}

                    {!loading && !error && tools.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {tools.map((tool, index) => (
                                <div key={index} style={{
                                    backgroundColor: 'var(--gray-50)',
                                    border: '1px solid var(--gray-200)',
                                    borderRadius: '0.5rem',
                                    padding: '1rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = 'var(--primary-600)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                                    e.currentTarget.style.borderColor = 'var(--gray-200)';
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '0.375rem',
                                            backgroundColor: 'var(--primary-100)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-600)' }}>
                                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                color: 'var(--gray-900)',
                                                marginBottom: '0.25rem',
                                                fontFamily: 'monospace'
                                            }}>
                                                {tool.name}
                                            </h3>
                                            {tool.description && (
                                                <p style={{
                                                    fontSize: '0.875rem',
                                                    color: 'var(--gray-600)',
                                                    marginBottom: '0.5rem',
                                                    lineHeight: 1.5
                                                }}>
                                                    {tool.description}
                                                </p>
                                            )}
                                            {tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0 && (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--gray-500)'
                                                }}>
                                                    <span style={{ fontWeight: 500 }}>Parameters:</span>{' '}
                                                    {Object.keys(tool.inputSchema.properties).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--gray-200)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--gray-50)'
                }}>
                    <span style={{
                        fontSize: '0.875rem',
                        color: 'var(--gray-600)'
                    }}>
                        {!loading && !error && `${tools.length} tool${tools.length !== 1 ? 's' : ''} available`}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--gray-700)',
                            backgroundColor: 'white',
                            border: '1px solid var(--gray-300)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Close
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

export default ToolsModal;
