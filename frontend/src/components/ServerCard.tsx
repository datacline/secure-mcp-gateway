import { useState } from 'react';
import ToolsModal from './ToolsModal';
import ConfigureModal from './ConfigureModal';

interface MCPServer {
    name: string;
    url: string;
    type: string;
    enabled: boolean;
    description: string;
    tags: string[];
}

interface ServerCardProps {
    server: MCPServer;
    onUpdate?: () => void;
}

const ServerCard = ({ server, onUpdate }: ServerCardProps) => {
    const [showToolsModal, setShowToolsModal] = useState(false);
    const [showConfigureModal, setShowConfigureModal] = useState(false);

    const handleViewTools = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowToolsModal(true);
    };

    const handleConfigure = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowConfigureModal(true);
    };

    return (
        <>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--gray-200)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
                cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            color: 'var(--gray-900)',
                            marginBottom: '0.25rem',
                            wordBreak: 'break-word'
                        }}>
                            {server.name}
                        </h3>
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--gray-500)',
                            backgroundColor: 'var(--gray-100)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {server.type}
                        </span>
                    </div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        backgroundColor: server.enabled ? 'var(--green-50)' : 'var(--gray-100)',
                        color: server.enabled ? 'var(--green-700)' : 'var(--gray-600)',
                        marginLeft: '0.75rem',
                        whiteSpace: 'nowrap'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: server.enabled ? 'var(--green-500)' : 'var(--gray-400)'
                        }}></span>
                        {server.enabled ? 'Active' : 'Inactive'}
                    </span>
                </div>

                {/* Description */}
                {server.description && (
                    <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--gray-600)',
                        marginBottom: '1rem',
                        lineHeight: 1.5
                    }}>
                        {server.description}
                    </p>
                )}

                {/* URL */}
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--gray-200)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem'
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gray-400)', flexShrink: 0 }}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'var(--gray-500)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Endpoint
                        </span>
                    </div>
                    <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--gray-700)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        lineHeight: 1.4
                    }}>
                        {server.url}
                    </p>
                </div>

                {/* Tags */}
                {server.tags && server.tags.length > 0 && (
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                        }}>
                            {server.tags.map((tag, index) => (
                                <span
                                    key={index}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0.25rem 0.625rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        borderRadius: '0.375rem',
                                        backgroundColor: 'var(--blue-50)',
                                        color: 'var(--blue-600)',
                                        border: '1px solid var(--blue-100)'
                                    }}
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--gray-200)'
                }}>
                    <button
                        onClick={handleViewTools}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--primary-600)',
                            backgroundColor: 'white',
                            border: '1px solid var(--primary-600)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                        }}>
                        View Tools
                    </button>
                    <button
                        onClick={handleConfigure}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: 'var(--primary-600)',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-700)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-600)';
                        }}>
                        Configure
                    </button>
                </div>
            </div>

            {/* Modals */}
            {showToolsModal && (
                <ToolsModal
                    serverName={server.name}
                    onClose={() => setShowToolsModal(false)}
                />
            )}

            {showConfigureModal && (
                <ConfigureModal
                    server={server}
                    onClose={() => setShowConfigureModal(false)}
                    onUpdate={() => {
                        if (onUpdate) onUpdate();
                    }}
                />
            )}
        </>
    );
};

export default ServerCard;
