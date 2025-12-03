const LoadingState = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: 'var(--gray-50)'
        }}>
            <div style={{
                position: 'relative',
                width: '64px',
                height: '64px'
            }}>
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: '4px solid var(--gray-200)',
                    borderRadius: '50%'
                }}></div>
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: '4px solid transparent',
                    borderTopColor: 'var(--primary-600)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
            <p style={{
                marginTop: '1.5rem',
                fontSize: '1.125rem',
                fontWeight: 500,
                color: 'var(--gray-600)'
            }}>
                Loading servers...
            </p>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoadingState;
