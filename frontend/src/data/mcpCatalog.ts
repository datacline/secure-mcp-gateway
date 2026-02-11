/**
 * MCP Server Catalog API Client
 * Fetches MCP servers from Postman MCP Catalog via Go Policy Engine proxy
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// Types matching the Postman API response (transformed by backend)
export interface MCPServerConfig {
  // Type of the MCP server
  type: 'stdio' | 'http';
  // For stdio servers
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For HTTP/SSE servers
  url?: string;
  headers?: Record<string, string>;
  // Auth configuration extracted from headers/env
  auth_method?: 'bearer' | 'api_key' | 'env_var' | 'none';
  auth_header_name?: string;
  auth_env_var?: string;
}

export interface MCPPublisher {
  id: string;
  name: string;
  logo?: string;
  verified: boolean;
}

export interface MCPCatalogItem {
  id: string;
  name: string;
  description: string;
  publisher: MCPPublisher;
  type: 'stdio' | 'http';           // Primary type field
  server_type: 'stdio' | 'sse';     // Backward compatible alias
  config: MCPServerConfig;
  tags: string[];
  category: string;
  official: boolean;
  featured: boolean;
}

export interface CatalogSearchResponse {
  servers: MCPCatalogItem[];
  total_count: number;
  returned_count: number;
  query: string;
  limit: number;
  offset: number;
  page: number;
  total_pages: number;
  has_more: boolean;
  cache_status: 'ready' | 'loading' | 'empty';
}

export interface CatalogStatusResponse {
  total_servers: number;
  last_updated: string;
  is_loading: boolean;
  error?: string;
}

/**
 * Get catalog cache status
 */
export async function getCatalogStatus(): Promise<CatalogStatusResponse> {
  const response = await catalogApi.get<CatalogStatusResponse>('/status');
  return response.data;
}

/**
 * Trigger a cache refresh
 */
export async function refreshCatalog(): Promise<{ message: string }> {
  const response = await catalogApi.post<{ message: string }>('/refresh');
  return response.data;
}

export interface CatalogCategory {
  id: string;
  name: string;
  icon: string;
}

// API Client
const catalogApi = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/mcp-catalog`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds for search
});

/**
 * Search the MCP catalog
 */
export async function searchCatalog(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<CatalogSearchResponse> {
  const response = await catalogApi.get<CatalogSearchResponse>('/search', {
    params: { q: query, limit, offset },
    validateStatus: (status) => status === 200 || status === 204, // Accept both 200 and 204
  });

  // Handle 204 No Content - no results found
  if (response.status === 204 || !response.data) {
    return {
      servers: [],
      total_count: 0,
      returned_count: 0,
      query: query,
      limit: limit,
      offset: offset,
      page: Math.floor(offset / limit) + 1,
      total_pages: 0,
      has_more: false,
      cache_status: 'ready',
    };
  }

  // Normalize servers array (backend may return null for empty results)
  const data = response.data;
  if (!Array.isArray(data.servers)) {
    data.servers = [];
  }

  return data;
}

/**
 * Get available categories for filtering
 */
export async function getCategories(): Promise<CatalogCategory[]> {
  const response = await catalogApi.get<{ categories: CatalogCategory[] }>('/categories');
  return response.data.categories;
}

// Category labels and icons for UI (fallback)
export const categoryLabels: Record<string, string> = {
  'database': 'Database',
  'api': 'API',
  'ai-ml': 'AI & ML',
  'web-scraping': 'Web Scraping',
  'productivity': 'Productivity',
  'cloud': 'Cloud Services',
  'development': 'Development',
  'file-system': 'File System',
  'communication': 'Communication',
  'search': 'Search',
  'other': 'Other',
};

export const categoryIcons: Record<string, string> = {
  'database': '🗄️',
  'api': '🔌',
  'ai-ml': '🤖',
  'web-scraping': '🕷️',
  'productivity': '📋',
  'cloud': '☁️',
  'development': '💻',
  'file-system': '📁',
  'communication': '💬',
  'search': '🔍',
  'other': '📦',
};

// Default search terms for browsing
export const defaultSearchTerms = [
  'database',
  'api',
  'ai',
  'stripe',
  'github',
  'slack',
  'notion',
  'aws',
  'google',
  'browser',
];

// Helper to get a random default search term
export function getRandomSearchTerm(): string {
  return defaultSearchTerms[Math.floor(Math.random() * defaultSearchTerms.length)];
}

// Helper to get category label
export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

// Helper to get category icon
export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || '📦';
}
