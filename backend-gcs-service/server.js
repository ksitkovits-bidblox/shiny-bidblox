const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const portfinder = require('portfinder');
const fs = require('fs').promises;
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Utility function to get company name from email
const getCompanyFromEmail = (email) => {
  const domain = email.split('@')[1];
  return domain.split('.')[0].charAt(0).toUpperCase() +
    domain.split('.')[0].slice(1).toLowerCase();
};

// 1. Load Environment Variables
console.log('Loading environment variables...');
const envPath = path.resolve(__dirname, '.env');
let result = dotenv.config({ path: envPath });

if (result.error) {
  console.log('Trying parent directory for .env...');
  const parentEnvPath = path.resolve(__dirname, '../.env');
  dotenv.config({ path: parentEnvPath });
}

// 2. Check Required Environment Variables
const requiredVars = [
  'GOOGLE_CLOUD_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'BUCKET_PREFIX',
  'GEMINI_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

// Initialize express app
const app = express();
let storage; // Declare storage variable in wider scope

// 3. Initialize Firebase Admin and other services
async function initializeServices() {
  try {
    if (!admin.apps.length) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      console.log('Initializing Firebase Admin with:', {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email
      });
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      try {
        const db = admin.firestore();
        await db.collection('_test').doc('permissions').set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          test: true
        });
        console.log('✅ Firestore permissions verified - test write successful');
        
        // Clean up test document
        await db.collection('_test').doc('permissions').delete();
      } catch (firestoreError) {
        console.error('❌ Firestore permissions test failed:', firestoreError.message);
        throw firestoreError;
      }
    

      console.log('Firebase Admin initialized successfully');
    } 

    // Initialize other services
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY);
      
    console.log('Services initialized:', {
      firebase: !!admin.apps.length,
      storage: !!storage,
      gemini: !!genAI
    });

    app.locals.services = {
      admin,
      storage,
      genAI,
      getStorageBucket: (userEmail) => {
        const companyName = getCompanyFromEmail(userEmail);
        const bucketName = `${process.env.BUCKET_PREFIX}-${companyName.toLowerCase()}`;
        return storage.bucket(bucketName);
      }
    };

    return true;
  } catch (error) {
    console.error('Service initialization failed:', error);
    throw error;
  }
}

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log('=== New Request ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Body:', req.body);
  console.log('=================');
  next();
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    time: new Date().toISOString(),
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Server Startup Function
const startServer = async () => {
  try {
    // Initialize services first
    await initializeServices();
    
    console.log('Mounting routes...');
    // Mount routes after services are initialized
    app.use('/api/companies/:companyName/proposals', require('./routes/proposalRoutes'));
    app.use('/api/companies/:companyName', require('./routes/projectRoutes')); 
    app.use('/api', require('./routes/storage'));
    app.use('/api/auth', require('./routes/auth'));

    // Debug endpoints
    app.get('/api/test', (req, res) => {
      res.json({ message: 'API is working' });
    });

    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
      });
    });

    // Create uploads directory
    await fs.mkdir('uploads', { recursive: true });
    console.log('Uploads directory verified');

    // Start server
    const port = await portfinder.getPortPromise({
      port: parseInt(process.env.PORT || '3001', 10)
    });

    app.listen(port, () => {
      console.log('=================================');
      console.log(`Server started successfully`);
      console.log(`Port: ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API URL: http://localhost:${port}/api`);
      console.log('=================================');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;