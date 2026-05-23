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
  try {
    // Lấy danh sách các Product đã được cấu hình Prompt
    const snapshot = await db.collection('app_prompts').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push(doc.id);
    });

    // Nếu chưa có, thêm mặc định
    if (!products.includes('chuyenword')) {
      products.push('chuyenword');
    }
    if (!products.includes('thaycoai_vsto')) {
      products.push('thaycoai_vsto');
    }

    return res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Admin Products Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
