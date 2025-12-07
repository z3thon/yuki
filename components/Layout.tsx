'use client';

import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AppSwitcher from './AppSwitcher';
import Sidebar from './Sidebar';
import UserMenu from './UserMenu';
import AIChat from './AIChat';
import { ViewCacheProvider } from './ViewCacheContext';
import { usePrefetchHRViews } from '@/lib/usePrefetchHRViews';
import { AppId, View } from '@/types';
import { APPS } from '@/lib/apps';

interface LayoutProps {
  children: React.ReactNode;
}

// Context for refreshing views
interface RefreshContextType {
  refreshView: () => void;
  registerRefreshCallback: (callback: () => void) => () => void;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

export function useRefreshView() {
  const context = useContext(RefreshContext);
  return context;
}

const AI_CHAT_STORAGE_KEY = 'yuki_ai_chat_open';

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentApp, setCurrentApp] = useState<AppId>('hr');
  const [currentViewId, setCurrentViewId] = useState<string | undefined>();
  const [views, setViews] = useState<View[]>([]);
  const [isAIOpen, setIsAIOpen] = useState(true); // Default to open
  // Use ref instead of state to avoid infinite loops during unmount
  const refreshCallbacksRef = useRef<Set<() => void>>(new Set());

  // Load AI chat state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (savedState !== null) {
      setIsAIOpen(savedState === 'true');
    }
  }, []);

  // Save AI chat state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(AI_CHAT_STORAGE_KEY, String(isAIOpen));
  }, [isAIOpen]);

  // Extract app and viewId from pathname - pathname is the source of truth
  useEffect(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    const appFromPath = pathParts[0] as AppId;
    const viewIdFromPath = pathParts[1];
    
    // Update app if it changed
    if (appFromPath && ['hr', 'crm', 'billing'].includes(appFromPath)) {
      setCurrentApp(appFromPath);
    }
    
    // Always sync viewId from pathname - this ensures sidebar matches URL
    setCurrentViewId(viewIdFromPath || undefined);
  }, [pathname]);

  // Load views for current app
  useEffect(() => {
    // TODO: Fetch views from Fillout or API
    // For now, use default views based on app
    const defaultViews = getDefaultViewsForApp(currentApp);
    setViews(defaultViews);
  }, [currentApp]);

  const handleAppChange = (appId: AppId) => {
    const app = APPS[appId];
    if (!app.available) {
      router.push(`/${appId}/coming-soon`);
    } else {
      router.push(`/${appId}`);
      setCurrentApp(appId);
      setCurrentViewId(undefined); // Reset view when switching apps
    }
  };

  const handleViewSelect = (viewId: string) => {
    setCurrentViewId(viewId);
    router.push(`/${currentApp}/${viewId}`);
  };

  const refreshView = useCallback(() => {
    // Trigger all registered refresh callbacks
    refreshCallbacksRef.current.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in refresh callback:', error);
      }
    });
  }, []);

  const registerRefreshCallback = useCallback((callback: () => void) => {
    // Add callback to ref (doesn't trigger re-render)
    refreshCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      refreshCallbacksRef.current.delete(callback);
    };
  }, []);

  const refreshContextValue: RefreshContextType = {
    refreshView,
    registerRefreshCallback,
  };

  const showAI = APPS[currentApp].available && currentViewId;
  const app = APPS[currentApp];

  return (
    <ViewCacheProvider>
      <HRViewPrefetcher appId={currentApp} />
      <RefreshContext.Provider value={refreshContextValue}>
        <div className="h-screen flex overflow-hidden">
          {/* Column 1: App Switcher + Sidebar + User Profile */}
          <div className="flex flex-col w-64 flex-shrink-0 border-r border-foreground/10">
            {/* App Switcher */}
            <div className="p-4 border-b border-foreground/10">
              <AppSwitcher currentApp={currentApp} onAppChange={handleAppChange} />
            </div>

            {/* Sidebar Views */}
            {app.available && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <Sidebar
                  appId={currentApp}
                  views={views}
                  currentViewId={currentViewId}
                  onViewSelect={handleViewSelect}
                />
              </div>
            )}

            {/* User Profile at Bottom */}
            <div className="p-4 border-t border-foreground/10 flex-shrink-0">
              <UserMenu onProfileClick={() => router.push('/hr/profile')} />
            </div>
          </div>

          {/* Column 2: Main Content */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Floating AI Toggle Button (only show when AI panel is closed) */}
            {showAI && !isAIOpen && (
              <button
                onClick={() => setIsAIOpen(true)}
                className="absolute top-4 right-4 z-40 p-3 rounded-full bg-accent-blue/90 text-white hover:bg-accent-blue shadow-lg hover:shadow-xl transition-all"
                title="Open AI Assistant"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </button>
            )}

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>

          {/* Column 3: AI Chat Panel (only when open) */}
          {showAI && isAIOpen && (
            <div className="w-96 flex-shrink-0 border-l border-foreground/10 flex flex-col">
              <div className="h-16 flex items-center justify-between px-4 border-b border-foreground/10 flex-shrink-0">
                <h2 className="font-semibold">Yuki</h2>
                <button
                  onClick={() => setIsAIOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                  title="Close Yuki"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <AIChat
                  appId={currentApp}
                  viewId={currentViewId}
                  onDataUpdate={refreshView}
                  hideHeader={true}
                />
              </div>
            </div>
          )}
        </div>
      </RefreshContext.Provider>
    </ViewCacheProvider>
  );
}

function getDefaultViewsForApp(appId: AppId): View[] {
  const now = new Date();
  
  switch (appId) {
    case 'hr':
      return [
        {
          id: 'employees',
          appId: 'hr',
          name: 'Employees',
          description: 'Manage employee information',
          isDefault: true,
          isCustom: false,
          config: { type: 'table' },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'time-tracking',
          appId: 'hr',
          name: 'Time Tracking',
          description: 'View and manage time punches',
          isDefault: true,
          isCustom: false,
          config: { type: 'table' },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'punch-alterations',
          appId: 'hr',
          name: 'Punch Alterations',
          description: 'Approve or decline time alteration requests',
          isDefault: true,
          isCustom: false,
          config: { type: 'table' },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'pay-periods',
          appId: 'hr',
          name: 'Pay Periods',
          description: 'View hours by pay period',
          isDefault: true,
          isCustom: false,
          config: { type: 'dashboard' },
          createdAt: now,
          updatedAt: now,
        },
      ];
    case 'crm':
    case 'billing':
      return [];
    default:
      return [];
  }
}

/**
 * Component to handle HR view prefetching
 * Must be inside ViewCacheProvider to access cache
 */
function HRViewPrefetcher({ appId }: { appId: AppId }) {
  usePrefetchHRViews(appId, APPS[appId].available);
  return null;
}
