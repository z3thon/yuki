'use client';

import { useEffect, useRef } from 'react';
import { useViewCache } from '@/components/ViewCacheContext';
import { prefetchHRViews } from './prefetch-hr-views';
import { AppId } from '@/types';

/**
 * Hook to pre-fetch HR view data when HR app is loaded
 * Usage: usePrefetchHRViews(currentApp, APPS[currentApp].available)
 */
export function usePrefetchHRViews(appId: AppId, enabled: boolean = true) {
  const cache = useViewCache();
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    // Only prefetch for HR app and only once per session
    if (appId === 'hr' && enabled && !hasPrefetchedRef.current) {
      hasPrefetchedRef.current = true;
      
      // Start prefetching in background with cache access
      prefetchHRViews({ 
        enabled: true, 
        delay: 500,
        cache,
      });
    }
  }, [appId, enabled, cache]);

  // Reset prefetch flag when switching away from HR app
  useEffect(() => {
    if (appId !== 'hr') {
      hasPrefetchedRef.current = false;
    }
  }, [appId]);
}

