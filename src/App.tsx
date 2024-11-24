import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { Suspense } from 'react';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import Home from './pages/dashboard/Home';
import Users from './pages/dashboard/Users';
import Settings from './pages/dashboard/Settings';
import Bid from './pages/dashboard/Bid';
import Library from './pages/dashboard/Library';
import Proposals from './pages/dashboard/Proposals';
import ProposalDetails from './pages/dashboard/ProposalDetails';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import ForgotPassword from './pages/auth/ForgotPassword';
import OrganizationRoute from '@/components/OrganizationRoute';
import VerifyEmail from './pages/auth/VerifyEmail';
import Onboarding from './pages/onboarding/Onboarding';
import ProjectDetails from './pages/dashboard/ProjectDetails';
import ProjectAnalysis from './pages/dashboard/ProjectAnalysis';
import ComingSoon from './components/ui/ComingSoon';
import DashboardLayout from './components/layout/DashboardLayout';
import MessagesPage from './pages/dashboard/MessagesPage';
import LibraryFiles from './pages/dashboard/LibraryFiles'




interface ProtectedRouteProps {
  children: React.ReactNode;

}

const EmailVerificationHandler = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  
  if (params.get('mode') === 'verifyEmail') {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/signin" replace />;
};

// Create a ProtectedRoute component
import { useAuth } from './contexts/AuthContext';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    userProfile 
  } = useAuth();

  const [renderCount, setRenderCount] = React.useState(0);

  
  

  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);

  console.log('ProtectedRoute Render:', {
    renderCount,
    path: window.location.pathname,
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    userEmail: user?.email,
    hasProfile: !!userProfile,
    profileData: {
      onboardingCompleted: userProfile?.onboardingCompleted,
      companyName: userProfile?.companyName,
      role: userProfile?.role
    }
  });

  // Show loading state while auth is initializing
  if (isLoading) {
    console.log('ProtectedRoute: Still loading...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated || !user) {
    console.log('ProtectedRoute: Redirecting to signin - not authenticated');
    return <Navigate to="/signin" replace />;
  }

  // Check user profile
  if (!userProfile) {
    console.log('ProtectedRoute: Redirecting to onboarding - no profile');
    return <Navigate to="/onboarding" replace />;
  }

  // Check onboarding completion
  if (!userProfile.onboardingCompleted) {
    console.log('ProtectedRoute: Redirecting to onboarding - not completed');
    return <Navigate to="/onboarding" replace />;
  }

  console.log('ProtectedRoute: All checks passed, rendering content');
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4">Loading content...</p>
        </div>
      </div>
    }>
      {children}
    </React.Suspense>
  );
};

// Create a new component for the dashboard home page
const DashboardHome = () => {
  return (
    <DashboardLayout>
      <ComingSoon 
        title="Dashboard"
        description="Our enhanced dashboard with analytics and insights is coming soon."
      />
    </DashboardLayout>
  );
};

// Create a new component for the dashboard home page
const MessagesHome = () => {
  return (
    <DashboardLayout>
      <ComingSoon 
        title="Messages"
        description="Our unique workspace for enhanced collaboration among lead- and sub-consultants is coming soon. "
      />
    </DashboardLayout>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected Dashboard Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardHome />
                </ProtectedRoute>
              } 
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />

            <Route 
              path="/companies/:companyName/projects/:id" 
              element={
                <ProtectedRoute>
                  <ProjectDetails />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/project/:id/analyze" 
              element={
                <ProtectedRoute>
                  <ProjectAnalysis />
                </ProtectedRoute>
              } 
            />

            <Route path="/library/files" element={<LibraryFiles />} />

            <Route
              path="/proposals"
              element={
                <ProtectedRoute>
                  <Proposals />
                </ProtectedRoute>
              }
            />

<Route path="/__/auth/action" element={
  <React.Suspense fallback={<div>Verifying...</div>}>
    <EmailVerificationHandler />
  </React.Suspense>
} />

            <Route
              path="/proposal/:id"
              element={
                <ProtectedRoute>
                  <ProposalDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <Library />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bid"
              element={
                <ProtectedRoute>
                  <Bid />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesHome />
                </ProtectedRoute>
              }
            />

            {/* Redirect root to dashboard */}
            <Route
              path="/"
              element={<Navigate to="/dashboard" />}
            />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;