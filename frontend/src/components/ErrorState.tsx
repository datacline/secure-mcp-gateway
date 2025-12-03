interface ErrorStateProps {
    error: string;
}

const ErrorState = ({ error }: ErrorStateProps) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: 'var(--gray-50)',
            padding: '2rem'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '1rem',
                padding: '3rem 2rem',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--red-200)',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--red-50)',
                    border: '2px solid var(--red-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--red-600)' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--gray-900)',
                    marginBottom: '0.75rem'
                }}>
                    Failed to Load Servers
                </h2>
                <p style={{
                    fontSize: '1rem',
                    color: 'var(--gray-600)',
                    marginBottom: '0.5rem'
                }}>
                    We encountered an error while fetching the server list.
                </p>
                <div style={{
                    backgroundColor: 'var(--red-50)',
                    border: '1px solid var(--red-200)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginTop: '1.5rem',
                    marginBottom: '1.5rem'
                }}>
                    <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--red-700)',
                        fontFamily: 'monospace',
                        wordBreak: 'break-word'
                    }}>
                        {error}
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        backgroundColor: 'var(--primary-600)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-700)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-600)'}
                >
                    Try Again
                </button>
            </div>
        </div>
    );
};

export default ErrorState;
