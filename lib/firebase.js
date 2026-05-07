const admin = require('firebase-admin');

let app;

function getFirestore() {
  if (!app) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set!');
      }
      const serviceAccount = JSON.parse(raw);
      
      // Fix: Vercel sometimes escapes \n in private_key as literal \\n
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'ntsmprotoan'
      });
      console.log('Firebase Admin initialized OK');
    } catch (err) {
      console.error('Firebase init error:', err.message);
      throw err;
    }
  }
  return admin.firestore();
}

module.exports = { getFirestore };

