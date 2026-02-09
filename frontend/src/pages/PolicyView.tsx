import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Server,
  User,
  Users,
  Briefcase,
} from 'lucide-react';
import { unifiedPolicyApi } from '../services/api';
import { 
  getUserById, 
  getGroupById, 
  getRoleById,
  ensureCacheLoaded,
  type User as UserType,
  type UserGroup,
  type UserRole
} from '../data/users';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { format } from 'date-fns';
import './PolicyView.css';

export default function PolicyView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State to track if principals data is loaded
  const [principalsLoaded, setPrincipalsLoaded] = useState(false);

  // Load users/groups/roles cache for displaying principal scopes
  useEffect(() => {
    ensureCacheLoaded().then(() => {
      setPrincipalsLoaded(true);
    });
  }, []);

  const { data: policy, isLoading } = useQuery(
    ['unified-policy', id],
    () => unifiedPolicyApi.get(id!),
    { enabled: !!id }
  );

  const deleteMutation = useMutation(unifiedPolicyApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('unified-policies');
      navigate('/policies');
    },
  });

  const activateMutation = useMutation(unifiedPolicyApi.activate, {
    onSuccess: () => {
      queryClient.invalidateQueries(['unified-policy', id]);
      queryClient.invalidateQueries('unified-policies');
    },
  });

  const suspendMutation = useMutation(unifiedPolicyApi.suspend, {
    onSuccess: () => {
      queryClient.invalidateQueries(['unified-policy', id]);
      queryClient.invalidateQueries('unified-policies');
    },
  });

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${policy?.name}"?`)) {
      try {
        await deleteMutation.mutateAsync(id!);
      } catch (error) {
        alert(`Failed to delete policy: ${error}`);
      }
    }
  };

  const handleToggle = async () => {
    try {
      if (policy?.status === 'active') {
        await suspendMutation.mutateAsync(id!);
      } else {
        await activateMutation.mutateAsync(id!);
      }
    } catch (error) {
      alert(`Failed to toggle policy: ${error}`);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Loading policy...</p>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="error-container">
        <p>Policy not found</p>
        <Button onClick={() => navigate('/policies')}>Back to Policies</Button>
      </div>
    );
  }

  const isActive = policy.status === 'active';
  const policyRules = policy.policy_rules || [];

  // Helper to extract conditions from a rule
  const getConditionsArray = (conditions: any): any[] => {
    if (!conditions) return [];
    if (conditions.all) return conditions.all;
    if (conditions.any) return conditions.any;
    // Single condition
    if (conditions.field) return [conditions];
    return [];
  };

  return (
    <div className="policy-view-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/policies')}
          >
            Back
          </Button>
        </div>
        <div className="page-header-content">
          <div className="policy-title-section">
            <Shield size={32} className="policy-icon-large" />
            <div>
              <h1 className="page-title">{policy.name}</h1>
              {policy.policy_code && (
                <code className="policy-code">{policy.policy_code}</code>
              )}
              {policy.description && (
                <p className="page-description">{policy.description}</p>
              )}
            </div>
          </div>
          <div className="page-actions">
            <Button
              variant="outline"
              icon={isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              onClick={handleToggle}
              loading={activateMutation.isLoading || suspendMutation.isLoading}
            >
              {isActive ? 'Disable' : 'Enable'}
            </Button>
            <Link to={`/policies/${id}/edit`}>
              <Button variant="secondary" icon={<Edit size={16} />}>
                Edit
              </Button>
            </Link>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={handleDelete}
              loading={deleteMutation.isLoading}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Overview */}
      <Card title="Overview">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Status</span>
            <span className={`badge badge-${isActive ? 'success' : 'secondary'}`}>
              {isActive ? (
                <>
                  <CheckCircle size={14} /> Active
                </>
              ) : (
                <>
                  <XCircle size={14} /> {policy.status}
                </>
              )}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Priority</span>
            <span className="info-value">{policy.priority || 0}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Version</span>
            <span className="info-value">v{policy.version || 1}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Global</span>
            <span className="info-value">
              {!policy.scopes || policy.scopes.length === 0 ? 'Yes' : 'No'}
            </span>
          </div>

          {policy.created_at && (
            <div className="info-item">
              <span className="info-label">Created</span>
              <span className="info-value">
                {format(new Date(policy.created_at), 'PPpp')}
              </span>
            </div>
          )}

          {policy.updated_at && (
            <div className="info-item">
              <span className="info-label">Last Updated</span>
              <span className="info-value">
                {format(new Date(policy.updated_at), 'PPpp')}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Resources */}
      {policy.resources && policy.resources.length > 0 && (
        <Card title="Attached Resources" description={`${policy.resources.length} resource(s) attached`}>
          <div className="resources-list">
            {policy.resources.map((resource, idx) => (
              <div key={idx} className="resource-item">
                <Server size={16} />
                <span className="resource-type">{resource.resource_type}</span>
                <span className="resource-id">{resource.resource_id}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Policy Rules */}
      <Card title="Policy Rules" description={`${policyRules.length} rule(s) defined`}>
        {policyRules.length === 0 ? (
          <p className="empty-section">No rules defined</p>
        ) : (
          policyRules.map((rule, ruleIndex) => {
            const conditions = getConditionsArray(rule.conditions);
            const actions = rule.actions || [];
            
            return (
              <div key={rule.rule_id || ruleIndex} className="rule-card">
                <div className="rule-card-header">
                  <div>
                    <h4 className="rule-title">
                      {rule.rule_id}
                      <span className="badge badge-outline badge-sm">
                        Priority: {rule.priority || 0}
                      </span>
                    </h4>
                    {rule.description && (
                      <p className="rule-description">{rule.description}</p>
                    )}
                  </div>
                </div>

                {/* Conditions */}
                <div className="rule-section">
                  <h5 className="rule-section-title">Conditions</h5>
                  {conditions.length > 0 ? (
                    <div className="condition-list">
                      {conditions.map((condition: any, condIndex: number) => (
                        <div key={condIndex} className="condition-badge">
                          <code>
                            {condition.field} {condition.operator} {JSON.stringify(condition.value)}
                          </code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-section">No conditions (always matches)</p>
                  )}
                </div>

                {/* Actions */}
                <div className="rule-section">
                  <h5 className="rule-section-title">Actions</h5>
                  {actions.length > 0 ? (
                    <div className="action-list">
                      {actions.map((action: any, actionIndex: number) => (
                        <div key={actionIndex} className="action-badge">
                          <strong>{action.type}</strong>
                          {action.params && Object.keys(action.params).length > 0 && (
                            <code className="action-params">
                              {JSON.stringify(action.params)}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-section">No actions defined</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Principal Scopes */}
      {policy.scopes && policy.scopes.length > 0 && (
        <Card title="Principal Scopes" description="Who this policy applies to">
          <div className="scopes-list">
            {policy.scopes.map((scope, idx) => {
              // Look up the principal details from our users data
              let principalDetails: { name: string; subtitle?: string } | null = null;
              let icon = <Shield size={16} />;
              
              if (scope.principal_type === 'user') {
                const user = getUserById(scope.principal_id);
                if (user) {
                  principalDetails = { name: user.name, subtitle: user.email };
                }
                icon = <User size={16} />;
              } else if (scope.principal_type === 'role') {
                const role = getRoleById(scope.principal_id);
                if (role) {
                  principalDetails = { name: role.name, subtitle: role.description };
                }
                icon = <Briefcase size={16} />;
              } else if (scope.principal_type === 'organization') {
                const group = getGroupById(scope.principal_id);
                if (group) {
                  principalDetails = { name: group.name, subtitle: `${group.memberCount} members` };
                }
                icon = <Users size={16} />;
              }

              return (
                <div key={idx} className="scope-item">
                  <div className="scope-icon">{icon}</div>
                  <div className="scope-details">
                    <span className="scope-type-badge">{scope.principal_type}</span>
                    {principalDetails ? (
                      <>
                        <span className="scope-name">{principalDetails.name}</span>
                        {principalDetails.subtitle && (
                          <span className="scope-subtitle">{principalDetails.subtitle}</span>
                        )}
                      </>
                    ) : (
                      <span className="scope-id">{scope.principal_id}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
