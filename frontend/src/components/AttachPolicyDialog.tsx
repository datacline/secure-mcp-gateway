import { useState, useEffect } from 'react';
import { unifiedPolicyApi } from '../services/api';
import type { UnifiedPolicy } from '../types/policy';
import './AttachPolicyDialog.css';

interface AttachPolicyDialogProps {
  serverName: string;
  existingPolicyIds: string[]; // Already attached policies
  onClose: () => void;
  onAttach: (policyId: string) => Promise<void>;
}

export default function AttachPolicyDialog({ 
  serverName, 
  existingPolicyIds,
  onClose, 
  onAttach 
}: AttachPolicyDialogProps) {
  const [policies, setPolicies] = useState<UnifiedPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await unifiedPolicyApi.list('active');
      // Filter out already attached policies
      const availablePolicies = (response.policies || []).filter(
        (p) => !existingPolicyIds.includes(p.policy_id)
      );
      setPolicies(availablePolicies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const filteredPolicies = policies.filter((policy) =>
    policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.policy_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAttach = async () => {
    if (!selectedPolicyId) return;
    
    try {
      setAttaching(true);
      setError(null);
      await onAttach(selectedPolicyId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach policy');
    } finally {
      setAttaching(false);
    }
  };

  const getActionBadgeClass = (rules: any) => {
    if (!rules?.actions) return 'action-badge allow';
    const actions = rules.actions;
    if (Array.isArray(actions)) {
      const hasBlock = actions.some((a: any) => a.type === 'block' || a.type === 'deny');
      return hasBlock ? 'action-badge deny' : 'action-badge allow';
    }
    return 'action-badge allow';
  };

  const getActionLabel = (rules: any) => {
    if (!rules?.actions) return 'Allow';
    const actions = rules.actions;
    if (Array.isArray(actions) && actions.length > 0) {
      const firstAction = actions[0];
      if (firstAction.type === 'block' || firstAction.type === 'deny') return 'Deny';
      if (firstAction.type === 'allow') return 'Allow';
      if (firstAction.type === 'audit') return 'Audit';
      return firstAction.type || 'Allow';
    }
    return 'Allow';
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-container attach-policy-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Attach Policy to {serverName}</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="search-section">
            <input
              type="text"
              placeholder="Search policies by name, code, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="policies-section">
            <div className="section-header">
              <span>Available Policies</span>
              <span className="policy-count">{filteredPolicies.length} policies</span>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading policies...</p>
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="empty-state">
                {policies.length === 0 ? (
                  <>
                    <p>No policies available to attach.</p>
                    <p className="hint">Create policies in the Policies section first.</p>
                  </>
                ) : (
                  <p>No policies match your search.</p>
                )}
              </div>
            ) : (
              <div className="policies-list">
                {filteredPolicies.map((policy) => (
                  <label 
                    key={policy.policy_id} 
                    className={`policy-item ${selectedPolicyId === policy.policy_id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="policy"
                      checked={selectedPolicyId === policy.policy_id}
                      onChange={() => setSelectedPolicyId(policy.policy_id)}
                    />
                    <div className="policy-content">
                      <div className="policy-header">
                        <span className="policy-name">{policy.name}</span>
                        <span className={getActionBadgeClass(policy.policy_rules)}>
                          {getActionLabel(policy.policy_rules)}
                        </span>
                      </div>
                      {policy.policy_code && (
                        <div className="policy-code">{policy.policy_code}</div>
                      )}
                      {policy.description && (
                        <div className="policy-description">{policy.description}</div>
                      )}
                      <div className="policy-meta">
                        <span className="meta-item">Priority: {policy.priority || 0}</span>
                        <span className="meta-item">Status: {policy.status}</span>
                        {policy.resources && policy.resources.length > 0 && (
                          <span className="meta-item">
                            {policy.resources.length} resource(s) attached
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="info-section">
            <p className="info-text">
              <strong>Note:</strong> Attaching a policy to this MCP server will add it as a resource binding. 
              The policy rules will apply to all operations on this server.
            </p>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleAttach}
            disabled={!selectedPolicyId || attaching}
          >
            {attaching ? 'Attaching...' : 'Attach Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
