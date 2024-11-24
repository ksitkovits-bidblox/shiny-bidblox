import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { UserProfile } from '@/types/organization';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { companyApi, makeRequest } from '@/utils/api'; 
import { normalizeCompanyName } from '@/utils/organizationValidation';




const Onboarding: React.FC = () => {
  const { user, userProfile, isLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [businessType, setBusinessType] = useState<'general-contractor' | 'architect' | 'mep-consultant' | 'sub-consultant'>('general-contractor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
  
    try {
      if (!user?.uid || !user.email) throw new Error('Authentication required');
  
      const now = new Date();
      const normalizedCompanyName = normalizeCompanyName(user.email);
      
      const updatedProfile = {
        ...userProfile,
        department,
        businessType,
        verified: true,
        companyName: normalizedCompanyName,
        profileCompleted: true,
        onboardingCompleted: true,
        signUpCompleted: true,
        updatedAt: now
      };
  
      const companyRef = doc(db, 'companies', normalizedCompanyName);
      const userRef = doc(collection(companyRef, 'users'), user.uid);
      await setDoc(userRef, updatedProfile, { merge: true });
  
      await user.getIdToken(true);
      window.location.replace('/dashboard');
  
    } catch (err: unknown) {
      console.error('Profile setup error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    console.log('Auth state changed:', { 
      isLoading, 
      hasUser: !!user, 
      isEmailVerified,
      hasProfile: !!userProfile
    });
  }, [isLoading, user, isEmailVerified, userProfile]);

  // Redirect if needed
  React.useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isEmailVerified) {
        navigate('/verify-email');
      } else if (userProfile?.signUpCompleted) {
        navigate('/dashboard');
      }
    }
  }, [isLoading, user, isEmailVerified, userProfile, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-[600px]">
          <CardContent className="flex items-center justify-center py-8">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[600px]">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>Tell us about your role to get started</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter your company name"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select 
                value={businessType} 
                onValueChange={(value: 'general-contractor' | 'architect' | 'mep-consultant' | 'sub-consultant') => setBusinessType(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general-contractor">General Contractor</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="mep-consultant">MEP Consultant</SelectItem>
                  <SelectItem value="sub-consultant">Sub-consultant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select 
                value={department} 
                onValueChange={setDepartment}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Acoustics">Acoustics Sub-consultant</SelectItem>
                  <SelectItem value="Security">Security Sub-consultant</SelectItem>
                  <SelectItem value="Security">Electrical Sub-consultant</SelectItem>
                  <SelectItem value="Security">Sustainability</SelectItem>
                  <SelectItem value="Security">Structural</SelectItem>
                  <SelectItem value="Security">Plumbing</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Estimating">Estimating</SelectItem>
                  <SelectItem value="Project">Project Management</SelectItem>
                  <SelectItem value="Executive Leadership">Executive Leadership</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>

                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Completing Profile...' : 'Complete Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;