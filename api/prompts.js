const { cors } = require('../lib/cors');
const { validateLicense } = require('../lib/auth');
const { getFirestore } = require('../lib/firebase');

/**
 * POST /api/prompts
 * Body: { licenseKey: string, deviceId: string, productId: string }
 * Response: { success: boolean, prompts?: Record<string, string> }
 * 
 * Only returns prompts if license is valid. This is the core IP protection:
 * prompts are NEVER in the client-side JSX code.
 */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const { licenseKey, userId, productId } = req.body || {};

    // Validate license first
    const authResult = await validateLicense(licenseKey, userId, productId);
    if (!authResult.valid) {
      return res.status(403).json({ success: false, message: authResult.message });
    }

    // Fetch prompts for this product
    const db = getFirestore();
    const promptDoc = await db.collection('app_prompts').doc(productId).get();

    if (!promptDoc.exists) {
      return res.status(404).json({ success: false, message: 'Chưa có prompt cho sản phẩm này.' });
    }

    return res.status(200).json({
      success: true,
      prompts: promptDoc.data()
    });
  } catch (error) {
    console.error('Prompts error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
};
