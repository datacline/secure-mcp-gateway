import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Activity, Plus } from 'lucide-react';
import { unifiedPolicyApi, healthCheck } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import './Dashboard.css';

export default function Dashboard() {
  const { data: policiesData, isLoading } = useQuery(
    'unified-policies',
    () => unifiedPolicyApi.list()
  );

  const { data: health } = useQuery('health', healthCheck, {
    refetchInterval: 30000,
  });

  const policies = policiesData?.policies || [];
  const activeCount = policies.filter((p) => p.status === 'active').length;
  const inactiveCount = policies.filter((p) => p.status !== 'active').length;
  const denyCount = policies.filter((p) => {
    if (!p.policy_rules || !Array.isArray(p.policy_rules)) return false;
    return p.policy_rules.some((rule: any) => 
      rule.actions?.some((a: any) => a.type === 'deny' || a.type === 'block')
    );
  }).length;

  const stats = [
    {
      label: 'Total Policies',
      value: policies.length,
      icon: Shield,
      color: 'primary',
    },
    {
      label: 'Active',
      value: activeCount,
      icon: CheckCircle,
      color: 'success',
    },
    {
      label: 'Inactive',
      value: inactiveCount,
      icon: XCircle,
      color: 'secondary',
    },
    {
      label: 'Deny Policies',
      value: denyCount,
      icon: Activity,
      color: 'warning',
    },
  ];

  const getRulesCount = (policy: any): number => {
    if (!policy.policy_rules || !Array.isArray(policy.policy_rules)) return 0;
    return policy.policy_rules.length;
  };

  const getActionType = (policy: any): string => {
    if (!policy.policy_rules || !Array.isArray(policy.policy_rules) || policy.policy_rules.length === 0) {
      return 'none';
    }
    const firstRule = policy.policy_rules[0];
    if (firstRule.actions && firstRule.actions.length > 0) {
      return firstRule.actions[0].type || 'unknown';
    }
    return 'none';
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Overview of your policy management system
          </p>
        </div>
        <Link to="/policies/new">
          <Button icon={<Plus size={16} />}>Create Policy</Button>
        </Link>
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
          <Card key={stat.label} className="stat-card">
            <div className="stat-content">
              <div className={`stat-icon stat-icon-${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">
                  {isLoading ? '...' : stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
        {isLoading ? (
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
                  <span className="badge badge-outline">
                    {getActionType(policy)}
                  </span>
                  <span className="text-xs text-secondary">
                    {getRulesCount(policy)} rule{getRulesCount(policy) !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
