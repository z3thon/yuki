// App Types
export type AppId = 'hr' | 'crm' | 'billing';

export interface App {
  id: AppId;
  name: string;
  description: string;
  color: string;
  icon: string;
  available: boolean;
}

// Permission Types
export type PermissionAction = 'read' | 'write' | 'delete' | 'approve';

export interface UserPermission {
  userId: string; // Firebase UID (for authentication)
  employeeId?: string; // Employee record ID (linked_record to Employees table)
  appId: AppId;
  viewId?: string; // Optional - if undefined, applies to all views in app
  resourceType?: string; // e.g., 'employee', 'punch', 'invoice'
  resourceId?: string; // Optional - if undefined, applies to all resources of type
  actions: PermissionAction[];
}

export interface UserAppAccess {
  userId: string; // Firebase UID (for authentication)
  employeeId?: string; // Employee record ID (linked_record to Employees table)
  appId: AppId;
  grantedAt: Date;
}

// View/Dashboard Types
export interface View {
  id: string;
  appId: AppId;
  name: string;
  description?: string;
  isDefault: boolean;
  isCustom: boolean;
  createdBy?: string; // Firebase UID
  employeeId?: string; // Employee record ID (linked_record to Employees table)
  sharedWith?: string[];
  config: ViewConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewConfig {
  type: 'table' | 'dashboard' | 'form' | 'chart';
  query?: string; // Fillout query or custom query
  filters?: Record<string, any>;
  columns?: string[];
  chartType?: 'bar' | 'line' | 'pie' | 'area';
}

// Fillout Types
export interface FilloutRecord {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
}

export interface FilloutResponse {
  records: FilloutRecord[];
  offset?: string;
  hasMore?: boolean;
}

// User Types
export interface User {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  isAdmin?: boolean;
}

