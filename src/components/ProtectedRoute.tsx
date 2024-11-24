// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    userProfile 
  } = useAuth();

  console.log('ProtectedRoute Check:', {
    currentPath: window.location.pathname,
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    userEmail: user?.email,
    profileData: userProfile,
    onboardingCompleted: userProfile?.onboardingCompleted,
    companyName: userProfile?.companyName
  });

  if (isLoading) {
    console.log('ProtectedRoute: Loading state');
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    console.log('ProtectedRoute: Not authenticated');
    return <Navigate to="/signin" />;
  }

  if (!userProfile?.onboardingCompleted) {
    console.log('ProtectedRoute: Onboarding not completed');
    return <Navigate to="/onboarding" />;
  }

  console.log('ProtectedRoute: Rendering protected content');
  return <>{children}</>;
};