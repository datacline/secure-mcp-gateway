import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
    token: string | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for stored token on mount
        const storedToken = localStorage.getItem('mcp_token');
        if (storedToken) {
            setToken(storedToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
            const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'mcp-gateway';
            const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'mcp-gateway-client';

            const response = await axios.post(
                `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    username,
                    password,
                    grant_type: 'password',
                    client_id: clientId,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const accessToken = response.data.access_token;
            setToken(accessToken);
            localStorage.setItem('mcp_token', accessToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        } catch (error) {
            console.error('Login failed:', error);
            throw new Error('Invalid username or password');
        }
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('mcp_token');
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                isAuthenticated: !!token,
                login,
                logout,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
