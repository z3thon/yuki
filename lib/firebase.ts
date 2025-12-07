import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Initialize Firebase lazily to avoid build-time errors
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    if (getApps().length === 0) {
      if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
        // During build, env vars might not be available - return a mock
        if (typeof window === 'undefined') {
          return {} as FirebaseApp;
        }
        throw new Error('Firebase config missing - check environment variables');
      }
      try {
        app = initializeApp(firebaseConfig);
      } catch (error) {
        // During build, Firebase might fail - return a mock
        if (typeof window === 'undefined') {
          return {} as FirebaseApp;
        }
        throw error;
      }
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!authInstance) {
    try {
      authInstance = getAuth(getApp());
    } catch (error) {
      // During build, return a mock auth object
      if (typeof window === 'undefined') {
        return {
          onAuthStateChanged: () => () => {},
          currentUser: null,
        } as unknown as Auth;
      }
      throw error;
    }
  }
  return authInstance;
}

// Export for backward compatibility - lazy initialization
export const auth = typeof window !== 'undefined' 
  ? getAuthInstance() 
  : ({
      onAuthStateChanged: () => () => {},
      currentUser: null,
    } as unknown as Auth);

export default getApp();

