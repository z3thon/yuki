# Cache Security Documentation

## Overview

The permission system uses an in-memory cache in Vercel functions to improve performance. This document explains the security guarantees and how cache isolation is ensured.

## Security Guarantees

### 1. Server-Side Only
- **Cache Location**: Vercel function memory (server-side)
- **User Access**: Users cannot directly access the cache
- **Client Exposure**: Cache is never exposed to the client

### 2. User ID Validation
- **Source**: userId comes from verified Firebase Auth token (server-side only)
- **Validation**: All API routes verify Firebase token before accessing cache
- **Format Check**: userId format is validated (Firebase UIDs are 28 alphanumeric chars)
- **Injection Prevention**: Cache keys cannot be manipulated by users

### 3. Cache Key Isolation
- **Key Format**: `permissions:${userId}`
- **Scoping**: Each user has isolated cache entries
- **Collision Prevention**: userId stored in cache entry for double-checking
- **Access Control**: No way for User A to access User B's cache entry

### 4. Function Instance Isolation
- **Vercel Isolation**: Each function instance is isolated per request/region
- **No Shared State**: Cache is per-instance, not shared across instances
- **Cold Starts**: On cold start, cache is empty (fresh from Fillout)

### 5. Cache Expiration
- **TTL**: 5 minutes
- **Stale Prevention**: Reduces risk of stale permissions
- **Automatic Cleanup**: Expired entries are cleared

## Implementation Details

### Cache Structure

```typescript
const permissionCache = new Map<string, {
  permissions: UserPermission[];
  expiresAt: number;
  userId: string; // Stored for validation
}>();
```

### Security Checks

1. **userId Format Validation**
   ```typescript
   if (!userId || typeof userId !== 'string' || !/^[a-zA-Z0-9]{28}$/.test(userId)) {
     return []; // Invalid userId = no permissions
   }
   ```

2. **Cache Entry Validation**
   ```typescript
   if (cached && cached.expiresAt > Date.now() && cached.userId === userId) {
     return cached.permissions; // Only return if userId matches
   }
   ```

3. **API Route Validation**
   ```typescript
   // userId always comes from verified Firebase token
   const userId = await verifyAuthAndGetUserId(request);
   if (!userId) return 401; // Unauthorized
   ```

## Attack Vectors & Mitigations

### Attack: User tries to access another user's cache

**Mitigation**:
- Cache keys are scoped to userId
- userId comes from verified Firebase token (cannot be spoofed)
- Cache entry stores userId for double-checking
- No API endpoint accepts userId from client body (always from token)

### Attack: Cache key injection

**Mitigation**:
- userId format is validated (Firebase UID format)
- Invalid userId returns empty permissions
- Cache keys are constructed server-side only

### Attack: Stale permissions after update

**Mitigation**:
- Cache expires after 5 minutes
- `clearPermissionCache()` function clears cache on permission updates
- Worst case: User waits 5 minutes for updated permissions

### Attack: Cross-instance cache access

**Mitigation**:
- Vercel function instances are isolated
- Cache is per-instance, not shared
- Each instance has its own memory space

## Best Practices

### ✅ DO

1. **Always verify auth before cache access**
   ```typescript
   const userId = await verifyAuthAndGetUserId(request);
   if (!userId) return 401;
   ```

2. **Use verified userId from token**
   ```typescript
   // ✅ Good - userId from verified token
   const userId = await verifyAuthAndGetUserId(request);
   
   // ❌ Bad - userId from request body (can be spoofed)
   const userId = request.body.userId;
   ```

3. **Clear cache on permission updates**
   ```typescript
   await updatePermission(userId, permission);
   clearPermissionCache(userId); // Clear cache
   ```

### ❌ DON'T

1. **Don't accept userId from client**
   ```typescript
   // ❌ Bad - userId can be spoofed
   const userId = request.body.userId;
   
   // ✅ Good - userId from verified token
   const userId = await verifyAuthAndGetUserId(request);
   ```

2. **Don't skip userId validation**
   ```typescript
   // ❌ Bad - no validation
   const cacheKey = `permissions:${userId}`;
   
   // ✅ Good - validate format
   if (!/^[a-zA-Z0-9]{28}$/.test(userId)) return [];
   ```

3. **Don't share cache between users**
   ```typescript
   // ❌ Bad - shared cache key
   const cacheKey = 'permissions';
   
   // ✅ Good - user-specific cache key
   const cacheKey = `permissions:${userId}`;
   ```

## Production Considerations

### Current Implementation (Development)
- In-memory cache per function instance
- Fast for single-instance usage
- Cleared on cold start

### Production Scale (Future)
For high-traffic production, consider:
- **Vercel KV**: Shared cache across instances
- **Redis**: External cache with TTL
- **Cache Invalidation**: Webhook or pub/sub for real-time updates

### Migration Path
```typescript
// Current: In-memory
const cached = permissionCache.get(cacheKey);

// Future: Vercel KV
const cached = await kv.get(cacheKey);
```

## Monitoring

### Metrics to Track
1. **Cache Hit Rate**: Percentage of requests served from cache
2. **Cache Miss Rate**: Percentage of requests fetching from Fillout
3. **Average Cache Age**: How old cached permissions are
4. **Permission Check Latency**: Time to check permissions

### Alerts
- Cache hit rate drops below threshold
- Permission check latency increases
- Unusual permission denial patterns

## Conclusion

The in-memory cache is secure because:
1. ✅ Server-side only (users cannot access)
2. ✅ userId validated via Firebase Auth (cannot be spoofed)
3. ✅ Cache keys scoped to userId (isolated per user)
4. ✅ Function instances isolated (no cross-user access)
5. ✅ Cache expires (reduces stale data risk)

The cache significantly improves performance while maintaining security guarantees.

---

**Last Updated**: January 2025
**Security Review**: ✅ Approved

