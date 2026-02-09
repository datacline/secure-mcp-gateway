/**
 * Users data API client - Fetches user-related information from the backend
 * Data is served by the policy-engine-go backend from /api/v1/principals
 * 
 * This module provides:
 * - Type definitions for User, UserGroup, UserRole
 * - API functions to fetch data from backend
 * - Local cache for frequently accessed data
 * - Synchronous helper functions for lookups (using cached data)
 */

import axios from 'axios';

// API base URL (same as policy engine)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';
const api = axios.create({ baseURL: `${API_BASE_URL}/api/v1` });

// ============================================================================
// Type Definitions
// ============================================================================

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  avatar?: string;
  role: string;
  department: string;
  title: string;
  groups: string[];
  status: 'active' | 'inactive' | 'pending';
  mfa_enabled: boolean;
  created_at: string;
  last_login?: string;
}

// Response types
interface AllPrincipalsResponse {
  users: User[];
  groups: UserGroup[];
  roles: UserRole[];
}

interface UsersResponse {
  users: User[];
  count: number;
}

interface GroupsResponse {
  groups: UserGroup[];
  count: number;
}

interface RolesResponse {
  roles: UserRole[];
  count: number;
}

// ============================================================================
// Local Cache
// ============================================================================

let cachedUsers: User[] = [];
let cachedGroups: UserGroup[] = [];
let cachedRoles: UserRole[] = [];
let cacheLoaded = false;
let cachePromise: Promise<void> | null = null;

// ============================================================================
// API Functions (Async)
// ============================================================================

/**
 * Fetch all principals (users, groups, roles) from the backend
 */
export async function fetchAllPrincipals(): Promise<AllPrincipalsResponse> {
  const response = await api.get<AllPrincipalsResponse>('/principals');
  // Update cache
  cachedUsers = response.data.users || [];
  cachedGroups = response.data.groups || [];
  cachedRoles = response.data.roles || [];
  cacheLoaded = true;
  return response.data;
}

/**
 * Fetch all users from the backend
 */
export async function fetchUsers(filters?: { role?: string; group?: string; status?: string }): Promise<User[]> {
  const response = await api.get<UsersResponse>('/users', { params: filters });
  return response.data.users || [];
}

/**
 * Fetch a single user by ID
 */
export async function fetchUserById(id: string): Promise<User | null> {
  try {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Search users by query
 */
export async function fetchSearchUsers(query: string): Promise<User[]> {
  const response = await api.get<UsersResponse>('/users/search', { params: { q: query } });
  return response.data.users || [];
}

/**
 * Fetch all groups from the backend
 */
export async function fetchGroups(): Promise<UserGroup[]> {
  const response = await api.get<GroupsResponse>('/groups');
  return response.data.groups || [];
}

/**
 * Fetch a single group by ID
 */
export async function fetchGroupById(id: string): Promise<UserGroup | null> {
  try {
    const response = await api.get<UserGroup>(`/groups/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Search groups by query
 */
export async function fetchSearchGroups(query: string): Promise<UserGroup[]> {
  const response = await api.get<GroupsResponse>('/groups/search', { params: { q: query } });
  return response.data.groups || [];
}

/**
 * Fetch all roles from the backend
 */
export async function fetchRoles(): Promise<UserRole[]> {
  const response = await api.get<RolesResponse>('/roles');
  return response.data.roles || [];
}

/**
 * Fetch a single role by ID
 */
export async function fetchRoleById(id: string): Promise<UserRole | null> {
  try {
    const response = await api.get<UserRole>(`/roles/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Search roles by query
 */
export async function fetchSearchRoles(query: string): Promise<UserRole[]> {
  const response = await api.get<RolesResponse>('/roles/search', { params: { q: query } });
  return response.data.roles || [];
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Ensure cache is loaded (call this before using synchronous helpers)
 */
export async function ensureCacheLoaded(): Promise<void> {
  if (cacheLoaded) return;
  
  if (cachePromise) {
    return cachePromise;
  }
  
  cachePromise = fetchAllPrincipals().then(() => {
    cachePromise = null;
  }).catch((error) => {
    console.error('Failed to load principals cache:', error);
    cachePromise = null;
  });
  
  return cachePromise;
}

/**
 * Reload cache from backend
 */
export async function reloadCache(): Promise<void> {
  cacheLoaded = false;
  await fetchAllPrincipals();
}

/**
 * Get cached users (synchronous)
 */
export function getCachedUsers(): User[] {
  return cachedUsers;
}

/**
 * Get cached groups (synchronous)
 */
export function getCachedGroups(): UserGroup[] {
  return cachedGroups;
}

/**
 * Get cached roles (synchronous)
 */
export function getCachedRoles(): UserRole[] {
  return cachedRoles;
}

// ============================================================================
// Synchronous Helper Functions (using cached data)
// ============================================================================

/**
 * Get user by ID (from cache)
 */
export function getUserById(id: string): User | undefined {
  return cachedUsers.find(u => u.id === id);
}

/**
 * Get user by email (from cache)
 */
export function getUserByEmail(email: string): User | undefined {
  return cachedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/**
 * Get users by role (from cache)
 */
export function getUsersByRole(role: string): User[] {
  return cachedUsers.filter(u => u.role === role);
}

/**
 * Get users by department (from cache)
 */
export function getUsersByDepartment(department: string): User[] {
  return cachedUsers.filter(u => u.department === department);
}

/**
 * Get users by group (from cache)
 */
export function getUsersByGroup(groupId: string): User[] {
  return cachedUsers.filter(u => u.groups.includes(groupId));
}

/**
 * Get active users only (from cache)
 */
export function getActiveUsers(): User[] {
  return cachedUsers.filter(u => u.status === 'active');
}

/**
 * Get group by ID (from cache)
 */
export function getGroupById(id: string): UserGroup | undefined {
  return cachedGroups.find(g => g.id === id);
}

/**
 * Get role by ID (from cache)
 */
export function getRoleById(id: string): UserRole | undefined {
  return cachedRoles.find(r => r.id === id);
}

/**
 * Search users by name or email (from cache)
 */
export function searchUsers(query: string): User[] {
  if (!query) return cachedUsers;
  const lowerQuery = query.toLowerCase();
  return cachedUsers.filter(u => 
    u.name.toLowerCase().includes(lowerQuery) ||
    u.email.toLowerCase().includes(lowerQuery) ||
    u.department.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search groups by name (from cache)
 */
export function searchGroups(query: string): UserGroup[] {
  if (!query) return cachedGroups;
  const lowerQuery = query.toLowerCase();
  return cachedGroups.filter(g => 
    g.name.toLowerCase().includes(lowerQuery) ||
    g.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search roles by name (from cache)
 */
export function searchRoles(query: string): UserRole[] {
  if (!query) return cachedRoles;
  const lowerQuery = query.toLowerCase();
  return cachedRoles.filter(r => 
    r.name.toLowerCase().includes(lowerQuery) ||
    r.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all unique departments (from cache)
 */
export function getAllDepartments(): string[] {
  return [...new Set(cachedUsers.map(u => u.department))].sort();
}

/**
 * Get user display info (for UI rendering)
 */
export function getUserDisplayInfo(userId: string): { name: string; email: string; initials: string } | null {
  const user = getUserById(userId);
  if (!user) return null;
  
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  return {
    name: user.name,
    email: user.email,
    initials,
  };
}

/**
 * Get group display info (for UI rendering)
 */
export function getGroupDisplayInfo(groupId: string): { name: string; memberCount: number } | null {
  const group = getGroupById(groupId);
  if (!group) return null;
  
  return {
    name: group.name,
    memberCount: group.member_count,
  };
}

/**
 * Get role display info (for UI rendering)
 */
export function getRoleDisplayInfo(roleId: string): { name: string; description: string } | null {
  const role = getRoleById(roleId);
  if (!role) return null;
  
  return {
    name: role.name,
    description: role.description,
  };
}

// ============================================================================
// Note: Use getCachedUsers(), getCachedGroups(), getCachedRoles() instead of
// direct array exports, as the cache is populated asynchronously.
// Call ensureCacheLoaded() before accessing cache data.
// ============================================================================
