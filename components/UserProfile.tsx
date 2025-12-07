'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    // Should not happen if AuthGuard is working, but show error if it does
    return (
      <div className="p-6">
        <div className="glass-card p-6 border border-red-500/30">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Authentication Error</h2>
          <p className="text-foreground/70">You are not authenticated. Please sign in to access your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-foreground/50 mt-1">Your account information</p>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-6 mb-6">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-20 h-20 rounded-full object-cover border-2 border-foreground/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-accent-blue/20 flex items-center justify-center border-2 border-foreground/10">
              <span className="text-accent-blue font-semibold text-2xl">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-semibold">
              {user.displayName || 'User'}
            </h2>
            <p className="text-foreground/50">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-foreground/10">
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <p className="font-medium">{user.email || 'Not provided'}</p>
          </div>

          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              User ID (Firebase UID)
            </label>
            <p className="font-mono text-sm text-foreground/70 break-all">
              {user.uid}
            </p>
          </div>

          {user.displayName && (
            <div>
              <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
                Display Name
              </label>
              <p className="font-medium">{user.displayName}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Email Verified
            </label>
            <p className="font-medium">
              {user.emailVerified ? (
                <span className="text-green-600">✓ Verified</span>
              ) : (
                <span className="text-orange-600">⚠ Not Verified</span>
              )}
            </p>
          </div>

          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Account Created
            </label>
            <p className="text-foreground/70">
              {user.metadata.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Unknown'}
            </p>
          </div>

          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Last Sign In
            </label>
            <p className="text-foreground/70">
              {user.metadata.lastSignInTime
                ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  })
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

