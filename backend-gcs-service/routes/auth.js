// backend-gcs-service/routes/auth.js
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    // Create or get Firebase user
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(payload.email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new Firebase user
        firebaseUser = await admin.auth().createUser({
          email: payload.email,
          displayName: payload.name,
          photoURL: payload.picture
        });
        
        console.log('Created new Firebase user:', firebaseUser.uid);
      } else {
        throw error;
      }
    }

    // Set or update custom claims if user has a company
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(firebaseUser.uid)
      .get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.companyName) {
        await admin.auth().setCustomUserClaims(firebaseUser.uid, {
          companyName: userData.companyName
        });
        console.log('Updated custom claims for user:', {
          uid: firebaseUser.uid,
          company: userData.companyName
        });
      }
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(firebaseUser.uid);
    
    res.json({ 
      token: customToken,
      user: {
        uid: firebaseUser.uid,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

router.post('/company', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userData = req.body;
    const companyId = userData.organizationId;
    
    const batch = admin.firestore().batch();

    // Update user in main users collection
    const userRef = admin.firestore().collection('users').doc(decodedToken.uid);
    batch.set(userRef, {
      ...userData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Update user in company subcollection
    const companyUserRef = admin.firestore()
      .collection('companies')
      .doc(companyId)
      .collection('users')
      .doc(decodedToken.uid);

    batch.set(companyUserRef, {
      ...userData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    await admin.auth().setCustomUserClaims(decodedToken.uid, {
      companyId,
      companyName: userData.companyName,
      role: userData.role
    });

    res.json({ 
      message: 'Profile updated successfully',
      profile: userData
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync-claims', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
      
    // Get the user's Firestore data
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Update claims to match Firestore data
    await admin.auth().setCustomUserClaims(decodedToken.uid, {
      companyName: userData.companyName
    });

    res.json({ 
      message: 'Claims synchronized successfully',
      company: userData.companyName
    });
  } catch (error) {
    console.error('Claims sync error:', error);
    res.status(500).json({ error: 'Failed to sync claims' });
  }
});

// Add a debug endpoint to help troubleshoot
router.get('/debug-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Get user record
    const [userDoc, userRecord] = await Promise.all([
      admin.firestore().collection('users').doc(decodedToken.uid).get(),
      admin.auth().getUser(decodedToken.uid)
    ]);

    res.json({
      firestoreData: userDoc.exists ? userDoc.data() : null,
      authData: {
        customClaims: userRecord.customClaims,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified
      }
    });

  } catch (error) {
    console.error('Debug profile error:', error);
    res.status(500).json({ 
      error: 'Failed to get debug info',
      details: error.message 
    });
  }
});


module.exports = router;