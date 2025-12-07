'use client';

import { useState, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';

interface UserMenuProps {
  onProfileClick: () => void;
}

export default function UserMenu({ onProfileClick }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!user) {
    // Should not happen if AuthGuard is working, but show error if it does
    return (
      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50" title="Authentication Error">
        <span className="text-red-500 text-sm">!</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/5 transition-colors"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || user.email || 'User'}
            className="w-10 h-10 rounded-full object-cover border border-foreground/10 flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center border border-foreground/10 flex-shrink-0">
            <span className="text-accent-blue font-semibold text-sm">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium truncate">
            {user.displayName || user.email?.split('@')[0] || 'User'}
          </p>
          {user.displayName && (
            <p className="text-xs text-foreground/50 truncate">
              {user.email}
            </p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-foreground/50 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 glass-card p-2 z-50 shadow-lg">
          <div className="px-3 py-2 border-b border-foreground/10 mb-2">
            <p className="text-sm font-semibold truncate">
              {user.displayName || 'User'}
            </p>
            <p className="text-xs text-foreground/50 truncate">
              {user.email}
            </p>
          </div>
          <button
            onClick={() => {
              onProfileClick();
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            View Profile
          </button>
          <button
            onClick={async () => {
              const { signOut } = await import('firebase/auth');
              await signOut(auth);
              setIsOpen(false);
              window.location.href = '/';
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors text-sm mt-1 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
