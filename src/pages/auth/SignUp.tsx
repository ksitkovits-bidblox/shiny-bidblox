// src/pages/auth/SignUp.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isWorkEmail, getOrganizationIdFromEmail, normalizeCompanyName } from '@/utils/organizationValidation';
import { createUserProfile } from '@/lib/firebase/firestore';
import { validateCompanyName } from '@/utils/validations';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';



// Add this type for business types
//type BusinessType = 'general-contractor' | 'architect' | 'mep-consultant' | "";

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  //const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [companyNameWarning, setCompanyNameWarning] = useState<string | null>(null);

  const [emailError, setEmailError] = useState<string | null>(null);

  const validateEmail = async (email: string) => {
    try {
      if (!email) return 'Email is required';
      
      const isValid = await isWorkEmail(email);
      if (!isValid) {
        return 'Please use your work email address. Personal email addresses like Gmail, Yahoo, etc. are not accepted.';
      }
      const emailValidation = await isWorkEmail(email);
      if (!emailValidation.isValid) {
        return 'Please use your work email address. Personal email addresses like Gmail, Yahoo, etc. are not accepted.';

      }
     
      
      return null;
    } catch (error) {
      console.error('Email validation error:', error);
      return 'Invalid email format';
    }
  };


  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setCompanyName(newName);
    setError(null); // Clear any existing errors while typing
    setCompanyNameWarning(null); // Clear any existing warnings while typing
    
    // Only validate if user has entered 2 or more characters
    // or if they've entered something and then deleted it all
    if (newName.length > 0 && newName.length < 2) {
      return; // Don't show any error while user is still typing
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setEmailError(null);
  
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const companyName = normalizeCompanyName(email); // This will be lowercase

  
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await sendEmailVerification(user, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      });
  
      const domain = email.split('@')[1];
      //const companyName = domain.split('.')[0].charAt(0).toUpperCase() + 
      //domain.split('.')[0].slice(1).toLowerCase();      
      const displayName = `${firstName} ${lastName}`;
      const now = new Date();
  
      const userProfileData = {
        uid: user.uid,
        email: user.email!,
        firstName,
        lastName,
        displayName,
        organizationId: companyName,
        companyName,
        role: 'user' as const,
        createdAt: now,
        verified: false,
        businessType: 'general-contractor',
        profileCompleted: false,
        onboardingCompleted: false,
        updatedAt: now,
        signUpCompleted: false
      };
  
      // Create user document in Firestore under companies collection
      const companyRef = doc(db, 'companies', companyName);
      const userRef = doc(collection(companyRef, 'users'), user.uid);
      await setDoc(userRef, userProfileData);
  
      const idToken = await user.getIdToken();
      login(idToken);
      navigate('/verify-email');
  
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Sign up to get started with BidBlox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSignUp} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="firstName">
        First Name
        <span className="text-red-500 ml-1">*</span>
      </Label>
      <Input 
        id="firstName"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="John"
        required
        disabled={isLoading}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="lastName">
        Last Name
        <span className="text-red-500 ml-1">*</span>
      </Label>
      <Input 
        id="lastName"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Doe"
        required
        disabled={isLoading}
      />
    </div>
  </div>

            
  <div className="space-y-2">
      <Label htmlFor="email">Work Email</Label>
      <Input 
        id="email"
        name="email"
        type="email"
        placeholder="john@company.com"
        required
        disabled={isLoading}
        className={emailError ? 'border-red-500' : ''}
      />
      {emailError && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{emailError}</AlertDescription>
        </Alert>
      )}
    </div>

            

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                disabled={isLoading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          <Separator className="my-4" />
          
          <div className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Button 
              variant="link" 
              className="p-0"
              onClick={() => navigate('/signin')}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;