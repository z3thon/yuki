'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Check cache first
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cached = cache.getCache<T>(viewId, cacheKey);
    if (cached) {
      // Show cached data immediately
      setData(cached.data);
      setLoading(false);
      setError(null);
    } else {
      // No cache, show loading state
      setLoading(true);
    }
  }, [viewId, cacheKey, enabled, cache]);

  // Fetch fresh data in background
  useEffect(() => {
    if (!enabled) return;

    const cached = cache.getCache<T>(viewId, cacheKey);
    const hasCachedData = !!cached;

    // If we have cached data, fetch in background without showing loading
    // Otherwise, fetch normally
    if (hasCachedData) {
      setIsRefreshing(true);
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const result = await fetchFn();
        
        if (cancelled) return;

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
            cache.setCache(viewId, result, cacheKey);
            setData(result);
            setError(null);
          }
          // If invalid/empty, keep existing cached data
        } else {
          // Initial fetch - always update (even if empty) since we have no cached data
          cache.setCache(viewId, result, cacheKey);
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
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [viewId, cacheKey, enabled, fetchFn, cache]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      cache.setCache(viewId, result, cacheKey);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [viewId, cacheKey, fetchFn, cache]);

  return {
    data,
    loading,
    error,
    isRefreshing, // Indicates background refresh is happening
    refetch,
  };
}
