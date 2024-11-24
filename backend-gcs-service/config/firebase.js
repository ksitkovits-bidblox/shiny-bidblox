require('dotenv').config();
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { Storage } = require('@google-cloud/storage');
const { getFirestore } = require('firebase-admin/firestore');

// Service instances
let firebaseApp;
let storage;
let db;

// Environment validation
const requiredEnvVars = {
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
  BUCKET_PREFIX: process.env.BUCKET_PREFIX,
  GOOGLE_CLOUD_SERVICE_ACCOUNT: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT,
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY
};

// Validate environment variables before initialization
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Helper function to generate bucket name from company name
const getBucketName = (company) => {
  if (!company) throw new Error('Company name is required for bucket generation');
  const sanitizedName = company.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${process.env.BUCKET_PREFIX}-${sanitizedName}`;
};

const initializeFirebase = () => {
  try {
    // Only initialize if no apps exist
    if (getApps().length === 0) {
      console.log('Initializing Firebase App...');
      
      // Initialize Firebase Admin
      firebaseApp = initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
      }, 'backend-service');
      
      // Initialize Firestore
      db = getFirestore(firebaseApp);
      console.log('Firestore initialized');
      
      // Initialize Storage
      storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      console.log('Storage initialized');
    } else {
      console.log('Using existing Firebase App...');
      firebaseApp = getApps()[0];
      db = getFirestore(firebaseApp);
      storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
    }

    // Verify services are initialized
    const servicesStatus = {
      hasFirestore: !!db,
      hasStorage: !!storage,
      hasGemini: !!process.env.GOOGLE_GEMINI_API_KEY,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      bucketPrefix: process.env.BUCKET_PREFIX
    };

    console.log('Services initialized:', servicesStatus);

    // Helper functions for storage operations
    const getCompanyBucket = async (company) => {
      if (!company) {
        throw new Error('Company name is required for bucket operations');
      }

      const bucketName = getBucketName(company);
      const bucket = storage.bucket(bucketName);
      
      try {
        // Ensure bucket exists
        const [exists] = await bucket.exists();
        if (!exists) {
          console.log(`Creating new bucket: ${bucketName}`);
          await storage.createBucket(bucketName);
          
          // Set uniform bucket-level access
          await bucket.setIamPolicy({
            bindings: [
              {
                role: 'roles/storage.objectViewer',
                members: ['serviceAccount:' + process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT]
              }
            ]
          });
          
          console.log(`Bucket ${bucketName} created and configured successfully`);
        }
        
        return bucket;
      } catch (error) {
        console.error(`Error managing bucket for company ${company}:`, error);
        throw new Error(`Failed to manage bucket for company ${company}: ${error.message}`);
      }
    };

    return {
      firebaseApp,
      db,
      storage,
      getBucketName,
      getCompanyBucket
    };
  } catch (error) {
    console.error('Firebase initialization error:', {
      error: error.message,
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Missing',
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'Set' : 'Missing'
    });
    throw error;
  }
};

// Initialize services
const services = initializeFirebase();

// Export initialized services and helper functions
module.exports = {
  firebaseApp: services.firebaseApp,
  db: services.db,
  storage: services.storage,
  getBucketName: services.getBucketName,
  getCompanyBucket: services.getCompanyBucket,
  initializeFirebase
};

// Verify exports
console.log('Firebase config exports:', {
  hasFirebaseApp: !!services.firebaseApp,
  hasDb: !!services.db,
  hasStorage: !!services.storage,
  hasBucketHelper: !!services.getBucketName,
  hasCompanyBucketHelper: !!services.getCompanyBucket
});