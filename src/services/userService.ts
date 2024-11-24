import { db } from '@/lib/firebase/firebase';
import { UserProfile } from '@/types/organization';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase/firebase';
import { normalizeCompanyName } from '@/utils/organizationValidation';


export const createUserProfile = async (uid: string, userData: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: new Date(),
  });
};

export const updateUserProfile = async (uid: string, updateData: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updateData);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() as UserProfile : null;
};

/*
export const updateUserVerificationStatus = async (uid: string): Promise<boolean> => {
  try {
    console.log('Starting verification update for uid:', uid);
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);
    
    for (const companyDoc of companiesSnapshot.docs) {
      console.log('Checking company:', companyDoc.id);
      const userRef = doc(collection(companyDoc.ref, 'users'), uid);
      const userSnapshot = await getDoc(userRef);
      
      if (userSnapshot.exists()) {
        console.log('Found user in company:', companyDoc.id);
        const userData = userSnapshot.data();
        
        const updateData = {
          verified: true,
          verifiedAt: new Date(),
          lastLogin: new Date(),
          updatedAt: new Date(),
          email_verified: true
        };

        await updateDoc(userRef, updateData);
        console.log('User verification updated successfully');

        // Also update the user profile in the users collection
        const userProfileRef = doc(db, 'users', uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists()) {
          await updateDoc(userProfileRef, updateData);
        }

        return !userData.onboardingCompleted;
      }
    }

    throw new Error('User not found in any company');
  } catch (error) {
    console.error('Error in updateUserVerificationStatus:', error);
    throw error;
  }
};*/
export const updateUserVerificationStatus = async (uid: string): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error('No authenticated user found');
    }

    const companyName = normalizeCompanyName(user.email);
    console.log('Updating verification for user:', { uid, companyName });

    const userRef = doc(db, 'companies', companyName, 'users', uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new Error('User profile not found');
    }

    const userData = userSnapshot.data();
    await updateDoc(userRef, {
      verified: true,
      profileCompleted: !!userData.profileCompleted,
      signUpCompleted: !!userData.signUpCompleted,
      updatedAt: new Date()
    });

    return !userData.signUpCompleted;
  } catch (error) {
    console.error('Verification update failed:', error);
    throw error;
  }
};