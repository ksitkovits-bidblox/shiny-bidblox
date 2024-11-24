// src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

interface User {
  id: string;
  companyName: string;
  businessType: string;
  createdAt: Date;
  email: string;
  department: string;
  lastLogin: Date;
  onboardingCompleted: boolean;
  organizationID: string;
  profileCompleted: boolean;
  role: string;
  signupCompleted: boolean;
  uid: string;
  updatedAt: Date;
  verified: boolean;
  // Firebase auth properties we might need
  emailVerified?: boolean;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists()) {
            throw new Error('User document not found in Firestore');
          }

          const userData = userDocSnap.data();
          
          // Combine Firestore data with Firebase user data
          const user: User = {
            ...userData,
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || userData.email,
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            // Convert Firestore timestamps to Dates if needed
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date(),
            lastLogin: userData.lastLogin?.toDate() || new Date(),
          } as User; // Type assertion here because we know the shape matches

          setAuthState({
            user,
            loading: false,
            error: null
          });
        } catch (error) {
          console.error('Auth error:', error);
          setAuthState({
            user: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication error'
          });
        }
      } else {
        setAuthState({
          user: null,
          loading: false,
          error: null
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper methods that use the consistent User type
  const methods = {
    isAuthenticated: () => !!authState.user,
    hasRole: (requiredRole: string) => authState.user?.role === requiredRole,
    belongsToCompany: (companyName: string) => authState.user?.companyName === companyName,
    hasCompletedOnboarding: () => authState.user?.onboardingCompleted ?? false,
    getCurrentCompany: () => authState.user?.companyName,
    getUserRole: () => authState.user?.role
  };

  return {
    ...authState,
    ...methods
  };
};

// Type guard using the consistent User type
export const isAuthenticated = (user: User | null): user is User => {
  return user !== null;
};

// Export the User type for use in other components
export type { User, AuthState };