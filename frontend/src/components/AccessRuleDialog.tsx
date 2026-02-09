import { useState } from 'react';
import { type MCPTool } from '../services/api';
import './AccessRuleDialog.css';

interface AccessRuleDialogProps {
  serverName: string;
  tools: MCPTool[];
  onClose: () => void;
  onSubmit: (rule: any) => void;
}

type SubjectType = 'user' | 'group' | 'role';
type ScopeType = 'entire_server' | 'specific_tools';

export default function AccessRuleDialog({ serverName, tools, onClose, onSubmit }: AccessRuleDialogProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('user');
  const [scopeType, setScopeType] = useState<ScopeType>('specific_tools');
  const [selectedUser, setSelectedUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'tools' | 'resources'>('tools');

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleTool = (toolName: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName);
    } else {
      newSelected.add(toolName);
    }
    setSelectedTools(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTools.size === filteredTools.length) {
      setSelectedTools(new Set());
    } else {
      setSelectedTools(new Set(filteredTools.map(t => t.name)));
    }
  };

  const handleSubmit = () => {
    const rule = {
      subjectType,
      scopeType,
      selectedUser,
      serverName,
      selectedTools: Array.from(selectedTools),
    };
    onSubmit(rule);
  };

  const isValid = selectedUser && (scopeType === 'entire_server' || selectedTools.size > 0);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-container" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>New Access Rule</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
          {/* Applies To Section */}
          <div className="form-section">
            <label className="form-label">Applies To</label>
            <div className="subject-tabs">
              <button
                className={`subject-tab ${subjectType === 'user' ? 'active' : ''}`}
                onClick={() => setSubjectType('user')}
              >
                <span className="tab-icon">👤</span>
                User
              </button>
              <button
                className={`subject-tab ${subjectType === 'group' ? 'active' : ''}`}
                onClick={() => setSubjectType('group')}
              >
                <span className="tab-icon">👥</span>
                Group
              </button>
              <button
                className={`subject-tab ${subjectType === 'role' ? 'active' : ''}`}
                onClick={() => setSubjectType('role')}
              >
                <span className="tab-icon">🎭</span>
                Role
              </button>
            </div>
          </div>

          {/* Select User/Group/Role */}
          <div className="form-section">
            <label className="form-label">
              Select {subjectType.charAt(0).toUpperCase() + subjectType.slice(1)}
            </label>
            <select 
              className="form-select"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Select {subjectType}s</option>
              {subjectType === 'user' && (
                <>
                  <option value="user1">Alice Smith</option>
                  <option value="user2">Bob Johnson</option>
                  <option value="user3">Carol Williams</option>
                </>
              )}
              {subjectType === 'group' && (
                <>
                  <option value="group1">Engineering</option>
                  <option value="group2">Product</option>
                  <option value="group3">Everyone</option>
                </>
              )}
              {subjectType === 'role' && (
                <>
                  <option value="role1">Admin</option>
                  <option value="role2">Developer</option>
                  <option value="role3">Viewer</option>
                </>
              )}
            </select>
          </div>

          {/* Access Scope Section */}
          <div className="form-section">
            <label className="form-label">Access Scope</label>
            <div className="scope-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeType === 'entire_server'}
                  onChange={() => setScopeType('entire_server')}
                />
                <span>Entire Server</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeType === 'specific_tools'}
                  onChange={() => setScopeType('specific_tools')}
                />
                <span>Specific Tools & Resources</span>
              </label>
            </div>
          </div>

          {/* Tools & Resources Selection */}
          {scopeType === 'specific_tools' && (
            <div className="form-section">
              <div className="tools-header">
                <div className="tools-tabs">
                  <button
                    className={`tools-tab ${activeTab === 'tools' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tools')}
                  >
                    Select Tools
                  </button>
                  <button
                    className={`tools-tab ${activeTab === 'resources' ? 'active' : ''}`}
                    onClick={() => setActiveTab('resources')}
                  >
                    Resources
                  </button>
                </div>
              </div>

              {activeTab === 'tools' && (
                <div className="tools-content">
                  <div className="tools-search">
                    <input
                      type="text"
                      placeholder="list"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                    {searchQuery && (
                      <button 
                        className="clear-search"
                        onClick={() => setSearchQuery('')}
                      >
                        ×
                      </button>
                    )}
                    <div className="search-meta">
                      <span>{selectedTools.size}/{filteredTools.length} tools</span>
                      <button 
                        className="select-all-btn"
                        onClick={handleSelectAll}
                      >
                        ☑ Select All
                      </button>
                    </div>
                  </div>

                  <div className="tools-list">
                    {filteredTools.length === 0 ? (
                      <div className="empty-tools">
                        <p>No tools found</p>
                      </div>
                    ) : (
                      filteredTools.map((tool) => (
                        <label key={tool.name} className="tool-item">
                          <input
                            type="checkbox"
                            checked={selectedTools.has(tool.name)}
                            onChange={() => handleToggleTool(tool.name)}
                          />
                          <div className="tool-icon">🔧</div>
                          <div className="tool-info">
                            <div className="tool-name">{tool.name}</div>
                            {tool.description && (
                              <div className="tool-description">{tool.description}</div>
                            )}
                          </div>
                          <span className="tool-badge">Tools</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="resources-content">
                  <div className="empty-resources">
                    <p>No resources available for this server</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={!isValid}
          >
            + Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}
