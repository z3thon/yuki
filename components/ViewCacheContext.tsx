'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  viewId: string;
  cacheKey?: string; // For filtering/pagination scenarios
}

interface ViewCacheContextType {
  getCache: <T>(viewId: string, cacheKey?: string) => CacheEntry<T> | null;
  setCache: <T>(viewId: string, data: T, cacheKey?: string) => void;
  clearCache: (viewId?: string) => void;
  hasCache: (viewId: string, cacheKey?: string) => boolean;
}

const ViewCacheContext = createContext<ViewCacheContextType | null>(null);

export function ViewCacheProvider({ children }: { children: ReactNode }) {
  // Store cache entries by viewId and optional cacheKey
  // Format: { [viewId]: { [cacheKey || 'default']: CacheEntry } }
  const [cache, setCacheState] = useState<Record<string, Record<string, CacheEntry>>>({});

  const getCache = useCallback(<T,>(viewId: string, cacheKey?: string): CacheEntry<T> | null => {
    const key = cacheKey || 'default';
    const viewCache = cache[viewId];
    if (!viewCache) return null;
    
    const entry = viewCache[key];
    if (!entry) return null;
    
    return entry as CacheEntry<T>;
  }, [cache]);

  const setCache = useCallback(<T,>(viewId: string, data: T, cacheKey?: string): void => {
    const key = cacheKey || 'default';
    setCacheState((prev) => ({
      ...prev,
      [viewId]: {
        ...prev[viewId],
        [key]: {
          data,
          timestamp: Date.now(),
          viewId,
          cacheKey: key,
        },
      },
    }));
  }, []);

  const clearCache = useCallback((viewId?: string): void => {
    if (viewId) {
      setCacheState((prev) => {
        const next = { ...prev };
        delete next[viewId];
        return next;
      });
    } else {
      setCacheState({});
    }
  }, []);

  const hasCache = useCallback((viewId: string, cacheKey?: string): boolean => {
    const key = cacheKey || 'default';
    return !!cache[viewId]?.[key];
  }, [cache]);

  return (
    <ViewCacheContext.Provider value={{ getCache, setCache, clearCache, hasCache }}>
      {children}
    </ViewCacheContext.Provider>
  );
}

export function useViewCache() {
  const context = useContext(ViewCacheContext);
  if (!context) {
    throw new Error('useViewCache must be used within ViewCacheProvider');
  }
  return context;
}
