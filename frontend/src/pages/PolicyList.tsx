import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Shield,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';
import { unifiedPolicyApi } from '../services/api';
import type { UnifiedPolicy } from '../types/policy';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import './PolicyList.css';

export default function PolicyList() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['unified-policies'],
    queryFn: () => unifiedPolicyApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: unifiedPolicyApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-policies'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: unifiedPolicyApi.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-policies'] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: unifiedPolicyApi.suspend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-policies'] });
    },
  });

  const policies = data?.policies || [];

  // Filter policies
  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch =
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.policy_code?.toLowerCase().includes(searchQuery.toLowerCase());

    const isActive = policy.status === 'active';
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && isActive) ||
      (filterStatus === 'inactive' && !isActive);

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (policy: UnifiedPolicy) => {
    if (window.confirm(`Are you sure you want to delete "${policy.name}"?`)) {
      try {
        await deleteMutation.mutateAsync(policy.policy_id);
      } catch (error) {
        alert(`Failed to delete policy: ${error}`);
      }
    }
  };

  const handleToggle = async (policy: UnifiedPolicy) => {
    try {
      if (policy.status === 'active') {
        await suspendMutation.mutateAsync(policy.policy_id);
      } else {
        await activateMutation.mutateAsync(policy.policy_id);
      }
    } catch (error) {
      alert(`Failed to toggle policy: ${error}`);
    }
  };

  const handleReload = async () => {
    try {
      await refetch();
    } catch (error) {
      alert(`Failed to reload policies: ${error}`);
    }
  };

  const getRulesCount = (policy: UnifiedPolicy): number => {
    if (!policy.policy_rules || !Array.isArray(policy.policy_rules)) return 0;
    return policy.policy_rules.length;
  };

  const getActionType = (policy: UnifiedPolicy): string => {
    if (!policy.policy_rules || !Array.isArray(policy.policy_rules) || policy.policy_rules.length === 0) {
      return 'none';
    }
    // Get the action type from the first rule's first action
    const firstRule = policy.policy_rules[0];
    if (firstRule.actions && firstRule.actions.length > 0) {
      return firstRule.actions[0].type || 'unknown';
    }
    return 'none';
  };

  return (
    <div className="policy-list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Policies</h1>
          <p className="page-description">
            Manage access control and security policies
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
            onClick={handleReload}
            loading={isLoading}
          >
            Reload
          </Button>
          <Link to="/policies/new">
            <Button icon={<Plus size={16} />}>Create Policy</Button>
          </Link>
        </div>
      </div>

      <Card>
        <div className="filters">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({policies.length})
            </button>
            <button
              className={`filter-tab ${filterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setFilterStatus('active')}
            >
              Enabled ({policies.filter((p) => p.status === 'active').length})
            </button>
            <button
              className={`filter-tab ${filterStatus === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilterStatus('inactive')}
            >
              Disabled ({policies.filter((p) => p.status !== 'active').length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <p>Loading policies...</p>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="empty-state">
            {searchQuery || filterStatus !== 'all' ? (
              <>
                <Shield size={48} className="empty-icon" />
                <p className="empty-title">No policies found</p>
                <p className="empty-description">
                  Try adjusting your search or filters
                </p>
              </>
            ) : (
              <>
                <Shield size={48} className="empty-icon" />
                <p className="empty-title">No policies yet</p>
                <p className="empty-description">
                  Create your first policy to get started
                </p>
                <Link to="/policies/new">
                  <Button icon={<Plus size={16} />}>Create Policy</Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="policies-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Rules</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((policy) => (
                  <tr key={policy.policy_id}>
                    <td>
                      <div className="policy-name-cell">
                        <Shield size={16} className="policy-icon" />
                        <span className="policy-name">{policy.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="policy-description">
                        {policy.description || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-outline">
                        {getRulesCount(policy)} rule
                        {getRulesCount(policy) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          getActionType(policy) === 'deny' || getActionType(policy) === 'block'
                            ? 'warning'
                            : 'secondary'
                        }`}
                      >
                        {getActionType(policy)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${policy.status === 'active' ? 'success' : 'secondary'}`}
                      >
                        {policy.status === 'active' ? 'Enabled' : policy.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-secondary">{policy.priority || 0}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/policies/${policy.policy_id}`}>
                          <button className="action-btn action-btn-primary" title="View">
                            <Eye size={16} />
                          </button>
                        </Link>
                        <Link to={`/policies/${policy.policy_id}/edit`}>
                          <button className="action-btn action-btn-secondary" title="Edit">
                            <Edit size={16} />
                          </button>
                        </Link>
                        <button
                          className="action-btn action-btn-secondary"
                          onClick={() => handleToggle(policy)}
                          disabled={activateMutation.isPending || suspendMutation.isPending}
                          title={policy.status === 'active' ? 'Disable' : 'Enable'}
                        >
                          {policy.status === 'active' ? (
                            <ToggleRight size={16} />
                          ) : (
                            <ToggleLeft size={16} />
                          )}
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => handleDelete(policy)}
                          disabled={deleteMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
