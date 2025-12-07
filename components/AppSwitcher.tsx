'use client';

import { useState } from 'react';
import { App, AppId } from '@/types';
import { APPS } from '@/lib/apps';

interface AppSwitcherProps {
  currentApp: AppId;
  onAppChange: (appId: AppId) => void;
}

export default function AppSwitcher({ currentApp, onAppChange }: AppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentAppData = APPS[currentApp];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-button flex items-center gap-2 px-4 py-2"
        style={{ borderColor: currentAppData.color + '40' }}
      >
        <span className="text-xl">{currentAppData.icon}</span>
        <span className="font-semibold">{currentAppData.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 glass-card min-w-[200px] z-20">
            <div className="space-y-1">
              {Object.values(APPS).map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    onAppChange(app.id);
                    setIsOpen(false);
                  }}
                  disabled={!app.available}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl transition-all
                    ${currentApp === app.id
                      ? 'bg-accent-blue/10 border border-accent-blue/30'
                      : 'hover:bg-foreground/5'
                    }
                    ${!app.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  style={{
                    borderColor: currentApp === app.id ? app.color + '40' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{app.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{app.name}</div>
                      {!app.available && (
                        <div className="text-xs text-foreground/50">Coming soon</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

