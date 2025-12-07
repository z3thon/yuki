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
}

/**
 * Pre-fetch data for all HR views
 * Call this when HR app is loaded (via usePrefetchHRViews hook)
 */
export async function prefetchHRViews(options: PrefetchOptions = {}) {
  const { enabled = true, delay = 500, cache } = options;
  
  if (!enabled || !cache) return;

  // Small delay to not block initial render
  await new Promise(resolve => setTimeout(resolve, delay));

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const { getAuth } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
    } catch (error) {
      // Silently fail - prefetch shouldn't break the app
      return null;
    }
    return null;
  };

  const token = await getAuthToken();
  if (!token) {
    // Not authenticated yet, skip prefetch
    return;
  }

  // Pre-fetch all HR views in parallel
  const prefetchPromises = [
    prefetchEmployees(token, cache),
    prefetchTimeTracking(token, cache),
    prefetchPunchAlterations(token, cache),
    prefetchPayPeriods(token, cache),
  ];

  // Don't await - let them run in background
  Promise.allSettled(prefetchPromises).then((results) => {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (process.env.NODE_ENV === 'development' && failed > 0) {
      console.debug(`Pre-fetched ${successful}/${results.length} HR views (${failed} failed silently)`);
    }
  });
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

