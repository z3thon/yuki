'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useViewCache } from '@/components/ViewCacheContext';

interface UseViewDataCacheOptions<T> {
  viewId: string;
  cacheKey?: string; // For filtering/pagination scenarios
  fetchFn: () => Promise<T>;
  enabled?: boolean; // Whether to fetch (default: true)
}

/**
 * Hook for views to use cached data with background refresh
 * 
 * Returns cached data immediately if available, then fetches fresh data in background
 * 
 * @example
 * const { data, loading, error, refetch } = useViewDataCache({
 *   viewId: 'employees',
 *   cacheKey: search ? `search:${search}` : undefined,
 *   fetchFn: async () => {
 *     const response = await fetch(`/api/hr/employees?search=${search}`);
 *     return response.json();
 *   },
 * });
 */
export function useViewDataCache<T>({
  viewId,
  cacheKey,
  fetchFn,
  enabled = true,
}: UseViewDataCacheOptions<T>) {
  const cache = useViewCache();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use refs to store stable references to cache methods and fetchFn
  // This prevents infinite loops when cache state updates
  const fetchFnRef = useRef(fetchFn);
  const cacheRef = useRef(cache);
  const fetchingRef = useRef<string | null>(null); // Track which cacheKey is currently being fetched
  const isMountedRef = useRef(false); // Track if component has mounted
  
  useEffect(() => {
    fetchFnRef.current = fetchFn;
    cacheRef.current = cache;
  }, [fetchFn, cache]);
  
  // Track mount state - reset on viewId/cacheKey change
  useEffect(() => {
    isMountedRef.current = false;
    return () => {
      isMountedRef.current = false;
    };
  }, [viewId, cacheKey]);

  // Combined effect: check cache and fetch data
  // This ensures proper ordering and prevents race conditions
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const currentCacheKey = cacheKey || 'default';
    const fetchKey = `${viewId}:${currentCacheKey}`;
    
    // On first mount for this viewId/cacheKey, always fetch (ignore fetchingRef)
    // This ensures fresh data on page refresh
    const isFirstMount = !isMountedRef.current;
    isMountedRef.current = true;
    
    // Clear fetchingRef if this is a different fetchKey or first mount
    // This ensures we can fetch on page refresh even if ref has stale value
    if (isFirstMount || fetchingRef.current !== fetchKey) {
      fetchingRef.current = null;
    }
    
    // Check cache first
    const cached = cacheRef.current.getCache<T>(viewId, cacheKey);
    const hasCachedData = !!cached;
    
    console.log(`🔍 useViewDataCache [${viewId}:${currentCacheKey}]:`, {
      hasCachedData,
      cachedDataKeys: cached?.data && typeof cached.data === 'object' ? Object.keys(cached.data) : [],
      cachedPunchesCount: cached?.data && typeof cached.data === 'object' && 'punches' in cached.data
        ? (Array.isArray((cached.data as any).punches) ? (cached.data as any).punches.length : 'not array')
        : 'no punches',
    });
    
    if (hasCachedData) {
      // Show cached data immediately
      console.log(`✅ useViewDataCache: Using cached data for ${viewId}:${currentCacheKey}`);
      setData(cached.data);
      setLoading(false);
      setError(null);
    } else {
      // No cache, show loading state
      console.log(`⏳ useViewDataCache: No cache, showing loading state for ${viewId}:${currentCacheKey}`);
      setLoading(true);
    }
    
    // Prevent duplicate fetches for the same cacheKey
    // But always allow fetch on first mount to handle page refresh
    if (!isFirstMount && fetchingRef.current === fetchKey) {
      return;
    }

    // If we have cached data, fetch in background without showing loading
    // Otherwise, fetch normally (loading already set above)
    if (hasCachedData) {
      setIsRefreshing(true);
    }

    // Mark that we're fetching this cacheKey
    fetchingRef.current = fetchKey;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const result = await fetchFnRef.current();
        
        if (cancelled) return;

        console.log(`🔍 useViewDataCache: Got result from fetchFn:`, {
          resultType: typeof result,
          isArray: Array.isArray(result),
          resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
          hasPunches: result && typeof result === 'object' && 'punches' in result,
          punchesCount: result && typeof result === 'object' && 'punches' in result 
            ? (Array.isArray((result as any).punches) ? (result as any).punches.length : 'not array')
            : 'no punches',
          hasCachedData,
        });

        // For background refreshes with cached data, only update if we get valid new data
        // This prevents clearing existing data if API returns empty/error during background refresh
        if (hasCachedData) {
          // Background refresh - check if result has meaningful data
          let isValidUpdate = false;
          
          if (result === null || result === undefined) {
            isValidUpdate = false;
            console.log(`🔍 useViewDataCache: Result is null/undefined, isValidUpdate = false`);
          } else if (Array.isArray(result)) {
            isValidUpdate = result.length > 0;
            console.log(`🔍 useViewDataCache: Result is array with ${result.length} items, isValidUpdate = ${isValidUpdate}`);
          } else if (typeof result === 'object') {
            // Check if object has any non-empty array properties or meaningful data
            const keys = Object.keys(result);
            isValidUpdate = keys.some(key => {
              const value = (result as any)[key];
              if (Array.isArray(value)) {
                const hasItems = value.length > 0;
                console.log(`🔍 useViewDataCache: Key "${key}" is array with ${value.length} items, contributes ${hasItems} to isValidUpdate`);
                return hasItems;
              }
              const hasValue = value !== null && value !== undefined;
              console.log(`🔍 useViewDataCache: Key "${key}" is ${typeof value}, contributes ${hasValue} to isValidUpdate`);
              return hasValue;
            });
            console.log(`🔍 useViewDataCache: Object result, isValidUpdate = ${isValidUpdate}`);
          } else {
            // Primitive values - always valid
            isValidUpdate = true;
            console.log(`🔍 useViewDataCache: Result is primitive, isValidUpdate = true`);
          }
          
          if (isValidUpdate) {
            console.log(`✅ useViewDataCache: Updating cache and data (background refresh)`);
            console.log(`✅ useViewDataCache: Setting data to:`, {
              resultType: typeof result,
              resultKeys: Object.keys(result || {}),
              punchesCount: result && typeof result === 'object' && 'punches' in result
                ? (Array.isArray((result as any).punches) ? (result as any).punches.length : 'not array')
                : 'no punches',
            });
            cacheRef.current.setCache(viewId, result, cacheKey);
            setData(result);
            setError(null);
          } else {
            console.log(`⚠️ useViewDataCache: Result invalid, keeping cached data`);
            console.log(`⚠️ useViewDataCache: Cached data:`, {
              cachedKeys: cached?.data && typeof cached.data === 'object' ? Object.keys(cached.data) : [],
            });
          }
          // If invalid/empty, keep existing cached data
        } else {
          // Initial fetch - always update (even if empty) since we have no cached data
          console.log(`✅ useViewDataCache: Initial fetch, updating cache and data`);
          cacheRef.current.setCache(viewId, result, cacheKey);
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        if (cancelled) return;
        
        // Only set error if we don't have cached data to show
        if (!hasCachedData) {
          setError(err.message || 'Failed to fetch data');
        } else {
          // If we have cached data, log error but don't show it or clear data
          console.error('Background fetch error:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsRefreshing(false);
          // Clear the fetching flag only if this is still the current cacheKey
          if (fetchingRef.current === fetchKey) {
            fetchingRef.current = null;
          }
        }
      }
    };

    // Always fetch on mount/change, even if we have cached data
    // This ensures fresh data on page refresh
    fetchData();

    return () => {
      cancelled = true;
      // Clear fetching flag if this effect is cleaning up
      if (fetchingRef.current === fetchKey) {
        fetchingRef.current = null;
      }
    };
  }, [viewId, cacheKey, enabled]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      cacheRef.current.setCache(viewId, result, cacheKey);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [viewId, cacheKey]);

  return {
    data,
    loading,
    error,
    isRefreshing, // Indicates background refresh is happening
    refetch,
  };
}
