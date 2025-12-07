'use client';

import { useState } from 'react';
import { AppId, View } from '@/types';
import { APPS } from '@/lib/apps';

interface SidebarProps {
  appId: AppId;
  views: View[];
  currentViewId?: string;
  onViewSelect: (viewId: string) => void;
}

export default function Sidebar({ appId, views, currentViewId, onViewSelect }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const app = APPS[appId];

  const defaultViews = views.filter(v => v.isDefault);
  const customViews = views.filter(v => v.isCustom);

  return (
    <div
      className={`
        p-4 transition-all duration-300 h-full
        ${isCollapsed ? 'w-16' : 'w-full'}
      `}
      style={{
        borderColor: app.color + '20',
      }}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-end mb-4 p-2 rounded-lg hover:bg-foreground/5 transition-colors"
      >
        <svg
          className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {/* Views List */}
      {!isCollapsed && (
        <div className="space-y-6">
          {/* Default Views */}
          {defaultViews.length > 0 && (
            <div>
              <h3 className="text-xs text-foreground/50 uppercase tracking-wider mb-2 px-2">
                General
              </h3>
              <div className="space-y-1">
                {defaultViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => onViewSelect(view.id)}
                    className={`
                      w-full text-left pl-4 pr-3 py-2 rounded-xl transition-all
                      ${currentViewId === view.id
                        ? 'bg-accent-blue/10 border border-accent-blue/30'
                        : 'hover:bg-foreground/5'
                      }
                    `}
                    style={{
                      borderColor: currentViewId === view.id ? app.color + '40' : 'transparent',
                    }}
                  >
                    <div className="font-medium text-sm">{view.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Views */}
          {customViews.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2 px-2">
                Custom
              </h3>
              <div className="space-y-1">
                {customViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => onViewSelect(view.id)}
                    className={`
                      w-full text-left pl-4 pr-3 py-2 rounded-xl transition-all
                      ${currentViewId === view.id
                        ? 'bg-accent-blue/10 border border-accent-blue/30'
                        : 'hover:bg-foreground/5'
                      }
                    `}
                    style={{
                      borderColor: currentViewId === view.id ? app.color + '40' : 'transparent',
                    }}
                  >
                    <div className="font-medium text-sm">{view.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed Icons */}
      {isCollapsed && (
        <div className="space-y-2">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewSelect(view.id)}
              className={`
                w-full p-2 rounded-lg transition-all
                ${currentViewId === view.id
                  ? 'bg-accent-blue/10'
                  : 'hover:bg-foreground/5'
                }
              `}
              title={view.name}
            >
              <div className="w-6 h-6 mx-auto flex items-center justify-center">
                {view.config.type === 'table' && '📊'}
                {view.config.type === 'dashboard' && '📈'}
                {view.config.type === 'form' && '📝'}
                {view.config.type === 'chart' && '📉'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

