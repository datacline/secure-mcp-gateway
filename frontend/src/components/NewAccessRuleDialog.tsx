import { useState, useEffect } from 'react';
import { X, User, Users, Shield, Search, Check, Minus, Info, Trash2 } from 'lucide-react';
import { mcpServerApi, unifiedPolicyApi, type MCPTool } from '../services/api';
import type { 
  UnifiedPolicyCreateRequest, 
  PrincipalType, 
  PolicyRuleDSL, 
  RuleCondition, 
  RuleAction,
  RuleActionType,
  PolicyStatus,
  ResourceType
} from '../types/policy';
import { conditionFields, getFieldByName, getGroupedFields } from '../data/policyConditionFields';
import { 
  getCachedUsers,
  getCachedGroups,
  getCachedRoles,
  searchUsers,
  searchGroups,
  searchRoles,
  ensureCacheLoaded,
  type User as UserData,
  type UserGroup,
  type UserRole
} from '../data/users';
import Button from './ui/Button';
import './NewAccessRuleDialog.css';

interface NewAccessRuleDialogProps {
  serverName: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

type SubjectType = 'user' | 'group' | 'role';
type AccessScopeType = 'entire_server' | 'specific_tools';

// Condition uses the same structure as UnifiedPolicyForm
interface ConditionConfig {
  field: string;
  operator: string;
  value: string;
}

// Operators matching the unified policy structure
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



// Generate unique IDs
const generatePolicyCode = (serverName: string) => 
  `${serverName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-policy-${Date.now().toString(36)}`;

const generateRuleId = () => 
  `rule-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;

export default function NewAccessRuleDialog({ serverName, onClose, onCreated }: NewAccessRuleDialogProps) {
  // Drawer resize
  const [drawerWidth, setDrawerWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  // Policy metadata
  const [policyName, setPolicyName] = useState(`${serverName} Access Policy`);
  const [policyDescription, setPolicyDescription] = useState('');
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus>('active');
  const [policyPriority, setPolicyPriority] = useState(0);

  // Subject (Applies To) - maps to scopes
  const [subjectType, setSubjectType] = useState<SubjectType>('user');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [isGlobalPolicy, setIsGlobalPolicy] = useState(false);

  // Access Scope - maps to resources and conditions
  const [accessScope, setAccessScope] = useState<AccessScopeType>('entire_server');
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [loadingTools, setLoadingTools] = useState(false);

  // Action
  const [action, setAction] = useState<RuleActionType>('allow');

  // Conditions (Advanced)
  const [showConditions, setShowConditions] = useState(false);
  const [conditions, setConditions] = useState<ConditionConfig[]>([]);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to track if principals data is loaded
  const [principalsLoaded, setPrincipalsLoaded] = useState(false);

  // Load users/groups/roles cache when component mounts
  useEffect(() => {
    ensureCacheLoaded().then(() => {
      setPrincipalsLoaded(true);
    });
  }, []);

  // Load tools when accessing specific tools scope
  useEffect(() => {
    if (accessScope === 'specific_tools' && tools.length === 0) {
      loadTools();
    }
  }, [accessScope]);

  // Handle drawer resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 360;
      const maxWidth = window.innerWidth * 0.8;
      setDrawerWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const loadTools = async () => {
    try {
      setLoadingTools(true);
      const response = await mcpServerApi.getTools(serverName);
      setTools(response.tools || []);
    } catch (err) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoadingTools(false);
    }
  };

  // Get filtered list based on subject type
  const getFilteredSubjects = () => {
    if (!subjectSearch) {
      switch (subjectType) {
        case 'user':
          return getCachedUsers();
        case 'group':
          return getCachedGroups();
        case 'role':
          return getCachedRoles();
        default:
          return [];
      }
    }
    
    switch (subjectType) {
      case 'user':
        return searchUsers(subjectSearch);
      case 'group':
        return searchGroups(subjectSearch);
      case 'role':
        return searchRoles(subjectSearch);
      default:
        return [];
    }
  };

  // Get filtered tools
  const getFilteredTools = () => {
    const search = toolSearch.toLowerCase();
    return tools.filter(t => 
      t.name.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search)
    );
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleTool = (name: string) => {
    setSelectedTools(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const selectAllTools = () => {
    const filtered = getFilteredTools();
    const allSelected = filtered.every(t => selectedTools.includes(t.name));
    if (allSelected) {
      setSelectedTools(prev => prev.filter(t => !filtered.find(f => f.name === t)));
    } else {
      const newSelection = [...new Set([...selectedTools, ...filtered.map(t => t.name)])];
      setSelectedTools(newSelection);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<ConditionConfig>) => {
    setConditions(conditions.map((c, i) => {
      if (i !== index) return c;
      // If field changed, reset the value
      if (updates.field && updates.field !== c.field) {
        return { ...c, ...updates, value: '' };
      }
      return { ...c, ...updates };
    }));
  };

  // Get grouped fields for condition dropdown
  const groupedFields = getGroupedFields();

  // Render value input based on field type (same as UnifiedPolicyForm)
  const renderConditionValueInput = (condition: ConditionConfig, index: number) => {
    const fieldConfig = getFieldByName(condition.field);
    
    if (!fieldConfig || !fieldConfig.possibleValues) {
      return (
        <input
          type={fieldConfig?.valueType === 'number' ? 'number' : 'text'}
          value={condition.value}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="condition-value-input"
          placeholder={fieldConfig?.valueType === 'number' ? 'Enter number' : 'Enter value'}
        />
      );
    }

    return (
      <select
        value={condition.value}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
        className="condition-value-input"
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

  const handleSubmit = async () => {
    // Validation
    if (!policyName.trim()) {
      setError('Please enter a policy name');
      return;
    }

    if (!isGlobalPolicy && selectedSubjects.length === 0) {
      setError('Please select at least one user, group, or role, or mark as global policy');
      return;
    }

    if (accessScope === 'specific_tools' && selectedTools.length === 0) {
      setError('Please select at least one tool');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build conditions for the rule
      const conditionList: RuleCondition[] = [];

      // Add tool restriction if specific tools selected
      if (accessScope === 'specific_tools' && selectedTools.length > 0) {
        conditionList.push({
          field: 'tool.name',
          operator: 'in',
          value: selectedTools,
        });
      }

      // Add custom conditions (directly using the field from the dropdown)
      conditions.forEach(cond => {
        if (cond.field && cond.value) {
          conditionList.push({
            field: cond.field,
            operator: cond.operator as any,
            value: cond.value,
          });
        }
      });

      // Build rule conditions (using "all" for AND composition if multiple)
      let ruleConditions: RuleCondition | undefined;
      if (conditionList.length === 1) {
        ruleConditions = conditionList[0];
      } else if (conditionList.length > 1) {
        ruleConditions = { all: conditionList };
      }

      // Build the policy rule
      const policyRule: PolicyRuleDSL = {
        rule_id: generateRuleId(),
        priority: 0,
        description: `${action === 'allow' ? 'Allow' : 'Deny'} access ${accessScope === 'entire_server' ? 'to entire server' : `to ${selectedTools.length} selected tool(s)`}`,
        conditions: ruleConditions,
        actions: [{ type: action }],
      };

      // Build scopes (principal bindings) - empty for global policy
      const scopes = isGlobalPolicy ? [] : selectedSubjects.map(subjectId => {
        // Map subjectType to PrincipalType
        const principalType: PrincipalType = subjectType === 'group' ? 'role' : subjectType;
        return {
          principal_type: principalType,
          principal_id: subjectId,
        };
      });

      // Build resources (always include the MCP server)
      const resources: Array<{ resource_type: ResourceType; resource_id: string }> = [
        { resource_type: 'mcp_server', resource_id: serverName }
      ];

      // Optionally add individual tools as resources if specific tools selected
      if (accessScope === 'specific_tools') {
        selectedTools.forEach(toolName => {
          resources.push({
            resource_type: 'tool',
            resource_id: `${serverName}:${toolName}`,
          });
        });
      }

      // Create the unified policy
      const policyData: UnifiedPolicyCreateRequest = {
        policy_code: generatePolicyCode(serverName),
        name: policyName,
        description: policyDescription || `Access policy for ${serverName} MCP server`,
        status: policyStatus,
        priority: policyPriority,
        policy_rules: [policyRule],
        scopes: scopes.length > 0 ? scopes : undefined,
        resources,
      };

      await unifiedPolicyApi.create(policyData);
      // Wait for parent to reload policies before closing
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create access policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubjects = getFilteredSubjects();
  const filteredTools = getFilteredTools();
  const allToolsSelected = filteredTools.length > 0 && filteredTools.every(t => selectedTools.includes(t.name));
  const someToolsSelected = filteredTools.some(t => selectedTools.includes(t.name)) && !allToolsSelected;

  // Map subjectType to display PrincipalType
  const getPrincipalTypeLabel = () => {
    switch (subjectType) {
      case 'user': return 'User';
      case 'group': return 'Role/Group';
      case 'role': return 'Role';
      default: return 'Principal';
    }
  };

  return (
    <div className={`dialog-overlay ${isResizing ? 'resizing' : ''}`} onClick={onClose}>
      <div 
        className="access-rule-dialog" 
        style={{ width: drawerWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Resize handle */}
        <div 
          className="drawer-resize-handle"
          onMouseDown={startResizing}
        />
        
        <div className="dialog-header">
          <h2>New Access Policy</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          {/* Policy Metadata Section */}
          <div className="form-section">
            <label className="section-label">Policy Details</label>
            <div className="policy-metadata">
              <div className="form-field">
                <label className="field-label">Policy Name *</label>
                <input
                  type="text"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="form-input"
                  placeholder="Enter policy name"
                />
              </div>
              <div className="form-field">
                <label className="field-label">Description</label>
                <textarea
                  value={policyDescription}
                  onChange={(e) => setPolicyDescription(e.target.value)}
                  className="form-input form-textarea"
                  placeholder="Describe what this policy does..."
                  rows={2}
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label className="field-label">Status</label>
                  <select
                    value={policyStatus}
                    onChange={(e) => setPolicyStatus(e.target.value as PolicyStatus)}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label">Priority</label>
                  <input
                    type="number"
                    value={policyPriority}
                    onChange={(e) => setPolicyPriority(parseInt(e.target.value) || 0)}
                    className="form-input"
                    min="0"
                  />
                  <span className="field-hint">Higher = evaluated first</span>
                </div>
              </div>
            </div>
          </div>

          {/* Applies To Section (Scopes) */}
          <div className="form-section">
            <label className="section-label">
              Applies To
              <span className="section-hint">(Principal Scopes)</span>
            </label>

            {/* Global policy toggle */}
            <label className="global-policy-toggle">
              <input
                type="checkbox"
                checked={isGlobalPolicy}
                onChange={(e) => setIsGlobalPolicy(e.target.checked)}
              />
              <span>Global Policy (applies to everyone)</span>
            </label>

            {!isGlobalPolicy && (
              <>
                <div className="subject-tabs">
                  <button
                    className={`subject-tab ${subjectType === 'user' ? 'active' : ''}`}
                    onClick={() => { setSubjectType('user'); setSelectedSubjects([]); }}
                  >
                    <User size={16} />
                    User
                  </button>
                  <button
                    className={`subject-tab ${subjectType === 'group' ? 'active' : ''}`}
                    onClick={() => { setSubjectType('group'); setSelectedSubjects([]); }}
                  >
                    <Users size={16} />
                    Group
                  </button>
                  <button
                    className={`subject-tab ${subjectType === 'role' ? 'active' : ''}`}
                    onClick={() => { setSubjectType('role'); setSelectedSubjects([]); }}
                  >
                    <Shield size={16} />
                    Role
                  </button>
                </div>

                <div className="subject-selector">
                  <label className="selector-label">
                    Select {getPrincipalTypeLabel()}
                  </label>
                  <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder={`Search ${subjectType}s...`}
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      className="search-input"
                    />
                    {subjectSearch && (
                      <button className="clear-search" onClick={() => setSubjectSearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="subject-list">
                    {filteredSubjects.map((subject: any) => (
                      <label key={subject.id} className="subject-item">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(subject.id)}
                          onChange={() => toggleSubject(subject.id)}
                        />
                        <div className="subject-info">
                          <span className="subject-name">{subject.name}</span>
                          {subjectType === 'user' && <span className="subject-detail">{subject.email}</span>}
                          {subjectType === 'group' && <span className="subject-detail">{subject.memberCount} members</span>}
                          {subjectType === 'role' && <span className="subject-detail">{subject.description}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedSubjects.length > 0 && (
                    <div className="selection-summary">
                      {selectedSubjects.length} {getPrincipalTypeLabel().toLowerCase()}(s) selected
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Access Scope Section (Resources) */}
          <div className="form-section">
            <label className="section-label">
              Access Scope
              <span className="section-hint">(Resource Bindings)</span>
            </label>
            <div className="scope-options">
              <label className="scope-option">
                <input
                  type="radio"
                  name="accessScope"
                  checked={accessScope === 'entire_server'}
                  onChange={() => setAccessScope('entire_server')}
                />
                <div className="scope-option-content">
                  <span className="scope-option-label">Entire Server</span>
                  <span className="scope-option-hint">Full access to all tools in {serverName}</span>
                </div>
              </label>
              <label className="scope-option">
                <input
                  type="radio"
                  name="accessScope"
                  checked={accessScope === 'specific_tools'}
                  onChange={() => setAccessScope('specific_tools')}
                />
                <div className="scope-option-content">
                  <span className="scope-option-label">Specific Tools & Resources</span>
                  <span className="scope-option-hint">Fine-grained selection of individual tools</span>
                </div>
              </label>
            </div>

            {/* Tool Selection */}
            {accessScope === 'specific_tools' && (
              <div className="tools-selector">
                <div className="tools-header">
                  <span className="tools-label">Select Tools</span>
                  <div className="tools-tabs">
                    <button className="tools-tab active">Tools</button>
                    <button className="tools-tab" disabled>Resources</button>
                  </div>
                </div>

                <div className="tools-search-row">
                  <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search tools..."
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                      className="search-input"
                    />
                    {toolSearch && (
                      <button className="clear-search" onClick={() => setToolSearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <span className="tools-count">{selectedTools.length}/{tools.length} tools</span>
                  <button className="select-all-btn" onClick={selectAllTools}>
                    {allToolsSelected ? <Check size={14} /> : someToolsSelected ? <Minus size={14} /> : null}
                    Select All
                  </button>
                </div>

                <div className="tools-list">
                  {loadingTools ? (
                    <div className="loading-tools">Loading tools...</div>
                  ) : filteredTools.length === 0 ? (
                    <div className="no-tools">No tools found</div>
                  ) : (
                    filteredTools.map((tool) => (
                      <label key={tool.name} className="tool-item">
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.name)}
                          onChange={() => toggleTool(tool.name)}
                        />
                        <div className="tool-info">
                          <span className="tool-name">{tool.name}</span>
                          <span className="tool-type">Tools</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Section */}
          <div className="form-section">
            <label className="section-label">
              Action
              <span className="section-hint">(Rule Action Type)</span>
            </label>
            <div className="action-options">
              <label className="action-option">
                <input
                  type="radio"
                  name="action"
                  checked={action === 'allow'}
                  onChange={() => setAction('allow')}
                />
                <span className="action-allow">Allow Access</span>
              </label>
              <label className="action-option">
                <input
                  type="radio"
                  name="action"
                  checked={action === 'deny'}
                  onChange={() => setAction('deny')}
                />
                <span className="action-deny">Deny Access</span>
              </label>
              <label className="action-option">
                <input
                  type="radio"
                  name="action"
                  checked={action === 'audit'}
                  onChange={() => setAction('audit')}
                />
                <span className="action-audit">Audit Only</span>
              </label>
            </div>
          </div>

          {/* Conditions Section (Advanced) */}
          <div className="form-section">
            <button 
              className="conditions-toggle"
              onClick={() => setShowConditions(!showConditions)}
            >
              {showConditions ? '− Hide' : '+ Add'} Conditions (Advanced)
            </button>

            {showConditions && (
              <div className="conditions-editor">
                <div className="conditions-info">
                  <Info size={14} />
                  <span>Add runtime conditions for fine-grained control. These become part of the policy rules DSL.</span>
                </div>
                
                {conditions.map((condition, index) => (
                  <div key={index} className="condition-row">
                    {/* Field selector with grouped options - same as UnifiedPolicyForm */}
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      className="condition-field-select"
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

                    {/* Operator selector */}
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                      className="condition-operator-select"
                    >
                      {conditionOperators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value input - dynamic based on field type */}
                    {renderConditionValueInput(condition, index)}

                    <button 
                      className="remove-condition-btn"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button className="add-condition-btn" onClick={addCondition}>
                  + Add Condition
                </button>
              </div>
            )}
          </div>

          {/* Policy Summary */}
          <div className="form-section policy-summary">
            <label className="section-label">Policy Summary</label>
            <div className="summary-content">
              <div className="summary-item">
                <span className="summary-label">Policy Code:</span>
                <code className="summary-value">{generatePolicyCode(serverName)}</code>
              </div>
              <div className="summary-item">
                <span className="summary-label">Applies to:</span>
                <span className="summary-value">
                  {isGlobalPolicy 
                    ? 'Everyone (Global)' 
                    : selectedSubjects.length > 0 
                      ? `${selectedSubjects.length} ${getPrincipalTypeLabel().toLowerCase()}(s)` 
                      : 'Not specified'}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Resources:</span>
                <span className="summary-value">
                  {accessScope === 'entire_server' 
                    ? `${serverName} (entire server)` 
                    : `${selectedTools.length} tool(s) in ${serverName}`}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Action:</span>
                <span className={`summary-value action-${action}`}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            + Add Access Policy
          </Button>
        </div>
      </div>
    </div>
  );
}
