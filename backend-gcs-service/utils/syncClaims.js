const admin = require('firebase-admin');

async function syncUserClaims(userId) {
  try {
    // Get user data from Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    
    if (!userData.companyName) {
      throw new Error('User has no company name in Firestore');
    }

    // Set custom claims
    const claims = {
      companyName: userData.companyName,
      businessType: userData.businessType || null,
      derpartment: userData.derpartment || null,
      role: userData.role || 'user'
    };

    await admin.auth().setCustomUserClaims(userId, claims);

    console.log('Successfully synced claims for user:', {
      uid: userId,
      claims
    });

    return claims;
  } catch (error) {
    console.error('Error in syncUserClaims:', error);
    throw error;
  }
}

module.exports = { syncUserClaims };