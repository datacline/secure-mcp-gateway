import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PolicyList from './pages/PolicyList';
import PolicyCreate from './pages/PolicyCreate';
import PolicyEdit from './pages/PolicyEdit';
import PolicyView from './pages/PolicyView';
import Dashboard from './pages/Dashboard';
import MCPServers from './pages/MCPServers';
import MCPServerDetail from './pages/MCPServerDetail';
import MCPCatalog from './pages/MCPCatalog';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/policies" element={<PolicyList />} />
        <Route path="/policies/new" element={<PolicyCreate />} />
        <Route path="/policies/:id" element={<PolicyView />} />
        <Route path="/policies/:id/edit" element={<PolicyEdit />} />
        <Route path="/mcp-servers" element={<MCPServers />} />
        <Route path="/mcp-servers/:serverName" element={<MCPServerDetail />} />
        <Route path="/mcp-catalog" element={<MCPCatalog />} />
      </Routes>
    </Layout>
  );
}

export default App;
