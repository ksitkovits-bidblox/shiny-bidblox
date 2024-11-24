// src/components/OrganizationRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/hooks/useOrganization';

interface OrganizationRouteProps {
  children: React.ReactNode;
  requiredFeatures?: string[];
}

const OrganizationRoute: React.FC<OrganizationRouteProps> = ({
  children,
  requiredFeatures = [],
}) => {
  const { user, isAuthenticated } = useAuth();
  const { organization, loading } = useOrganization(user?.organizationId);

  if (!isAuthenticated) {
    return <Navigate to="/signin" />;
  }

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading component
  }

  if (!organization) {
    return <Navigate to="/unauthorized" />;
  }

  // Check if organization has access to required features
  const hasAccess = requiredFeatures.every(feature =>
    organization.settings.allowedFeatures.includes(feature)
  );

  if (!hasAccess) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};

export default OrganizationRoute;