'use client';

import { useEffect, useRef } from 'react';
import { useViewCache } from '@/components/ViewCacheContext';
import { prefetchHRViews } from './prefetch-hr-views';
import { AppId } from '@/types';

/**
 * Hook to pre-fetch HR view data when HR app is loaded
 * Usage: usePrefetchHRViews(currentApp, APPS[currentApp].available, currentViewId)
 * 
 * This hook waits for the current view to finish loading before prefetching other views
 * to avoid rate limits and prioritize the user's current view.
 */
export function usePrefetchHRViews(
  appId: AppId, 
  enabled: boolean = true,
  currentViewId?: string
) {
  const cache = useViewCache();
  const hasPrefetchedRef = useRef(false);
  const currentViewIdRef = useRef<string | undefined>(currentViewId);

  // Update current view ID ref
  useEffect(() => {
    currentViewIdRef.current = currentViewId;
  }, [currentViewId]);

  useEffect(() => {
    // Only prefetch for HR app and only once per session
    if (appId === 'hr' && enabled && !hasPrefetchedRef.current) {
      hasPrefetchedRef.current = true;
      
      // Wait for current view to load before prefetching others
      // This prioritizes the user's current view and avoids rate limits
      const waitForCurrentView = async () => {
        const viewId = currentViewIdRef.current;
        
        if (viewId) {
          // Give current view time to complete its initial fetch
          // Poll cache to see if it's loaded, but don't wait too long
          await new Promise(resolve => setTimeout(resolve, 1500)); // Initial wait
          
          // Check if current view has loaded (with timeout)
          let attempts = 0;
          const maxAttempts = 8; // Wait up to 4 seconds more (8 * 500ms)
          
          while (attempts < maxAttempts) {
            const cached = cache.getCache(viewId);
            if (cached && cached.data) {
              // Current view has loaded, safe to prefetch others
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
        } else {
          // No current view, wait a bit then prefetch
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Now prefetch other views (excluding current view)
        // This happens after current view has had time to load
        prefetchHRViews({ 
          enabled: true, 
          delay: 0, // Already waited above
          cache,
          excludeViewId: currentViewIdRef.current,
        });
      };
      
      // Start waiting for current view, then prefetch
      waitForCurrentView();
    }
  }, [appId, enabled, cache]);

  // Reset prefetch flag when switching away from HR app
  useEffect(() => {
    if (appId !== 'hr') {
      hasPrefetchedRef.current = false;
    }
  }, [appId]);
}

