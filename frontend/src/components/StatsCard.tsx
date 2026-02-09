interface StatsCardProps {
    title: string;
    value: number;
    icon: 'server' | 'check' | 'x';
    color: 'blue' | 'green' | 'gray';
}

const StatsCard = ({ title, value, icon, color }: StatsCardProps) => {
    const colors = {
        blue: {
            bg: 'var(--blue-50)',
            border: 'var(--blue-100)',
            icon: 'var(--blue-600)',
            text: 'var(--blue-700)'
        },
        green: {
            bg: 'var(--green-50)',
            border: 'var(--green-100)',
            icon: 'var(--green-600)',
            text: 'var(--green-700)'
        },
        gray: {
            bg: 'var(--gray-50)',
            border: 'var(--gray-200)',
            icon: 'var(--gray-600)',
            text: 'var(--gray-700)'
        }
    };

    const iconSvgs = {
        server: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
        ),
        check: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        ),
        x: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        )
    };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.75rem',
                backgroundColor: colors[color].bg,
                border: `1px solid ${colors[color].border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors[color].icon,
                flexShrink: 0
            }}>
                {iconSvgs[icon]}
            </div>
            <div>
                <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--gray-600)',
                    marginBottom: '0.25rem'
                }}>
                    {title}
                </p>
                <p style={{
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    color: 'var(--gray-900)',
                    lineHeight: 1
                }}>
                    {value}
                </p>
            </div>
        </div>
    );
};

export default StatsCard;
