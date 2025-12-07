/**
 * Pre-fetch data for all HR views when the HR app is loaded
 * This runs in the background to improve UX when switching between views
 * 
 * Note: This function needs to be called from within a React component that has
 * access to ViewCacheContext. Use usePrefetchHRViews hook instead.
 */

interface ViewCache {
  setCache: <T>(viewId: string, data: T, cacheKey?: string) => void;
}

interface PrefetchOptions {
  enabled?: boolean;
  delay?: number; // Delay before starting prefetch (ms)
  cache?: ViewCache;
  excludeViewId?: string; // Skip prefetching this view (already loading)
}

/**
 * Pre-fetch data for all HR views (excluding the current view)
 * Call this when HR app is loaded (via usePrefetchHRViews hook)
 * 
 * Views are prefetched sequentially with delays to respect rate limits
 */
export async function prefetchHRViews(options: PrefetchOptions = {}) {
  const { enabled = true, delay = 0, cache, excludeViewId } = options;
  
  if (!enabled || !cache) return;

  // Small delay if specified
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const getAuthToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      const { getAuth } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (user) {
        // Force refresh token to ensure it's valid and not expired
        return await user.getIdToken(forceRefresh);
      }
    } catch (error) {
      // Silently fail - prefetch shouldn't break the app
      console.error('Prefetch: Error getting auth token:', error);
      return null;
    }
    return null;
  };

  // Wait a bit for auth to be fully initialized
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try to get token with force refresh to ensure it's valid
  let token = await getAuthToken(true);
  
  // If that fails, try without force refresh (might be a network issue)
  if (!token) {
    token = await getAuthToken(false);
  }
  
  if (!token) {
    // Not authenticated yet, skip prefetch
    console.warn('Prefetch: No auth token available, skipping prefetch');
    return;
  }

  // Build list of views to prefetch (excluding current view)
  const viewsToPrefetch: Array<{ name: string; fn: () => Promise<any> }> = [];
  
  if (excludeViewId !== 'employees') {
    viewsToPrefetch.push({ name: 'employees', fn: () => prefetchEmployees(token, cache) });
  }
  if (excludeViewId !== 'time-tracking') {
    viewsToPrefetch.push({ name: 'time-tracking', fn: () => prefetchTimeTracking(token, cache) });
  }
  if (excludeViewId !== 'punch-alterations') {
    viewsToPrefetch.push({ name: 'punch-alterations', fn: () => prefetchPunchAlterations(token, cache) });
  }
  if (excludeViewId !== 'pay-periods') {
    viewsToPrefetch.push({ name: 'pay-periods', fn: () => prefetchPayPeriods(token, cache) });
  }

  // Pre-fetch views sequentially with delays to respect rate limits
  // This prevents overwhelming the API and ensures current view loads first
  const prefetchSequentially = async () => {
    const results: Array<{ name: string; status: 'fulfilled' | 'rejected' }> = [];
    
    for (const view of viewsToPrefetch) {
      try {
        await view.fn();
        results.push({ name: view.name, status: 'fulfilled' });
        
        // Add delay between prefetches to respect rate limits
        // Only delay if there are more views to prefetch
        if (viewsToPrefetch.indexOf(view) < viewsToPrefetch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between requests
        }
      } catch (error) {
        results.push({ name: view.name, status: 'rejected' });
        // Continue with next view even if one fails
      }
    }
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Pre-fetched ${successful}/${results.length} HR views (${failed} failed silently)`);
    }
  };

  // Don't await - let it run in background
  prefetchSequentially();
}

async function prefetchEmployees(token: string, cache: PrefetchOptions['cache']) {
  try {
    const response = await fetch('/api/hr/employees', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Pre-populate cache with default (no search) view
      cache?.setCache('employees', { employees: data.employees || [] });
      return { employees: data.employees || [] };
    }
  } catch (error) {
    // Silently fail - prefetch shouldn't break the app
  }
}

async function prefetchTimeTracking(token: string, cache: PrefetchOptions['cache']) {
  try {
    const response = await fetch('/api/hr/punches', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Pre-populate cache with default (no filters) view
      cache?.setCache('time-tracking', { punches: data.punches || [] });
      return { punches: data.punches || [] };
    }
  } catch (error) {
    // Silently fail
  }
}

async function prefetchPunchAlterations(token: string, cache: PrefetchOptions['cache']) {
  try {
    // Pre-fetch pending alterations (most common case)
    const response = await fetch('/api/hr/alterations?status=pending', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Pre-populate cache for pending status (default filter)
      cache?.setCache('punch-alterations', { alterations: data.alterations || [] }, 'status:pending');
      return { alterations: data.alterations || [] };
    }
  } catch (error) {
    // Silently fail
  }
}

async function prefetchPayPeriods(token: string, cache: PrefetchOptions['cache']) {
  try {
    const response = await fetch('/api/hr/pay-periods', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Pre-populate cache with default (no filters) view
      cache?.setCache('pay-periods', { payPeriods: data.payPeriods || [] });
      return { payPeriods: data.payPeriods || [] };
    }
  } catch (error) {
    // Silently fail
  }
}

