// src/lib/firebase/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, getDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Test Firestore access
const testFirestore = async () => {
  try {
    console.log('Testing Firestore access...');
    
    // Test 1: Try to get companies collection
    const companiesRef = collection(db, 'companies');
    const snapshot = await getDocs(companiesRef);
    console.log('Collection test:', {
      path: 'companies',
      size: snapshot.size,
      empty: snapshot.empty,
      companies: snapshot.docs.map(doc => doc.id)
    });

    // Test 2: Try to access Bidblox document directly
    const bidbloxRef = doc(db, 'companies', 'Bidblox');
    const bidbloxDoc = await getDoc(bidbloxRef);
    console.log('Direct document test:', {
      path: 'companies/Bidblox',
      exists: bidbloxDoc.exists(),
      data: bidbloxDoc.exists() ? 'Document found' : 'No document'
    });

    // Test 3: Try lowercase
    const bidbloxLowerRef = doc(db, 'companies', 'bidblox');
    const bidbloxLowerDoc = await getDoc(bidbloxLowerRef);
    console.log('Lowercase document test:', {
      path: 'companies/bidblox',
      exists: bidbloxLowerDoc.exists(),
      data: bidbloxLowerDoc.exists() ? 'Document found' : 'No document'
    });

  } catch (error) {
    console.error('Firestore test failed:', error);
  }
};

// Run the test
testFirestore();

export default app;