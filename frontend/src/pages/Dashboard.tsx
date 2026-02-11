import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, Server, FileText, Activity, Plus, ExternalLink } from 'lucide-react';
import { unifiedPolicyApi, javaGatewayMcpApi, healthCheck } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import './Dashboard.css';

export default function Dashboard() {
  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ['unified-policies'],
    queryFn: () => unifiedPolicyApi.list(),
  });

  const { data: serversData, isLoading: serversLoading } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: () => javaGatewayMcpApi.listServers(),
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
    refetchInterval: 30000,
  });

  const policies = policiesData?.policies || [];
  const servers = serversData?.servers || [];

  const activePoliciesCount = policies.filter((p) => p.status === 'active').length;
  const activeServersCount = servers.filter((s) => s.enabled).length;

  // For now, we don't have audit logs endpoint, so we'll show 0
  // TODO: Add audit logs API and fetch data
  const auditLogsCount = 0;

  const stats = [
    {
      label: 'Active MCP Servers',
      value: activeServersCount,
      total: servers.length,
      icon: Server,
      color: 'primary',
      link: '/mcp-servers',
    },
    {
      label: 'Active Policies',
      value: activePoliciesCount,
      total: policies.length,
      icon: Shield,
      color: 'success',
      link: '/policies',
    },
    {
      label: 'Audit Logs',
      value: auditLogsCount,
      icon: FileText,
      color: 'secondary',
      link: '/audit-logs',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Overview of your MCP Gateway and policy management system
          </p>
        </div>
      </div>

      {/* Service Status */}
      <Card title="Service Status">
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Policy Engine</span>
            <span className={`status-badge status-${health ? 'healthy' : 'error'}`}>
              {health ? '● Healthy' : '● Offline'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Service Name</span>
            <span className="status-value">{health?.service || 'Unknown'}</span>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link} className="stat-card-link">
            <Card className="stat-card">
              <div className="stat-content">
                <div className={`stat-icon stat-icon-${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <p className="stat-value">
                    {serversLoading || policiesLoading ? '...' : stat.value}
                    {stat.total !== undefined && (
                      <span className="stat-total"> / {stat.total}</span>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent MCP Servers */}
      <Card
        title="Recent MCP Servers"
        description="Latest configured MCP servers"
        actions={
          <Link to="/mcp-servers">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        }
      >
        {serversLoading ? (
          <p className="text-center">Loading servers...</p>
        ) : servers.length === 0 ? (
          <div className="empty-state">
            <Server size={48} className="empty-icon" />
            <p className="empty-title">No MCP servers yet</p>
            <p className="empty-description">
              Add your first MCP server from the catalog to get started
            </p>
            <Link to="/mcp-catalog">
              <Button icon={<Plus size={16} />}>Browse Catalog</Button>
            </Link>
          </div>
        ) : (
          <div className="servers-list-compact">
            {servers.slice(0, 5).map((server) => (
              <Link
                key={server.name}
                to={`/mcp-servers/${server.name}`}
                className="server-item-compact"
              >
                <div className="server-item-main">
                  <div className="server-item-icon">
                    <Server size={16} />
                  </div>
                  <div className="server-item-info">
                    <h4 className="server-item-name">{server.name}</h4>
                    {server.description && (
                      <p className="server-item-description">
                        {server.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="server-item-meta">
                  <span
                    className={`badge badge-${server.enabled ? 'success' : 'secondary'}`}
                  >
                    {server.enabled ? 'Active' : 'Inactive'}
                  </span>
                  <span className="badge badge-outline">
                    {server.type || 'http'}
                  </span>
                  {server.policy_count !== undefined && server.policy_count > 0 && (
                    <span className="text-xs text-secondary">
                      {server.policy_count} {server.policy_count === 1 ? 'policy' : 'policies'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Policies */}
      <Card
        title="Recent Policies"
        description="Latest policy configurations"
        actions={
          <Link to="/policies">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        }
      >
        {policiesLoading ? (
          <p className="text-center">Loading policies...</p>
        ) : policies.length === 0 ? (
          <div className="empty-state">
            <Shield size={48} className="empty-icon" />
            <p className="empty-title">No policies yet</p>
            <p className="empty-description">
              Create your first policy to get started
            </p>
            <Link to="/policies/new">
              <Button icon={<Plus size={16} />}>Create Policy</Button>
            </Link>
          </div>
        ) : (
          <div className="policy-list-compact">
            {policies.slice(0, 5).map((policy) => (
              <Link
                key={policy.policy_id}
                to={`/policies/${policy.policy_id}`}
                className="policy-item-compact"
              >
                <div className="policy-item-main">
                  <div className="policy-item-icon">
                    <Shield size={16} />
                  </div>
                  <div className="policy-item-info">
                    <h4 className="policy-item-name">{policy.name}</h4>
                    {policy.description && (
                      <p className="policy-item-description">
                        {policy.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="policy-item-meta">
                  <span
                    className={`badge badge-${policy.status === 'active' ? 'success' : 'secondary'}`}
                  >
                    {policy.status === 'active' ? 'Active' : policy.status}
                  </span>
                  {policy.policy_rules && policy.policy_rules.length > 0 && (
                    <span className="badge badge-outline">
                      {policy.policy_rules[0].actions?.[0]?.type || 'unknown'}
                    </span>
                  )}
                  <span className="text-xs text-secondary">
                    {policy.policy_rules?.length || 0} {policy.policy_rules?.length === 1 ? 'rule' : 'rules'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Links */}
      <Card title="Quick Actions">
        <div className="quick-actions">
          <Link to="/mcp-catalog" className="quick-action">
            <ExternalLink size={20} />
            <span>Browse MCP Catalog</span>
          </Link>
          <Link to="/policies/new" className="quick-action">
            <Plus size={20} />
            <span>Create New Policy</span>
          </Link>
          <Link to="/mcp-servers" className="quick-action">
            <Activity size={20} />
            <span>Manage MCP Servers</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
