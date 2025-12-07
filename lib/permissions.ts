import { UserPermission, PermissionAction, AppId } from '@/types';

/**
 * SECURITY: In-memory permission cache
 * 
 * Security Guarantees:
 * 1. Cache is server-side only (Vercel function memory) - users cannot access it directly
 * 2. Cache keys are scoped to userId - each user has isolated cache entries
 * 3. userId is always validated via Firebase Auth before cache access (enforced in API routes)
 * 4. Cache is per-function-instance - Vercel isolates function instances, no cross-user access
 * 5. Cache expires after 5 minutes - reduces risk of stale permissions
 * 
 * Cache Isolation:
 * - Each cache entry key: `permissions:${userId}`
 * - userId comes from verified Firebase Auth token (server-side only)
 * - No way for User A to access User B's cache entry
 * - Vercel function instances are isolated per request/region
 * 
 * Note: On cold starts, cache is empty (fresh from Fillout)
 * For production scale, consider Vercel KV for shared cache across instances
 */
const permissionCache = new Map<string, { permissions: UserPermission[]; expiresAt: number; userId: string }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface PermissionCheck {
  userId: string;
  appId: AppId;
  viewId?: string;
  resourceType?: string;
  resourceId?: string;
  action: PermissionAction;
}

/**
 * Check if user has permission for a specific action
 * This should be called from Vercel functions after verifying auth
 */
export async function checkPermission(check: PermissionCheck): Promise<boolean> {
  try {
    const { userId, appId, viewId, resourceType, resourceId, action } = check;
    
    // Validate inputs
    if (!userId || !appId || !action) {
      console.error('Invalid permission check parameters:', { userId, appId, action });
      return false;
    }
    
    // Get user permissions (from cache or Fillout)
    const permissions = await getUserPermissions(userId);
    
    // Filter permissions for this app
    const appPermissions = permissions.filter(p => p.appId === appId);
  
    // Check for exact match first (most specific)
    const exactMatch = appPermissions.find(p => 
      p.viewId === viewId &&
      p.resourceType === resourceType &&
      p.resourceId === resourceId &&
      (p.actions.length === 0 || p.actions.includes(action)) // If actions array is empty/null, grant access
    );
    
    if (exactMatch) return true;
    
    // Check for view-level permission (viewId matches, no resourceType specified in permission)
    if (viewId) {
      const viewMatch = appPermissions.find(p => 
        p.viewId === viewId &&
        !p.resourceType && // Permission doesn't specify resourceType (applies to all resources in view)
        !p.resourceId &&
        (p.actions.length === 0 || p.actions.includes(action)) // If actions array is empty/null, grant access (workaround for unconfigured field)
      );
      if (viewMatch) return true;
    }
    
    // Check for resource-level permission (resourceType matches, no viewId specified)
    if (resourceType) {
      const resourceMatch = appPermissions.find(p => 
        !p.viewId &&
        p.resourceType === resourceType &&
        !p.resourceId &&
        (p.actions.length === 0 || p.actions.includes(action)) // If actions array is empty/null, grant access
      );
      if (resourceMatch) return true;
    }
    
    // Check for app-level permission (no view/resource specified)
    const appMatch = appPermissions.find(p => 
      !p.viewId &&
      !p.resourceType &&
      (p.actions.length === 0 || p.actions.includes(action)) // If actions array is empty/null, grant access
    );
    
    return !!appMatch;
  } catch (error: any) {
    console.error('Error in checkPermission:', error);
    console.error('Permission check parameters:', check);
    // Fail-safe: return false on error (no permissions)
    return false;
  }
}

/**
 * Get all permissions for a user (with caching)
 * 
 * SECURITY: userId must be validated via Firebase Auth before calling this function
 * This function assumes userId is already verified server-side (in API route)
 * 
 * @param userId - Firebase UID (must be verified via Firebase Auth token)
 */
async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  // SECURITY: Validate userId format (Firebase UIDs are alphanumeric, typically 28 chars but can vary)
  // This prevents injection attacks via cache key manipulation
  // Relaxed validation: userId is already verified via Firebase Auth, so we just need basic validation
  if (!userId || typeof userId !== 'string' || userId.length < 20 || userId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    console.error('Invalid userId format in getUserPermissions:', userId);
    return []; // Return no permissions for invalid userId
  }
  
  const cacheKey = `permissions:${userId}`;
  const cached = permissionCache.get(cacheKey);
  
  // SECURITY: Double-check cached userId matches requested userId
  // This prevents cache key collisions (theoretical, but defense in depth)
  if (cached && cached.expiresAt > Date.now() && cached.userId === userId) {
    return cached.permissions;
  }
  
  // Fetch from Fillout
  const permissions = await fetchUserPermissionsFromFillout(userId);
  
  // Cache for 5 minutes with userId stored for validation
  permissionCache.set(cacheKey, {
    permissions,
    expiresAt: Date.now() + CACHE_TTL,
    userId, // Store userId in cache entry for validation
  });
  
  return permissions;
}

/**
 * Fetch user permissions from Fillout User Permissions table
 */
async function fetchUserPermissionsFromFillout(userId: string): Promise<UserPermission[]> {
  try {
    const { getUserPermissions } = await import('./permission-tables');
    return await getUserPermissions(userId);
  } catch (error) {
    console.error('Error fetching permissions from Fillout:', error);
    // Return empty array on error (fail-safe - no permissions)
    return [];
  }
}

/**
 * Clear permission cache for a user (call after permission updates)
 * 
 * SECURITY: userId must be validated before calling this function
 * 
 * @param userId - Firebase UID (must be verified)
 */
export function clearPermissionCache(userId: string): void {
  // SECURITY: Validate userId format (relaxed validation since userId is already verified)
  if (!userId || typeof userId !== 'string' || userId.length < 20 || userId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    console.error('Invalid userId format in clearPermissionCache:', userId);
    return;
  }
  
  const cacheKey = `permissions:${userId}`;
  const cached = permissionCache.get(cacheKey);
  
  // SECURITY: Only clear if userId matches (defense in depth)
  if (cached && cached.userId === userId) {
    permissionCache.delete(cacheKey);
  }
}

/**
 * Clear all expired cache entries (cleanup function)
 * Call periodically to prevent memory leaks
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of permissionCache.entries()) {
    if (entry.expiresAt <= now) {
      permissionCache.delete(key);
    }
  }
}

/**
 * Check if user has access to an app
 * This checks the User App Access table directly (not permissions)
 */
export async function hasAppAccess(userId: string, appId: AppId): Promise<boolean> {
  try {
    const { getUserAppAccess } = await import('./permission-tables');
    const access = await getUserAppAccess(userId);
    return access.some(a => a.appId === appId);
  } catch (error) {
    console.error('Error checking app access:', error);
    return false;
  }
}

