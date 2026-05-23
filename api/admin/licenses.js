const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');

const verifyAdmin = (req) => {
  const password = req.headers['x-admin-password'];
  const adminPassword = process.env.ADMIN_PASSWORD || 'batcandoi27';
  return password === adminPassword;
};

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (!verifyAdmin(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const db = getFirestore();
  const licensesRef = db.collection('app_licenses');

  try {
    if (req.method === 'GET') {
      const { productId } = req.query;
      let query = licensesRef;
      if (productId && productId !== 'all') {
        query = query.where('productId', '==', productId);
      }
      
      const snapshot = await query.get();
      const licenses = [];
      snapshot.forEach(doc => {
        licenses.push({ id: doc.id, ...doc.data() });
      });

      // Sort in memory to avoid Firestore composite index requirement
      licenses.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      return res.status(200).json({ success: true, licenses });
    }

    if (req.method === 'POST') {
      const { count, productId, prefix, expiresAt } = req.body;
      const numToGenerate = parseInt(count) || 1;
      
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ứng dụng' });
      }

      const generated = [];
      const batch = db.batch();

      for (let i = 0; i < numToGenerate; i++) {
        const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
        const key = `${prefix ? prefix + '-' : ''}${productId.toUpperCase()}-${randomStr}`;
        const newDoc = licensesRef.doc(key);
        
        const payload = {
          productId,
          allowedProducts: [productId], // Giới hạn key mới CHỈ dùng được cho product này
          status: 'inactive',
          loginCount: 0,
          fingerprints: [],
          email: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (expiresAt) {
          payload.expiresAt = new Date(expiresAt).toISOString();
        }

        batch.set(newDoc, payload);
        generated.push({ id: key, ...payload });
      }

      await batch.commit();
      return res.status(200).json({ success: true, generated });
    }

    if (req.method === 'PUT') {
      const { id, action, ...data } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'Missing ID' });

      const docRef = licensesRef.doc(id);
      
      if (action === 'reset_device') {
        await docRef.update({
          fingerprints: [],
          deviceId: null,
          updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ success: true, message: 'Đã xóa thiết bị, khách hàng có thể dùng trên máy mới' });
      }

      if (action === 'revoke') {
        await docRef.update({
          status: 'revoked',
          updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ success: true, message: 'Đã khóa mã' });
      }

      if (action === 'activate') {
        await docRef.update({
          status: 'active',
          updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ success: true, message: 'Đã mở khóa mã' });
      }

      if (action === 'update') {
        await docRef.update({
          ...data,
          updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ success: true, message: 'Cập nhật thành công' });
      }

      return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, message: 'Missing ID' });

      await licensesRef.doc(id).delete();
      return res.status(200).json({ success: true, message: 'Đã xóa mã' });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
