import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Users, Shield, Building, User } from 'lucide-react';
import type { UnifiedPolicyCreateRequest, PolicyRuleDSL, RuleCondition, RuleAction, PrincipalType, PolicyPrincipalScope } from '../types/policy';
import { conditionFields, getFieldByName, getGroupedFields } from '../data/policyConditionFields';
import { 
  getCachedUsers, 
  getCachedGroups, 
  getCachedRoles,
  ensureCacheLoaded,
} from '../data/users';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import './PolicyForm.css';

// Principal type options
const principalTypes: { value: PrincipalType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'user', label: 'User', icon: <Users size={16} />, description: 'Apply to specific users' },
  { value: 'role', label: 'Role', icon: <Shield size={16} />, description: 'Apply to users with specific roles' },
  { value: 'organization', label: 'Organization', icon: <Building size={16} />, description: 'Apply to entire organizations' },
];

interface UnifiedPolicyFormProps {
  initialData?: Partial<UnifiedPolicyCreateRequest>;
  onSubmit: (data: UnifiedPolicyCreateRequest) => Promise<void>;
  submitLabel: string;
  isLoading?: boolean;
}

const conditionOperators = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'matches', label: 'matches (regex)' },
  { value: 'in', label: 'in (list)' },
  { value: 'not_in', label: 'not in (list)' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater than or equals' },
  { value: 'lte', label: 'less than or equals' },
];

const actionTypes = ['allow', 'deny', 'block', 'audit', 'redact', 'rate_limit', 'require_approval'];
const statusOptions = ['draft', 'active'];

// Helper to generate unique rule IDs
const generateRuleId = () => `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Convert a simple condition to the composite format expected by backend
const buildConditions = (simpleConditions: Array<{ field: string; operator: string; value: string }>): RuleCondition | undefined => {
  const validConditions = simpleConditions.filter(c => c.field && c.value);
  if (validConditions.length === 0) return undefined;
  
  if (validConditions.length === 1) {
    const c = validConditions[0];
    return { field: c.field, operator: c.operator as any, value: c.value };
  }
  
  // Multiple conditions use "all" (AND)
  return {
    all: validConditions.map(c => ({ 
      field: c.field, 
      operator: c.operator as any, 
      value: c.value 
    })),
  };
};

// Extract simple conditions from composite format
const extractSimpleConditions = (condition?: RuleCondition): Array<{ field: string; operator: string; value: string }> => {
  if (!condition) return [{ field: '', operator: 'equals', value: '' }];
  
  if (condition.all) {
    return condition.all.map(c => ({
      field: c.field || '',
      operator: (c.operator as string) || 'equals',
      value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value || ''),
    }));
  }
  
  if (condition.any) {
    return condition.any.map(c => ({
      field: c.field || '',
      operator: (c.operator as string) || 'equals',
      value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value || ''),
    }));
  }
  
  // Single condition
  return [{
    field: condition.field || '',
    operator: (condition.operator as string) || 'equals',
    value: typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value || ''),
  }];
};

interface RuleEditorState {
  ruleId: string;
  priority: number;
  description: string;
  conditions: Array<{ field: string; operator: string; value: string }>;
  actions: RuleAction[];
  expanded: boolean;
}

export default function UnifiedPolicyForm({
  initialData,
  onSubmit,
  submitLabel,
  isLoading,
}: UnifiedPolicyFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [policyCode, setPolicyCode] = useState(initialData?.policy_code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'draft');
  const [priority, setPriority] = useState(initialData?.priority || 0);
  
  // Initialize rules from initialData or create a default one
  const initializeRules = (): RuleEditorState[] => {
    if (initialData?.policy_rules && initialData.policy_rules.length > 0) {
      return initialData.policy_rules.map((rule) => ({
        ruleId: rule.rule_id,
        priority: rule.priority || 0,
        description: rule.description || '',
        conditions: extractSimpleConditions(rule.conditions),
        actions: rule.actions || [{ type: 'allow' }],
        expanded: true,
      }));
    }
    return [{
      ruleId: generateRuleId(),
      priority: 0,
      description: '',
      conditions: [{ field: '', operator: 'equals', value: '' }],
      actions: [{ type: 'allow' }],
      expanded: true,
    }];
  };

  const [rules, setRules] = useState<RuleEditorState[]>(initializeRules);

  // Initialize scopes from initialData
  const [scopes, setScopes] = useState<Array<{ principal_type: PrincipalType; principal_id: string }>>(
    initialData?.scopes?.map(s => ({ 
      principal_type: s.principal_type, 
      principal_id: s.principal_id 
    })) || []
  );
  const [isGlobalPolicy, setIsGlobalPolicy] = useState(
    !initialData?.scopes || initialData.scopes.length === 0
  );

  // State to track if principals data is loaded
  const [principalsLoaded, setPrincipalsLoaded] = useState(false);

  // Load users/groups/roles cache when component mounts
  useEffect(() => {
    ensureCacheLoaded().then(() => {
      setPrincipalsLoaded(true);
    });
  }, []);

  const groupedFields = getGroupedFields();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert rules to PolicyRuleDSL format
    const policyRules: PolicyRuleDSL[] = rules.map((rule) => ({
      rule_id: rule.ruleId,
      priority: rule.priority,
      description: rule.description || undefined,
      conditions: buildConditions(rule.conditions),
      actions: rule.actions,
    }));
    
    // Build scopes (empty array = global policy)
    const validScopes = isGlobalPolicy 
      ? [] 
      : scopes.filter(s => s.principal_id.trim() !== '');

    const data: UnifiedPolicyCreateRequest = {
      name,
      policy_code: policyCode || undefined,
      description: description || undefined,
      status: status as 'draft' | 'active',
      priority,
      policy_rules: policyRules,
      scopes: validScopes.length > 0 ? validScopes : undefined,
    };

    await onSubmit(data);
  };

  // Rule management
  const addRule = () => {
    setRules([...rules, {
      ruleId: generateRuleId(),
      priority: 0,
      description: '',
      conditions: [{ field: '', operator: 'equals', value: '' }],
      actions: [{ type: 'allow' }],
      expanded: true,
    }]);
  };

  const removeRule = (index: number) => {
    if (rules.length > 1) {
      setRules(rules.filter((_, i) => i !== index));
    }
  };

  const updateRule = (index: number, updates: Partial<RuleEditorState>) => {
    setRules(rules.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const toggleRuleExpanded = (index: number) => {
    updateRule(index, { expanded: !rules[index].expanded });
  };

  // Condition management within a rule
  const addCondition = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      conditions: [...rule.conditions, { field: '', operator: 'equals', value: '' }],
    });
  };

  const removeCondition = (ruleIndex: number, condIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      conditions: rule.conditions.filter((_, i) => i !== condIndex),
    });
  };

  const updateCondition = (ruleIndex: number, condIndex: number, updates: Partial<{ field: string; operator: string; value: string }>) => {
    const rule = rules[ruleIndex];
    const newConditions = rule.conditions.map((c, i) => {
      if (i !== condIndex) return c;
      // If field changed, reset value
      if (updates.field && updates.field !== c.field) {
        return { ...c, ...updates, value: '' };
      }
      return { ...c, ...updates };
    });
    updateRule(ruleIndex, { conditions: newConditions });
  };

  // Action management within a rule
  const addAction = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      actions: [...rule.actions, { type: 'allow' }],
    });
  };

  const removeAction = (ruleIndex: number, actionIndex: number) => {
    const rule = rules[ruleIndex];
    if (rule.actions.length > 1) {
      updateRule(ruleIndex, {
        actions: rule.actions.filter((_, i) => i !== actionIndex),
      });
    }
  };

  const updateAction = (ruleIndex: number, actionIndex: number, updates: Partial<RuleAction>) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      actions: rule.actions.map((a, i) => i === actionIndex ? { ...a, ...updates } : a),
    });
  };

  // Scope management
  const addScope = () => {
    setScopes([...scopes, { principal_type: 'user', principal_id: '' }]);
  };

  const removeScope = (index: number) => {
    setScopes(scopes.filter((_, i) => i !== index));
  };

  const updateScope = (index: number, updates: Partial<{ principal_type: PrincipalType; principal_id: string }>) => {
    setScopes(scopes.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const handleGlobalPolicyChange = (isGlobal: boolean) => {
    setIsGlobalPolicy(isGlobal);
    if (isGlobal) {
      setScopes([]); // Clear scopes when switching to global
    } else if (scopes.length === 0) {
      setScopes([{ principal_type: 'user', principal_id: '' }]); // Add default scope
    }
  };

  const renderValueInput = (condition: { field: string; operator: string; value: string }, ruleIndex: number, condIndex: number) => {
    const fieldConfig = getFieldByName(condition.field);
    
    if (!fieldConfig || !fieldConfig.possibleValues) {
      return (
        <input
          value={condition.value}
          onChange={(e) => updateCondition(ruleIndex, condIndex, { value: e.target.value })}
          className="input input-sm"
          placeholder={fieldConfig?.valueType === 'number' ? 'Enter number' : 'Enter value'}
          type={fieldConfig?.valueType === 'number' ? 'number' : 'text'}
        />
      );
    }

    return (
      <select
        value={condition.value}
        onChange={(e) => updateCondition(ruleIndex, condIndex, { value: e.target.value })}
        className="input input-sm"
      >
        <option value="">Select value...</option>
        {fieldConfig.possibleValues.map((pv) => (
          <option key={pv.value} value={pv.value}>
            {pv.label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="policy-form">
      {/* Basic Information */}
      <Card title="Basic Information" description="General policy configuration">
        <div className="form-grid">
          <Input
            label="Policy Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Notion Access Policy"
            required
          />

          <Input
            label="Policy Code (optional)"
            value={policyCode}
            onChange={(e) => setPolicyCode(e.target.value)}
            placeholder="e.g., notion-access-001"
          />

          <div className="input-group form-col-span-2">
            <label className="input-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Describe the purpose of this policy..."
              rows={3}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Status</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </Card>

      {/* Policy Rules */}
      <Card
        title="Policy Rules"
        description="Define conditions and actions for this policy"
        actions={
          <Button
            type="button"
            size="sm"
            icon={<Plus size={16} />}
            onClick={addRule}
          >
            Add Rule
          </Button>
        }
      >
        {rules.map((rule, ruleIndex) => (
          <div key={rule.ruleId} className="rule-editor">
            {/* Rule Header */}
            <div className="rule-editor-header">
              <button
                type="button"
                className="rule-toggle-btn"
                onClick={() => toggleRuleExpanded(ruleIndex)}
              >
                {rule.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span className="rule-title">Rule {ruleIndex + 1}</span>
                {rule.description && <span className="rule-subtitle">- {rule.description}</span>}
              </button>
              {rules.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => removeRule(ruleIndex)}
                >
                  Remove
                </Button>
              )}
            </div>

            {/* Rule Content (collapsible) */}
            {rule.expanded && (
              <div className="rule-editor-content">
                <div className="rule-header">
                  <Input
                    label="Rule ID"
                    value={rule.ruleId}
                    onChange={(e) => updateRule(ruleIndex, { ruleId: e.target.value })}
                    placeholder="e.g., allow-admins"
                  />
                  <Input
                    label="Priority"
                    type="number"
                    value={rule.priority}
                    onChange={(e) => updateRule(ruleIndex, { priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                <Input
                  label="Rule Description (optional)"
                  value={rule.description}
                  onChange={(e) => updateRule(ruleIndex, { description: e.target.value })}
                  placeholder="Describe what this rule does..."
                />

                {/* Conditions */}
                <div className="rule-section">
                  <div className="rule-section-header">
                    <h4>Conditions</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={<Plus size={14} />}
                      onClick={() => addCondition(ruleIndex)}
                    >
                      Add Condition
                    </Button>
                  </div>

                  {rule.conditions.length === 0 ? (
                    <div className="empty-state-small">
                      <p>No conditions. Rule will always match.</p>
                    </div>
                  ) : (
                    rule.conditions.map((condition, condIndex) => (
                      <div key={condIndex} className="condition-row">
                        <select
                          value={condition.field}
                          onChange={(e) => updateCondition(ruleIndex, condIndex, { field: e.target.value })}
                          className="input input-sm condition-field-select"
                        >
                          <option value="">Select field...</option>
                          {Object.entries(groupedFields).map(([groupName, fields]) => (
                            <optgroup key={groupName} label={groupName}>
                              {fields.map((f) => (
                                <option key={f.field} value={f.field}>
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(ruleIndex, condIndex, { operator: e.target.value })}
                          className="input input-sm condition-operator-select"
                        >
                          {conditionOperators.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        <div className="condition-value-input">
                          {renderValueInput(condition, ruleIndex, condIndex)}
                        </div>

                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => removeCondition(ruleIndex, condIndex)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Actions */}
                <div className="rule-section">
                  <div className="rule-section-header">
                    <h4>Actions</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={<Plus size={14} />}
                      onClick={() => addAction(ruleIndex)}
                    >
                      Add Action
                    </Button>
                  </div>

                  {rule.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="action-row">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(ruleIndex, actionIndex, { type: e.target.value as any })}
                        className="input input-sm"
                      >
                        {actionTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ')}
                          </option>
                        ))}
                      </select>

                      <input
                        value={action.params ? JSON.stringify(action.params) : ''}
                        onChange={(e) => {
                          try {
                            const params = e.target.value ? JSON.parse(e.target.value) : undefined;
                            updateAction(ruleIndex, actionIndex, { params });
                          } catch {
                            // Keep current if not valid JSON
                          }
                        }}
                        className="input input-sm"
                        placeholder='{"key": "value"} (optional)'
                      />

                      {rule.actions.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => removeAction(ruleIndex, actionIndex)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Principal Scopes - Who does this policy apply to? */}
      <Card
        title="Policy Scope"
        description="Define who this policy applies to. Global policies apply to everyone."
      >
        {/* Global vs Scoped toggle */}
        <div className="scope-toggle-group">
          <label className="scope-toggle-option">
            <input
              type="radio"
              name="policyScope"
              checked={isGlobalPolicy}
              onChange={() => handleGlobalPolicyChange(true)}
            />
            <div className="scope-toggle-content">
              <strong>Global Policy</strong>
              <span>Applies to all users, roles, and organizations</span>
            </div>
          </label>
          <label className="scope-toggle-option">
            <input
              type="radio"
              name="policyScope"
              checked={!isGlobalPolicy}
              onChange={() => handleGlobalPolicyChange(false)}
            />
            <div className="scope-toggle-content">
              <strong>Scoped Policy</strong>
              <span>Applies to specific users, roles, or organizations</span>
            </div>
          </label>
        </div>

        {/* Scopes list (only shown when not global) */}
        {!isGlobalPolicy && (
          <div className="scopes-editor">
            <div className="rule-section-header">
              <h4>Principals</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Plus size={14} />}
                onClick={addScope}
              >
                Add Principal
              </Button>
            </div>

            {scopes.length === 0 ? (
              <div className="empty-state-small">
                <p>No principals defined. Add at least one to scope this policy.</p>
              </div>
            ) : (
              scopes.map((scope, index) => (
                <div key={index} className="scope-row">
                  <select
                    value={scope.principal_type}
                    onChange={(e) => updateScope(index, { principal_type: e.target.value as PrincipalType, principal_id: '' })}
                    className="input input-sm scope-type-select"
                  >
                    {principalTypes.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>

                  {/* Dropdown for selecting from users/groups/roles data */}
                  <select
                    value={scope.principal_id}
                    onChange={(e) => updateScope(index, { principal_id: e.target.value })}
                    className="input input-sm scope-id-input"
                  >
                    <option value="">
                      {scope.principal_type === 'user' ? 'Select a user...' :
                       scope.principal_type === 'role' ? 'Select a role...' :
                       'Select a group...'}
                    </option>
                    {scope.principal_type === 'user' && getCachedUsers().map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                    {scope.principal_type === 'role' && getCachedRoles().map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                    {scope.principal_type === 'organization' && getCachedGroups().map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.member_count} members)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => removeScope(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Submit */}
      <div className="form-actions">
        <Button type="submit" loading={isLoading} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
