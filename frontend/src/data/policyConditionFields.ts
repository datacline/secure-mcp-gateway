// Dummy data for policy condition fields and their possible values
// This can be replaced with API-fetched data in the future

export interface ConditionFieldOption {
  field: string;
  label: string;
  description: string;
  valueType: 'select' | 'multiselect' | 'text' | 'number' | 'boolean';
  possibleValues?: { value: string; label: string }[];
}

export const conditionFields: ConditionFieldOption[] = [
  {
    field: 'user.id',
    label: 'User ID',
    description: 'The unique identifier of the user',
    valueType: 'text',
  },
  {
    field: 'user.email',
    label: 'User Email',
    description: 'The email address of the user',
    valueType: 'text',
  },
  {
    field: 'user.role',
    label: 'User Role',
    description: 'The role assigned to the user',
    valueType: 'select',
    possibleValues: [
      { value: 'admin', label: 'Admin' },
      { value: 'developer', label: 'Developer' },
      { value: 'analyst', label: 'Analyst' },
      { value: 'viewer', label: 'Viewer' },
      { value: 'guest', label: 'Guest' },
    ],
  },
  {
    field: 'user.department',
    label: 'User Department',
    description: 'The department the user belongs to',
    valueType: 'select',
    possibleValues: [
      { value: 'engineering', label: 'Engineering' },
      { value: 'product', label: 'Product' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'sales', label: 'Sales' },
      { value: 'hr', label: 'Human Resources' },
      { value: 'finance', label: 'Finance' },
      { value: 'legal', label: 'Legal' },
    ],
  },
  {
    field: 'user.groups',
    label: 'User Groups',
    description: 'Groups the user is a member of',
    valueType: 'multiselect',
    possibleValues: [
      { value: 'admins', label: 'Administrators' },
      { value: 'developers', label: 'Developers' },
      { value: 'data-team', label: 'Data Team' },
      { value: 'security-team', label: 'Security Team' },
      { value: 'ml-engineers', label: 'ML Engineers' },
      { value: 'devops', label: 'DevOps' },
    ],
  },
  {
    field: 'request.ip',
    label: 'Request IP',
    description: 'The IP address of the request',
    valueType: 'text',
  },
  {
    field: 'request.country',
    label: 'Request Country',
    description: 'The country of origin for the request',
    valueType: 'select',
    possibleValues: [
      { value: 'US', label: 'United States' },
      { value: 'UK', label: 'United Kingdom' },
      { value: 'CA', label: 'Canada' },
      { value: 'DE', label: 'Germany' },
      { value: 'FR', label: 'France' },
      { value: 'JP', label: 'Japan' },
      { value: 'AU', label: 'Australia' },
      { value: 'IN', label: 'India' },
    ],
  },
  {
    field: 'request.method',
    label: 'Request Method',
    description: 'The HTTP method of the request',
    valueType: 'select',
    possibleValues: [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'PATCH', label: 'PATCH' },
    ],
  },
  {
    field: 'time.hour',
    label: 'Hour of Day',
    description: 'The hour of the day (0-23)',
    valueType: 'number',
  },
  {
    field: 'time.day_of_week',
    label: 'Day of Week',
    description: 'The day of the week',
    valueType: 'select',
    possibleValues: [
      { value: 'monday', label: 'Monday' },
      { value: 'tuesday', label: 'Tuesday' },
      { value: 'wednesday', label: 'Wednesday' },
      { value: 'thursday', label: 'Thursday' },
      { value: 'friday', label: 'Friday' },
      { value: 'saturday', label: 'Saturday' },
      { value: 'sunday', label: 'Sunday' },
    ],
  },
  {
    field: 'time.is_business_hours',
    label: 'Business Hours',
    description: 'Whether the request is during business hours',
    valueType: 'boolean',
    possibleValues: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    field: 'tool.name',
    label: 'Tool Name',
    description: 'The name of the MCP tool being invoked',
    valueType: 'text',
  },
  {
    field: 'tool.category',
    label: 'Tool Category',
    description: 'The category of the tool',
    valueType: 'select',
    possibleValues: [
      { value: 'database', label: 'Database' },
      { value: 'file', label: 'File Operations' },
      { value: 'api', label: 'API Calls' },
      { value: 'ai', label: 'AI/ML' },
      { value: 'communication', label: 'Communication' },
      { value: 'analytics', label: 'Analytics' },
    ],
  },
  {
    field: 'resource.type',
    label: 'Resource Type',
    description: 'The type of resource being accessed',
    valueType: 'select',
    possibleValues: [
      { value: 'mcp_server', label: 'MCP Server' },
      { value: 'tool', label: 'Tool' },
      { value: 'database', label: 'Database' },
      { value: 'file', label: 'File' },
      { value: 'api', label: 'API Endpoint' },
    ],
  },
  {
    field: 'resource.sensitivity',
    label: 'Resource Sensitivity',
    description: 'The sensitivity level of the resource',
    valueType: 'select',
    possibleValues: [
      { value: 'public', label: 'Public' },
      { value: 'internal', label: 'Internal' },
      { value: 'confidential', label: 'Confidential' },
      { value: 'restricted', label: 'Restricted' },
      { value: 'top_secret', label: 'Top Secret' },
    ],
  },
  {
    field: 'data.contains_pii',
    label: 'Contains PII',
    description: 'Whether the data contains personally identifiable information',
    valueType: 'boolean',
    possibleValues: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    field: 'data.classification',
    label: 'Data Classification',
    description: 'The classification level of the data',
    valueType: 'select',
    possibleValues: [
      { value: 'public', label: 'Public' },
      { value: 'internal', label: 'Internal' },
      { value: 'confidential', label: 'Confidential' },
      { value: 'secret', label: 'Secret' },
    ],
  },
  {
    field: 'session.duration_minutes',
    label: 'Session Duration (minutes)',
    description: 'How long the current session has been active',
    valueType: 'number',
  },
  {
    field: 'session.is_mfa_verified',
    label: 'MFA Verified',
    description: 'Whether the session has passed MFA verification',
    valueType: 'boolean',
    possibleValues: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
];

// Helper function to get field by name
export const getFieldByName = (fieldName: string): ConditionFieldOption | undefined => {
  return conditionFields.find(f => f.field === fieldName);
};

// Get grouped fields for better organization in UI
export const getGroupedFields = () => {
  const groups: Record<string, ConditionFieldOption[]> = {
    'User': conditionFields.filter(f => f.field.startsWith('user.')),
    'Request': conditionFields.filter(f => f.field.startsWith('request.')),
    'Time': conditionFields.filter(f => f.field.startsWith('time.')),
    'Tool': conditionFields.filter(f => f.field.startsWith('tool.')),
    'Resource': conditionFields.filter(f => f.field.startsWith('resource.')),
    'Data': conditionFields.filter(f => f.field.startsWith('data.')),
    'Session': conditionFields.filter(f => f.field.startsWith('session.')),
  };
  return groups;
};
