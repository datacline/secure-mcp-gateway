import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MCPCatalog from './pages/MCPCatalog';
import MCPServers from './pages/MCPServers';
import MCPServerDetail from './pages/MCPServerDetail';
import PolicyList from './pages/PolicyList';
import PolicyCreate from './pages/PolicyCreate';
import PolicyEdit from './pages/PolicyEdit';
import PolicyView from './pages/PolicyView';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mcp-catalog" element={<MCPCatalog />} />
            <Route path="/mcp-servers" element={<MCPServers />} />
            <Route path="/mcp-servers/:serverName" element={<MCPServerDetail />} />
            <Route path="/policies" element={<PolicyList />} />
            <Route path="/policies/new" element={<PolicyCreate />} />
            <Route path="/policies/:policyId" element={<PolicyView />} />
            <Route path="/policies/:policyId/edit" element={<PolicyEdit />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App

