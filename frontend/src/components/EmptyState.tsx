interface EmptyStateProps {
    searchQuery: string;
}

const EmptyState = ({ searchQuery }: EmptyStateProps) => {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            border: '2px dashed var(--gray-300)'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--gray-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
            }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gray-400)' }}>
                    {searchQuery ? (
                        <>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </>
                    ) : (
                        <>
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                        </>
                    )}
                </svg>
            </div>
            <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--gray-900)',
                marginBottom: '0.5rem'
            }}>
                {searchQuery ? 'No servers found' : 'No servers configured'}
            </h3>
            <p style={{
                fontSize: '0.875rem',
                color: 'var(--gray-500)',
                maxWidth: '400px',
                margin: '0 auto 2rem'
            }}>
                {searchQuery
                    ? `No servers match "${searchQuery}". Try adjusting your search or filters.`
                    : 'Get started by adding your first MCP server to the gateway.'
                }
            </p>
            {!searchQuery && (
                <button style={{
                    backgroundColor: 'var(--primary-600)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'inline-flex',
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
                    Add Your First Server
                </button>
            )}
        </div>
    );
};

export default EmptyState;
