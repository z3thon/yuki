import { NextRequest } from 'next/server';
import admin from './firebase-admin';

/**
 * SECURITY: Verify Firebase Auth token and return user ID
 * 
 * This function ensures:
 * 1. Token is present and valid format
 * 2. Token is verified via Firebase Admin SDK (server-side only)
 * 3. Returns verified userId (Firebase UID)
 * 
 * Use this in all API routes before accessing permissions or data
 * 
 * @param request - Next.js request object
 * @returns Verified userId (Firebase UID) or null if invalid
 */
export async function verifyAuthAndGetUserId(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token (server-side only)
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Return verified userId (Firebase UID)
    // SECURITY: This userId is guaranteed to be from a valid Firebase Auth token
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * SECURITY: Verify Firebase Auth token and return full user info
 * 
 * @param request - Next.js request object
 * @returns User info or null if invalid
 */
export async function verifyAuthAndGetUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      photoURL: decodedToken.picture,
      isAdmin: decodedToken.admin === true,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

