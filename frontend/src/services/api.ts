import axios from 'axios';
import type {
  Policy,
  PolicyListResponse,
  PolicyValidationResponse,
  UnifiedPolicy,
  UnifiedPolicyListResponse,
  UnifiedPolicyCreateRequest,
  UnifiedPolicyUpdateRequest,
  ResourcePoliciesResponse,
  ResourceType,
} from '../types/policy';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor for adding auth tokens (if needed)
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || error.response.statusText;
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Please check if the Policy Engine is running.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// ============================================================================
// Policy Management API
// ============================================================================

export const policyApi = {
  // List all policies
  list: async (): Promise<PolicyListResponse> => {
    const response = await api.get<PolicyListResponse>('/policies');
    return response.data;
  },

  // Get policy by ID
  get: async (id: string): Promise<Policy> => {
    const response = await api.get<Policy>(`/policies/${id}`);
    return response.data;
  },

  // Create new policy
  create: async (policy: Omit<Policy, 'id' | 'version' | 'created_at' | 'updated_at'>): Promise<Policy> => {
    const response = await api.post<Policy>('/policies', policy);
    return response.data;
  },

  // Update existing policy
  update: async (id: string, policy: Partial<Policy>): Promise<Policy> => {
    const response = await api.put<Policy>(`/policies/${id}`, policy);
    return response.data;
  },

  // Delete policy
  delete: async (id: string): Promise<void> => {
    await api.delete(`/policies/${id}`);
  },

  // Enable policy
  enable: async (id: string): Promise<void> => {
    await api.post(`/policies/${id}/enable`);
  },

  // Disable policy
  disable: async (id: string): Promise<void> => {
    await api.post(`/policies/${id}/disable`);
  },

  // Validate policy
  validate: async (policy: Partial<Policy>): Promise<PolicyValidationResponse> => {
    const response = await api.post<PolicyValidationResponse>('/policies/validate', policy);
    return response.data;
  },

  // Reload policies from disk
  reload: async (): Promise<{ status: string; count: number }> => {
    const response = await api.post<{ status: string; count: number }>('/reload');
    return response.data;
  },
};

// Health check
export const healthCheck = async (): Promise<{ status: string; service: string }> => {
  const response = await api.get('/../../health');
  return response.data;
};

// ============================================================================
// MCP Server Management API (proxied from Java Gateway)
// ============================================================================

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface MCPServer {
  name: string;
  url?: string;
  type?: string;
  timeout?: number;
  enabled: boolean;
  description?: string;
  image_icon?: string;
  policy_id?: string;
  tags?: string[];
  auth?: {
    method?: string;
    location?: string;
    name?: string;
    format?: string;
    prefix?: string;
    credential_ref?: string;
    credential?: string;
    has_credential?: boolean;
    credential_masked?: string;
  };
  metadata?: Record<string, any>;
  // When include_policies=true
  policies?: UnifiedPolicy[];
  policy_count?: number;
  policy_error?: string;
}

export interface MCPServersResponse {
  servers: MCPServer[];
  count: number;
}

export interface MCPServerPoliciesResponse {
  server_name: string;
  policies: UnifiedPolicy[];
  count: number;
}

export interface MCPToolsResponse {
  server: string;
  tools: MCPTool[];
  count: number;
}

export const mcpServerApi = {
  // List all MCP servers (via Policy Engine proxy)
  list: async (): Promise<MCPServersResponse> => {
    const response = await api.get<MCPServersResponse>('/mcp-servers');
    return response.data;
  },

  // Get tools for a specific server (via Policy Engine proxy)
  getTools: async (serverName: string): Promise<MCPToolsResponse> => {
    const response = await api.get<MCPToolsResponse>(`/mcp-servers/${serverName}/tools`);
    return response.data;
  },

  // Get server info (via Policy Engine proxy)
  getInfo: async (serverName: string): Promise<Record<string, any>> => {
    const response = await api.get<Record<string, any>>(`/mcp-servers/${serverName}/info`);
    return response.data;
  },
};

// ============================================================================
// MCP Server Configuration API (direct to Java Gateway)
// ============================================================================

const JAVA_GATEWAY_URL = import.meta.env.VITE_JAVA_GATEWAY_URL || 'http://localhost:8000';

const javaGatewayApi = axios.create({
  baseURL: JAVA_GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor for Java Gateway
javaGatewayApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for Java Gateway - preserves response status for error handling
javaGatewayApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Preserve the original error with response data
      const enhancedError: any = new Error(
        error.response.data?.error || error.response.data?.message || error.response.statusText
      );
      enhancedError.response = error.response;
      enhancedError.status = error.response.status;
      throw enhancedError;
    } else if (error.request) {
      throw new Error('No response from Java Gateway. Please check if it is running.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

export interface MCPServerConfigRequest {
  url: string;
  type: string;
  timeout?: number;
  enabled: boolean;
  description?: string;
  image_icon?: string;
  policy_id?: string;
  tags?: string[];
  auth?: {
    method?: string;
    location?: string;
    name?: string;
    format?: string;
    prefix?: string;
    credential_ref?: string;
    credential?: string;
  };
  metadata?: Record<string, any>;
}

export interface MCPServerConfigResponse extends MCPServerConfigRequest {
  name?: string;
  policies?: UnifiedPolicy[];
  policy_count?: number;
  policy_error?: string;
}

export interface MCPServerGroup {
  id: string;
  name: string;
  description?: string;
  serverNames: string[];
  server_count?: number;
  tool_config?: Record<string, string[]>; // Map of server name -> allowed tool names
  gateway_url?: string;
  gateway_port?: number;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MCPGroupsResponse {
  groups: MCPServerGroup[];
  count: number;
}

export const javaGatewayMcpApi = {
  // Get server configuration with policies (from Java Gateway)
  getConfig: async (serverName: string): Promise<MCPServerConfigResponse> => {
    const response = await javaGatewayApi.get<MCPServerConfigResponse>(`/mcp/servers/${serverName}/config`);
    return response.data;
  },

  // Update server configuration (directly to Java Gateway)
  updateConfig: async (serverName: string, config: MCPServerConfigRequest): Promise<void> => {
    await javaGatewayApi.put(`/mcp/servers/${serverName}/config`, config);
  },

  // Create new server (directly to Java Gateway)
  createServer: async (serverName: string, config: MCPServerConfigRequest): Promise<void> => {
    await javaGatewayApi.post('/mcp/servers', {
      name: serverName,
      ...config,
    });
  },

  // Delete server (directly to Java Gateway)
  deleteServer: async (serverName: string): Promise<void> => {
    await javaGatewayApi.delete(`/mcp/servers/${serverName}`);
  },

  // Reload server configuration (directly to Java Gateway)
  reloadConfig: async (): Promise<void> => {
    await javaGatewayApi.post('/mcp/servers/reload');
  },

  // Convert STDIO server to HTTP
  convertStdioToHttp: async (serverName: string): Promise<{ name: string; type: string; url: string; status: string; proxy_port: number }> => {
    const response = await javaGatewayApi.post(`/mcp/servers/${serverName}/convert`);
    return response.data;
  },

  // List all servers with policies (include_policies=true)
  listServersWithPolicies: async (): Promise<MCPServersResponse> => {
    const response = await javaGatewayApi.get<MCPServersResponse>('/mcp/servers', {
      params: { include_policies: true },
    });
    return response.data;
  },

  // List all servers without policies (faster)
  listServers: async (): Promise<MCPServersResponse> => {
    const response = await javaGatewayApi.get<MCPServersResponse>('/mcp/servers');
    return response.data;
  },

  // Get policies for a specific server
  getServerPolicies: async (
    serverName: string,
    activeOnly = true,
    includeGlobal = true
  ): Promise<MCPServerPoliciesResponse> => {
    const response = await javaGatewayApi.get<MCPServerPoliciesResponse>(
      `/mcp/servers/${serverName}/policies`,
      {
        params: { active_only: activeOnly, include_global: includeGlobal },
      }
    );
    return response.data;
  },

  // List tools for a specific server (test connection)
  listTools: async (serverName: string): Promise<MCPToolsResponse> => {
    const response = await javaGatewayApi.get<MCPToolsResponse>(
      '/mcp/list-tools',
      { params: { mcp_server: serverName } }
    );
    return response.data;
  },

  // Get policy-allowed tools for a specific server (Phase 3)
  getPolicyAllowedTools: async (serverName: string): Promise<MCPToolsResponse & { policy_filtered: boolean; total_server_tools: number }> => {
    const response = await javaGatewayApi.get<MCPToolsResponse & { policy_filtered: boolean; total_server_tools: number }>(
      `/mcp/servers/${serverName}/policy-allowed-tools`
    );
    return response.data;
  },

  // ============================================================================
  // MCP Server Groups API
  // ============================================================================

  // List all groups
  listGroups: async (): Promise<MCPGroupsResponse> => {
    const response = await javaGatewayApi.get<MCPGroupsResponse>('/mcp/groups');
    return response.data;
  },

  // Get a specific group
  getGroup: async (groupId: string): Promise<MCPServerGroup> => {
    const response = await javaGatewayApi.get<MCPServerGroup>(`/mcp/groups/${groupId}`);
    return response.data;
  },

  // Create a new group
  createGroup: async (name: string, description: string | undefined, serverNames: string[]): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.post('/mcp/groups', {
      name,
      description,
      serverNames,
    });
    return response.data;
  },

  // Update a group
  updateGroup: async (groupId: string, updates: Partial<MCPServerGroup>): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.put(`/mcp/groups/${groupId}`, updates);
    return response.data;
  },

  // Delete a group
  deleteGroup: async (groupId: string): Promise<void> => {
    await javaGatewayApi.delete(`/mcp/groups/${groupId}`);
  },

  // Add a server to a group
  addServerToGroup: async (groupId: string, serverName: string): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.post(`/mcp/groups/${groupId}/servers/${serverName}`);
    return response.data;
  },

  // Remove a server from a group
  removeServerFromGroup: async (groupId: string, serverName: string): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.delete(`/mcp/groups/${groupId}/servers/${serverName}`);
    return response.data;
  },

  // Add multiple servers to a group
  addServersToGroup: async (groupId: string, serverNames: string[]): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.post(`/mcp/groups/${groupId}/servers`, {
      serverNames,
    });
    return response.data;
  },

  // Configure which tools from a server are exposed through the group
  configureServerTools: async (groupId: string, serverName: string, tools: string[]): Promise<{ success: boolean; message: string; group: MCPServerGroup }> => {
    const response = await javaGatewayApi.put(`/mcp/groups/${groupId}/servers/${serverName}/tools`, {
      tools,
    });
    return response.data;
  },
};

// ============================================================================
// Unified Policy API (via Policy Engine)
// ============================================================================

export const unifiedPolicyApi = {
  // List all unified policies
  list: async (status?: string): Promise<UnifiedPolicyListResponse> => {
    const response = await api.get<UnifiedPolicyListResponse>('/unified/policies', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  // Get policy by ID
  get: async (policyId: string): Promise<UnifiedPolicy> => {
    const response = await api.get<UnifiedPolicy>(`/unified/policies/${policyId}`);
    return response.data;
  },

  // Get policy by code
  getByCode: async (code: string): Promise<UnifiedPolicy> => {
    const response = await api.get<UnifiedPolicy>(`/unified/policies/code/${code}`);
    return response.data;
  },

  // Create new policy
  create: async (policy: UnifiedPolicyCreateRequest): Promise<UnifiedPolicy> => {
    const response = await api.post<UnifiedPolicy>('/unified/policies', policy);
    return response.data;
  },

  // Update policy
  update: async (policyId: string, policy: UnifiedPolicyUpdateRequest): Promise<UnifiedPolicy> => {
    const response = await api.put<UnifiedPolicy>(`/unified/policies/${policyId}`, policy);
    return response.data;
  },

  // Delete policy
  delete: async (policyId: string): Promise<void> => {
    await api.delete(`/unified/policies/${policyId}`);
  },

  // Activate policy
  activate: async (policyId: string): Promise<UnifiedPolicy> => {
    const response = await api.post<UnifiedPolicy>(`/unified/policies/${policyId}/activate`);
    return response.data;
  },

  // Suspend policy
  suspend: async (policyId: string): Promise<UnifiedPolicy> => {
    const response = await api.post<UnifiedPolicy>(`/unified/policies/${policyId}/suspend`);
    return response.data;
  },

  // Retire policy
  retire: async (policyId: string): Promise<UnifiedPolicy> => {
    const response = await api.post<UnifiedPolicy>(`/unified/policies/${policyId}/retire`);
    return response.data;
  },

  // Get policies by resource
  getByResource: async (
    resourceType: ResourceType,
    resourceId: string,
    activeOnly = true,
    includeGlobal = true
  ): Promise<ResourcePoliciesResponse> => {
    const response = await api.get<ResourcePoliciesResponse>(
      `/unified/resources/${resourceType}/${resourceId}/policies`,
      {
        params: { active: activeOnly, include_global: includeGlobal },
      }
    );
    return response.data;
  },

  // Add resource binding to policy
  addResource: async (
    policyId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<UnifiedPolicy> => {
    const response = await api.post<UnifiedPolicy>(`/unified/policies/${policyId}/resources`, {
      resource_type: resourceType,
      resource_id: resourceId,
    });
    return response.data;
  },

  // Remove resource binding from policy
  removeResource: async (
    policyId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<UnifiedPolicy> => {
    const response = await api.delete<UnifiedPolicy>(
      `/unified/policies/${policyId}/resources/${resourceType}/${resourceId}`
    );
    return response.data;
  },

  // Reload policies from disk
  reload: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post<{ message: string; count: number }>('/unified/reload');
    return response.data;
  },
};

export default api;
