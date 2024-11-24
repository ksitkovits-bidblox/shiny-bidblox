import React from 'react';
import { auth, db } from '@/lib/firebase/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { getUserProfile } from '@/lib/firebase/firestore';
import { UserProfile, Organization } from '@/types/organization';
import { normalizeCompanyName } from '@/utils/organizationValidation';


interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  userProfile: UserProfile | null;
  organization: Organization | null;  
  isEmailVerified: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const getUserFromCompanies = async (uid: string): Promise<UserProfile | null> => {
  try {
    const currentUser = auth.currentUser;
    console.log('Current auth state:', {
      isAuthenticated: !!currentUser,
      uid: currentUser?.uid,
      email: currentUser?.email
    });

    if (currentUser?.email) {
      // Extract company name from email domain
      const domain = currentUser.email.split('@')[1];
      const companyName = normalizeCompanyName(currentUser.email);
      
      console.log('Trying to find user in company:', companyName);
      
      // Try direct path to user document
      const userRef = doc(db, 'companies', companyName, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      console.log('User document lookup:', {
        path: userRef.path,
        exists: userSnap.exists(),
        data: userSnap.exists() ? 'Found' : 'Not found'
      });
      
      if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
      }
    }
    
    console.log('User not found');
    return null;
  } catch (error) {
    console.error('Error in getUserFromCompanies:', error);
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [user, setUser] = React.useState<User | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed. Current user:', currentUser?.uid);
      setIsLoading(true);
      
      if (currentUser) {
        try {
          console.log('Setting authenticated state for user:', currentUser.uid);
          setUser(currentUser);
          setIsAuthenticated(true);

          console.log('Fetching user profile...');
          const profile = await getUserFromCompanies(currentUser.uid);
          console.log('Fetched profile result:', profile);
          setUserProfile(profile);

          if (currentUser.emailVerified && (!profile?.verified || !profile?.signUpCompleted)) {
            console.log('User verified but profile incomplete');
            if (!window.location.pathname.includes('/onboarding')) {
              window.location.href = '/onboarding';
            }
          } else if (!currentUser.emailVerified && !window.location.pathname.includes('/verify-email')) {
            window.location.href = '/verify-email';
          }
        } catch (error) {
          console.error('Auth error:', error);
        }
      } else {
        console.log('No user, clearing states');
        setUser(null);
        setUserProfile(null);
        setOrganization(null);
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = React.useCallback((token: string) => {
    try {
      localStorage.setItem('token', token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setUser(null);
      setUserProfile(null);
      setOrganization(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  const value = React.useMemo(() => ({
    isAuthenticated,
    isLoading,
    user,
    userProfile,
    organization,
    isEmailVerified: user?.emailVerified ?? false,
    login,
    logout
  }), [isAuthenticated, isLoading, user, userProfile, organization, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}