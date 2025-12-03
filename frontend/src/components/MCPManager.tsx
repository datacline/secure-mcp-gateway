import { useEffect, useState } from 'react';
import axios from 'axios';
import ServerCard from './ServerCard';
import StatsCard from './StatsCard';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

interface MCPServer {
    name: string;
    url: string;
    type: string;
    enabled: boolean;
    description: string;
    tags: string[];
}

interface ServersResponse {
    servers: MCPServer[];
    count: number;
}

const MCPManager = () => {
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

    const fetchServers = async () => {
        try {
            setLoading(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const response = await axios.get<ServersResponse>(`${apiBaseUrl}/mcp/servers`);
            setServers(response.data.servers);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch servers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    const filteredServers = servers.filter(server => {
        const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            server.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            server.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'enabled' && server.enabled) ||
            (filterStatus === 'disabled' && !server.enabled);

        return matchesSearch && matchesFilter;
    });

    const enabledCount = servers.filter(s => s.enabled).length;
    const disabledCount = servers.filter(s => !s.enabled).length;

    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} />;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)' }}>
            {/* Header */}
            <header style={{
                backgroundColor: 'white',
                borderBottom: '1px solid var(--gray-200)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div className="container" style={{ padding: '1.5rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{
                                fontSize: '1.875rem',
                                fontWeight: 700,
                                color: 'var(--gray-900)',
                                marginBottom: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-600)' }}>
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                </svg>
                                MCP Gateway
                            </h1>
                            <p style={{
                                fontSize: '0.875rem',
                                color: 'var(--gray-500)'
                            }}>
                                Manage and monitor your Model Context Protocol servers
                            </p>
                        </div>
                        <button style={{
                            backgroundColor: 'var(--primary-600)',
                            color: 'white',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-700)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-600)'}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Server
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Section */}
            <div className="container" style={{ padding: '2rem 1rem 0' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <StatsCard
                        title="Total Servers"
                        value={servers.length}
                        icon="server"
                        color="blue"
                    />
                    <StatsCard
                        title="Active"
                        value={enabledCount}
                        icon="check"
                        color="green"
                    />
                    <StatsCard
                        title="Inactive"
                        value={disabledCount}
                        icon="x"
                        color="gray"
                    />
                </div>

                {/* Search and Filter Bar */}
                <div style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    marginBottom: '2rem'
                }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
                                position: 'absolute',
                                left: '0.75rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--gray-400)'
                            }}>
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search servers, tags, or descriptions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.625rem 0.75rem 0.625rem 2.75rem',
                                    border: '1px solid var(--gray-300)',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary-600)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--gray-300)'}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {(['all', 'enabled', 'disabled'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        border: filterStatus === status ? 'none' : '1px solid var(--gray-300)',
                                        backgroundColor: filterStatus === status ? 'var(--primary-600)' : 'white',
                                        color: filterStatus === status ? 'white' : 'var(--gray-700)',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Servers Grid */}
                {filteredServers.length === 0 ? (
                    <EmptyState searchQuery={searchQuery} />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                        gap: '1.5rem',
                        paddingBottom: '3rem'
                    }}>
                        {filteredServers.map((server, index) => (
                            <div key={server.name} className="animate-fadeIn" style={{
                                animationDelay: `${index * 50}ms`
                            }}>
                                <ServerCard server={server} onUpdate={fetchServers} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MCPManager;
