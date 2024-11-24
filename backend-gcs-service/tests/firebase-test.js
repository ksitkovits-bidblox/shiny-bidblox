// tests/firebase-test.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function testFirestore() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require('../config/serviceAccountKey.json');
    
    initializeApp({
      credential: cert(serviceAccount)
    });
    
    const db = getFirestore();
    
    // Try to write a test document
    const testRef = db.collection('test').doc('test');
    await testRef.set({
      test: 'This is a test',
      timestamp: new Date()
    });
    
    console.log('Successfully connected to Firestore and wrote test document');
    
    // Clean up
    await testRef.delete();
    console.log('Successfully cleaned up test document');
    
  } catch (error) {
    console.error('Error testing Firestore connection:', error);
  }
}

testFirestore();