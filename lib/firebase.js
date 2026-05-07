const admin = require('firebase-admin');

let app;

function getFirestore() {
  if (!app) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'ntsmprotoan'
    });
  }
  return admin.firestore();
}

module.exports = { getFirestore };
