// src/types/permissions.ts
export type Permission = 
  | 'read:users'
  | 'write:users'
  | 'read:projects'
  | 'write:projects'
  | 'manage:organization'
  | 'manage:settings'
  | 'manage:departments';

export interface Role {
  name: string;
  permissions: Permission[];
  description?: string;
}

export const ROLES: Record<string, Role> = {
  ADMIN: {
    name: 'Admin',
    permissions: ['read:users', 'write:users', 'manage:organization', 'manage:settings'],
    description: 'Full access to all features'
  },
  USER: {
    name: 'User',
    permissions: ['read:users', 'read:projects'],
    description: 'Basic user access'
  },
  // Add more roles as needed
};