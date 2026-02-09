import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, List, Plus, Activity, Server, Library } from 'lucide-react';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Shield className="logo-icon" size={32} />
          <h1>Policy Manager</h1>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
          >
            <Activity size={20} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/mcp-servers"
            className={`nav-item ${isActive('/mcp-servers') ? 'active' : ''}`}
          >
            <Server size={20} />
            <span>MCP Servers</span>
          </Link>

          <Link
            to="/mcp-catalog"
            className={`nav-item ${isActive('/mcp-catalog') ? 'active' : ''}`}
          >
            <Library size={20} />
            <span>MCP Catalog</span>
          </Link>

          <Link
            to="/policies"
            className={`nav-item ${isActive('/policies') ? 'active' : ''}`}
          >
            <List size={20} />
            <span>Policies</span>
          </Link>

          <Link
            to="/policies/new"
            className="nav-item nav-item-create"
          >
            <Plus size={20} />
            <span>Create Policy</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <p className="text-sm">MCP Gateway Policy Engine</p>
          <p className="text-xs">v1.0.0</p>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
