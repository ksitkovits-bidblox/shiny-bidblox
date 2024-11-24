// src/hooks/useOrganization.ts
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Organization } from '@/types/organization';

export const useOrganization = (organizationId: string | undefined) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        const orgRef = doc(db, 'organizations', organizationId);
        const orgSnap = await getDoc(orgRef);
        
        if (orgSnap.exists()) {
          setOrganization({
            id: orgSnap.id,
            ...orgSnap.data(),
          } as Organization);
        } else {
          setOrganization(null);
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching organization:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [organizationId]);

  const refreshOrganization = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      const orgRef = doc(db, 'organizations', organizationId);
      const orgSnap = await getDoc(orgRef);
      
      if (orgSnap.exists()) {
        setOrganization({
          id: orgSnap.id,
          ...orgSnap.data(),
        } as Organization);
      } else {
        setOrganization(null);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Error refreshing organization:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    organization,
    loading,
    error,
    refreshOrganization
  };
};

// Optional: Add a hook for organization settings
export const useOrganizationSettings = (organizationId: string | undefined) => {
  const { organization, loading, error } = useOrganization(organizationId);

  return {
    settings: organization?.settings || null,
    loading,
    error
  };
};

// Optional: Add a hook for checking feature access
export const useFeatureAccess = (organizationId: string | undefined, feature: string) => {
  const { organization, loading, error } = useOrganization(organizationId);

  const hasAccess = organization?.settings?.allowedFeatures?.includes(feature) || false;

  return {
    hasAccess,
    loading,
    error
  };
};