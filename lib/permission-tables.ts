import { queryFillout, createFilloutRecord, updateFilloutRecord, deleteFilloutRecord } from './fillout';
import { UserPermission, UserAppAccess, View, AppId } from '@/types';
import { getTableId } from './fillout-config.generated';

// Table IDs - loaded from generated config file (optimized, no API calls needed)
const USER_APP_ACCESS_TABLE_ID = getTableId('User App Access');
const USER_PERMISSIONS_TABLE_ID = getTableId('User Permissions');
const VIEWS_TABLE_ID = getTableId('Views');

/**
 * Initialize table IDs by finding tables by name
 * @deprecated Table IDs are now loaded from config file automatically
 * This function is kept for backward compatibility but does nothing
 */
export async function initializePermissionTableIds() {
  return {
    userAppAccess: USER_APP_ACCESS_TABLE_ID,
    userPermissions: USER_PERMISSIONS_TABLE_ID,
    views: VIEWS_TABLE_ID,
  };
}

/**
 * Set table IDs manually
 * @deprecated Table IDs are now loaded from config file automatically
 * This function is kept for backward compatibility but does nothing
 */
export function setPermissionTableIds(ids: {
  userAppAccess?: string;
  userPermissions?: string;
  views?: string;
}) {
  // No-op: IDs are now loaded from config file
}

// ============================================
// User App Access Table Operations
// ============================================

export async function getUserAppAccess(userId: string): Promise<UserAppAccess[]> {
  if (!USER_APP_ACCESS_TABLE_ID) {
    await initializePermissionTableIds();
  }
  
  if (!USER_APP_ACCESS_TABLE_ID) {
    console.warn('User App Access table not found');
    return [];
  }

  const response = await queryFillout({
    tableId: USER_APP_ACCESS_TABLE_ID,
    filters: {
      user_id: { eq: userId },
    },
  });

  return response.records.map((record: any) => ({
    userId: record.fields.user_id,
    employeeId: Array.isArray(record.fields.employee_id) 
      ? record.fields.employee_id[0] 
      : record.fields.employee_id || undefined,
    appId: record.fields.app_id as AppId,
    grantedAt: new Date(record.fields.granted_at),
  }));
}

export async function grantAppAccess(
  userId: string, 
  appId: AppId, 
  employeeId?: string
): Promise<void> {
  if (!USER_APP_ACCESS_TABLE_ID) {
    throw new Error('User App Access table not found in config. Run: npx tsx scripts/generate-fillout-config.ts');
  }

  // Check if access already exists
  const existing = await getUserAppAccess(userId);
  if (existing.some(a => a.appId === appId)) {
    return; // Already granted
  }

  const fields: Record<string, any> = {
    user_id: userId,
    app_id: appId,
    granted_at: new Date().toISOString(),
  };

  // Add employee_id if provided (as array for linked_record)
  if (employeeId) {
    fields.employee_id = [employeeId];
  }

  await createFilloutRecord(USER_APP_ACCESS_TABLE_ID, fields);
}

export async function revokeAppAccess(userId: string, appId: AppId): Promise<void> {
  if (!USER_APP_ACCESS_TABLE_ID) {
    await initializePermissionTableIds();
  }
  
  if (!USER_APP_ACCESS_TABLE_ID) {
    throw new Error('User App Access table not found');
  }

  const access = await getUserAppAccess(userId);
  const record = access.find(a => a.appId === appId);
  
  if (record) {
    // Note: We need the record ID to delete - this is a limitation
    // For now, we'll need to query and get the record ID
    const response = await queryFillout({
      tableId: USER_APP_ACCESS_TABLE_ID,
      filters: {
        user_id: { eq: userId },
        app_id: { eq: appId },
      },
      limit: 1,
    });

    if (response.records.length > 0) {
      await deleteFilloutRecord(USER_APP_ACCESS_TABLE_ID, response.records[0].id);
    }
  }
}

// ============================================
// User Permissions Table Operations
// ============================================

export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  if (!USER_PERMISSIONS_TABLE_ID) {
    console.warn('User Permissions table not found in config. Run: npx tsx scripts/generate-fillout-config.ts');
    return [];
  }

  const response = await queryFillout({
    tableId: USER_PERMISSIONS_TABLE_ID,
    filters: {
      user_id: { eq: userId },
    },
  });

  return response.records.map((record: any) => ({
    userId: record.fields.user_id,
    employeeId: Array.isArray(record.fields.employee_id) 
      ? record.fields.employee_id[0] 
      : record.fields.employee_id || undefined,
    appId: record.fields.app_id as AppId,
    viewId: record.fields.view_id || undefined,
    resourceType: record.fields.resource_type || undefined,
    resourceId: record.fields.resource_id || undefined,
    actions: Array.isArray(record.fields.actions) 
      ? record.fields.actions.filter((a: any) => a !== null && a !== undefined) // Filter out null values
      : (record.fields.actions ? [record.fields.actions] : []),
  }));
}

export async function createUserPermission(permission: UserPermission): Promise<void> {
  if (!USER_PERMISSIONS_TABLE_ID) {
    throw new Error('User Permissions table not found in config. Run: npx tsx scripts/generate-fillout-config.ts');
  }

  const fields: Record<string, any> = {
    user_id: permission.userId,
    app_id: permission.appId,
    view_id: permission.viewId || null,
    resource_type: permission.resourceType || null,
    resource_id: permission.resourceId || null,
    actions: permission.actions,
  };

  // Add employee_id if provided (as array for linked_record)
  if (permission.employeeId) {
    fields.employee_id = [permission.employeeId];
  }

  await createFilloutRecord(USER_PERMISSIONS_TABLE_ID, fields);
}

// ============================================
// Views Table Operations
// ============================================

export async function getViews(appId?: AppId, userId?: string): Promise<View[]> {
  if (!VIEWS_TABLE_ID) {
    console.warn('Views table not found in config. Run: npx tsx scripts/generate-fillout-config.ts');
    return [];
  }

  const filters: Record<string, any> = {};
  if (appId) {
    filters.app_id = { eq: appId };
  }

  const response = await queryFillout({
    tableId: VIEWS_TABLE_ID,
    filters,
  });

  let views = response.records.map((record: any) => {
    const config = typeof record.fields.config === 'string' 
      ? JSON.parse(record.fields.config) 
      : record.fields.config;

    return {
      id: record.id,
      appId: record.fields.app_id as AppId,
      name: record.fields.name,
      description: record.fields.description || undefined,
      isDefault: record.fields.is_default === true,
      isCustom: record.fields.is_custom === true,
      createdBy: record.fields.created_by || undefined,
      employeeId: Array.isArray(record.fields.employee_id) 
        ? record.fields.employee_id[0] 
        : record.fields.employee_id || undefined,
      sharedWith: Array.isArray(record.fields.shared_with)
        ? record.fields.shared_with
        : (record.fields.shared_with ? [record.fields.shared_with] : []),
      config,
      createdAt: new Date(record.fields.created_at || record.createdTime),
      updatedAt: new Date(record.fields.updated_at || record.createdTime),
    };
  });

  // Filter by user access if userId provided
  if (userId) {
    views = views.filter(view => 
      view.isDefault || 
      view.createdBy === userId || 
      (view.sharedWith && view.sharedWith.includes(userId))
    );
  }

  return views;
}

export async function createView(view: Omit<View, 'id' | 'createdAt' | 'updatedAt'>): Promise<View> {
  if (!VIEWS_TABLE_ID) {
    await initializePermissionTableIds();
  }
  
  if (!VIEWS_TABLE_ID) {
    throw new Error('Views table not found');
  }

  const now = new Date().toISOString();
  const fields: Record<string, any> = {
    app_id: view.appId,
    name: view.name,
    description: view.description || null,
    is_default: view.isDefault,
    is_custom: view.isCustom,
    created_by: view.createdBy || null,
    shared_with: view.sharedWith || [],
    config: JSON.stringify(view.config),
    created_at: now,
    updated_at: now,
  };

  // Add employee_id if provided (as array for linked_record)
  if (view.employeeId) {
    fields.employee_id = [view.employeeId];
  }

  const record = await createFilloutRecord(VIEWS_TABLE_ID, fields);

  return {
    id: record.id,
    ...view,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export async function updateView(viewId: string, updates: Partial<View>): Promise<void> {
  if (!VIEWS_TABLE_ID) {
    throw new Error('Views table not found in config. Run: npx tsx scripts/generate-fillout-config.ts');
  }

  const fields: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.description !== undefined) fields.description = updates.description;
  if (updates.isDefault !== undefined) fields.is_default = updates.isDefault;
  if (updates.isCustom !== undefined) fields.is_custom = updates.isCustom;
  if (updates.sharedWith !== undefined) fields.shared_with = updates.sharedWith;
  if (updates.employeeId !== undefined) {
    fields.employee_id = updates.employeeId ? [updates.employeeId] : null;
  }
  if (updates.config !== undefined) fields.config = JSON.stringify(updates.config);

  await updateFilloutRecord(VIEWS_TABLE_ID, viewId, fields);
}

