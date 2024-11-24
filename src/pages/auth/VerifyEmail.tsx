import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { updateUserVerificationStatus } from '@/services/userService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VerifyEmail: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const checkVerification = async (user: any) => {
      await user.reload();
      if (user.emailVerified && !isVerified) {
        setIsVerified(true);
        try {
          const needsOnboarding = await updateUserVerificationStatus(user.uid);
          navigate(needsOnboarding ? '/onboarding' : '/dashboard');
        } catch (error) {
          console.error('Error updating verification status:', error);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Initial check
        await checkVerification(user);
        // Set up interval to check every 3 seconds
        interval = setInterval(() => checkVerification(user), 3000);
      } else {
        navigate('/signin');
      }
    });

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [navigate, isVerified]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user, {
          url: `${window.location.origin}/verify-email`,
          handleCodeInApp: true
        });
        setResendDisabled(true);
        setCountdown(60);
      } catch (error) {
        console.error('Error sending verification email:', error);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            Please check your email and verify your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              A verification link has been sent to your email address.
              Please check your inbox and spam folder.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleResendVerification}
            variant="outline"
            className="w-full"
            disabled={resendDisabled}
          >
            {resendDisabled 
              ? `Resend available in ${countdown}s` 
              : 'Resend Verification Email'}
          </Button>

          <Button 
            variant="link" 
            className="w-full"
            onClick={() => auth.signOut()}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;