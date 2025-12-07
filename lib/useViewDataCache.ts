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
  
  // Use a ref to store the latest fetchFn so we don't re-run the effect when it changes
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);
  
  // Use a ref to store the cache object so we don't re-run effects when it changes
  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);
  
  // Track if a fetch is in progress for this specific cache key to prevent duplicate fetches
  const fetchingRef = useRef<string | null>(null);

  // Check cache first
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.getCache<T>(viewId, cacheKey);
    if (cached) {
      // Show cached data immediately
      console.log(`📦 useViewDataCache: Loading cached data for ${viewId}, cacheKey="${cacheKey}"`);
      setData(cached.data);
      setLoading(false);
      setError(null);
    } else {
      // No cache, show loading state
      console.log(`⏳ useViewDataCache: No cache for ${viewId}, cacheKey="${cacheKey}" - will fetch`);
      setLoading(true);
    }
  }, [viewId, cacheKey, enabled]); // Removed cache from deps - using ref instead

  // Fetch fresh data in background
  useEffect(() => {
    if (!enabled) return;

    // Create a unique key for this fetch to prevent duplicates
    const fetchKey = `${viewId}:${cacheKey || 'default'}`;
    
    // If we're already fetching this exact cache key, don't start another fetch
    if (fetchingRef.current === fetchKey) {
      console.log(`⏸️ useViewDataCache: Already fetching ${fetchKey}, skipping duplicate`);
      return;
    }

    const cached = cacheRef.current.getCache<T>(viewId, cacheKey);
    const hasCachedData = !!cached;
    
    // If we have cached data that's less than 30 seconds old, skip the fetch
    // BUT make sure the data is set in state first
    if (hasCachedData && cached.timestamp && (Date.now() - cached.timestamp < 30000)) {
      console.log(`✅ useViewDataCache: Using fresh cached data for ${viewId} (${Date.now() - cached.timestamp}ms old)`);
      // Ensure data is set in state even if we skip the fetch
      setData(cached.data);
      setLoading(false);
      setError(null);
      setIsRefreshing(false);
      return;
    }

    // If we have cached data, fetch in background without showing loading
    // Otherwise, fetch normally
    if (hasCachedData) {
      setIsRefreshing(true);
    }

    // Mark that we're fetching this key
    fetchingRef.current = fetchKey;
    let cancelled = false;

    const fetchData = async () => {
      console.log(`🔵 useViewDataCache: Starting fetch for viewId="${viewId}", cacheKey="${cacheKey}"`);
      const fetchStartTime = Date.now();
      try {
        console.log(`🔵 useViewDataCache: Calling fetchFn for ${viewId}...`);
        // Use the ref to always call the latest fetchFn without re-running the effect
        const result = await fetchFnRef.current();
        console.log(`✅ useViewDataCache: fetchFn completed for ${viewId} in ${Date.now() - fetchStartTime}ms`);
        console.log(`   Result:`, result);
        
        // Check if this specific fetch was cancelled
        // Only cancel if:
        // 1. cancelled flag is true AND
        // 2. A different fetch has started (fetchingRef.current is set to a different key)
        // If fetchingRef.current is null, that just means cleanup ran, but we should still update state
        if (cancelled && fetchingRef.current !== null && fetchingRef.current !== fetchKey) {
          console.log(`⏭️ useViewDataCache: Fetch cancelled for ${viewId} (new fetch started: ${fetchingRef.current})`);
          return;
        }
        
        // If cancelled but no new fetch started (ref is null or same), proceed anyway
        if (cancelled) {
          console.log(`⚠️ useViewDataCache: Fetch was marked cancelled for ${viewId} but no new fetch started, proceeding anyway`);
        }

        // For background refreshes with cached data, only update if we get valid new data
        // This prevents clearing existing data if API returns empty/error during background refresh
        if (hasCachedData) {
          // Background refresh - check if result has meaningful data
          let isValidUpdate = false;
          
          if (result === null || result === undefined) {
            isValidUpdate = false;
          } else if (Array.isArray(result)) {
            isValidUpdate = result.length > 0;
          } else if (typeof result === 'object') {
            // Check if object has any non-empty array properties or meaningful data
            const keys = Object.keys(result);
            isValidUpdate = keys.some(key => {
              const value = (result as any)[key];
              if (Array.isArray(value)) {
                return value.length > 0;
              }
              return value !== null && value !== undefined;
            });
          } else {
            // Primitive values - always valid
            isValidUpdate = true;
          }
          
          if (isValidUpdate) {
            console.log(`✅ useViewDataCache: Updating ${viewId} with fresh data (background refresh)`);
            cacheRef.current.setCache(viewId, result, cacheKey);
            setData(result);
            setError(null);
          } else {
            console.log(`⚠️ useViewDataCache: Background refresh for ${viewId} returned invalid/empty data, keeping cached data`);
          }
          // If invalid/empty, keep existing cached data
        } else {
          // Initial fetch - always update (even if empty) since we have no cached data
          console.log(`✅ useViewDataCache: Setting initial data for ${viewId}`);
          cacheRef.current.setCache(viewId, result, cacheKey);
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        console.error(`🔴 useViewDataCache: Error fetching ${viewId}:`, err);
        console.error(`   Error message:`, err?.message);
        console.error(`   Error stack:`, err?.stack);
        
        if (cancelled) {
          console.log(`⏭️ useViewDataCache: Error occurred but fetch was cancelled for ${viewId}`);
          return;
        }
        
        // Only set error if we don't have cached data to show
        if (!hasCachedData) {
          setError(err.message || 'Failed to fetch data');
        } else {
          // If we have cached data, log error but don't show it or clear data
          console.error('Background fetch error:', err);
        }
      } finally {
        // Clear the fetching flag
        if (fetchingRef.current === fetchKey) {
          fetchingRef.current = null;
        }
        if (!cancelled) {
          setLoading(false);
          setIsRefreshing(false);
          console.log(`✅ useViewDataCache: Loading complete for ${viewId}`);
        }
      }
    };

    fetchData();

    return () => {
      // Only cancel if this is still the current fetch
      if (fetchingRef.current === fetchKey) {
        cancelled = true;
        fetchingRef.current = null;
        console.log(`🛑 useViewDataCache: Cleanup cancelling fetch for ${fetchKey}`);
      } else {
        console.log(`⏭️ useViewDataCache: Cleanup skipping (different fetch in progress: ${fetchingRef.current})`);
      }
    };
  }, [viewId, cacheKey, enabled]); // Removed cache and fetchFn from deps - using refs instead

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the ref to always call the latest fetchFn
      const result = await fetchFnRef.current();
      cacheRef.current.setCache(viewId, result, cacheKey);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [viewId, cacheKey]); // Removed cache and fetchFn from deps - using refs instead

  return {
    data,
    loading,
    error,
    isRefreshing, // Indicates background refresh is happening
    refetch,
  };
}
