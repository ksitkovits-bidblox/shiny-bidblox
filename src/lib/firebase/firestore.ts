// src/lib/firebase/firestore.ts
import { UserProfile } from '@/types/organization';
import { 
  collection, 
  doc,
  getDocs, 
  getDoc,
  setDoc, 
  query, 
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayRemove,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';

export const createUserProfile = async (uid: string, userData: UserProfile): Promise<void> => {
  const batch = writeBatch(db);
  
  try {
    // Validate required fields
    const requiredFields = ['email', 'firstName', 'lastName', 'companyName'];
    const missingFields = requiredFields.filter(field => !userData[field as keyof UserProfile]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Normalize user data
    const normalizedUserData = {
      uid,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
      companyName: userData.companyName,
      role: userData.role || 'user',
      department: userData.department || null,
      verified: userData.verified || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      profileCompleted: userData.profileCompleted || false,
      onboardingCompleted: userData.onboardingCompleted || false,
      businessType: userData.businessType || 'general-contractor',
      signUpCompleted: userData.signUpCompleted || false,
      metadata: {
        version: 1,
        lastModified: serverTimestamp()
      }
    };

    // Create/update main user document
    const userRef = doc(db, 'users', uid);
    batch.set(userRef, normalizedUserData);

    // Create/update user in company's subcollection
    const companyUserRef = doc(db, 'companies', userData.companyName, 'users', uid);
    const companyDoc = await getDoc(doc(db, 'companies', userData.companyName));

    if (!companyDoc.exists()) {
      // Create new company document if it doesn't exist
      const companyData = {
        name: userData.companyName,
        createdAt: serverTimestamp(),
        createdBy: uid,
        members: [uid],
        updatedAt: serverTimestamp(),
        metadata: {
          version: 1,
          lastModified: serverTimestamp()
        }
      };
      batch.set(doc(db, 'companies', userData.companyName), companyData);
    } else {
      // Add user to existing company's members
      batch.update(doc(db, 'companies', userData.companyName), {
        members: arrayUnion(uid),
        updatedAt: serverTimestamp()
      });
    }

    // Add user to company's users subcollection
    batch.set(companyUserRef, normalizedUserData);

    await batch.commit();
    return;

  } catch (error) {
    console.error('Error in createUserProfile:', error);
    throw error;
  }
};

// getUserProfile remains exactly the same
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log('No user document found for ID:', userId);
      return null;
    }

    const data = docSnap.data();
    console.log('Raw user data:', data);
    console.log('Company name from data:', data.companyName);

    return {
      uid: userId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      organizationId: data.organizationId,
      role: data.role || 'user',
      department: data.department || null,
      verified: data.verified ?? false,
      createdAt: data.createdAt.toDate(),
      verifiedAt: data.verifiedAt?.toDate(),
      lastLogin: data.lastLogin?.toDate(),
      profileCompleted: data.profileCompleted ?? false,
      onboardingCompleted: data.onboardingCompleted ?? false,
      updatedAt: data.updatedAt?.toDate(),
      companyName: data.companyName || null,
      businessType: data.businessType || 'general-contractor',
      signUpCompleted: data.signUpCompleted ?? false
    } as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, profileData: any) => {
  const batch = writeBatch(db);
  
  try {
    // Update main user document
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Update user in companies/bidblox/users
    const companyUserRef = doc(db, 'companies/bidblox/users', userId);
    batch.set(companyUserRef, {
      ...profileData,
      updatedAt: serverTimestamp(),
      metadata: {
        version: 1,
        lastModified: serverTimestamp()
      }
    }, { merge: true });

    await batch.commit();
    return { ...profileData, uid: userId };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw new Error('Failed to update user profile');
  }
};

export const isDomainRegistered = async (domain: string): Promise<boolean> => {
  try {
    const normalizedDomain = domain.toLowerCase().trim();
    const q = query(
      collection(db, 'users'),
      where('organizationId', '==', normalizedDomain.replace(/[^a-z0-9]/g, '-'))
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error: any) {
    throw new Error(`Error checking domain: ${error.message}`);
  }
};

// New helper function to get company data
export const getCompanyData = async (companyId: string) => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      return null;
    }

    return {
      id: companyId,
      ...companyDoc.data()
    };
  } catch (error) {
    console.error('Error fetching company data:', error);
    throw error;
  }
};