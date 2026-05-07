const { cors } = require('../lib/cors');
const { validateLicense } = require('../lib/auth');

/**
 * POST /api/validate
 * Body: { licenseKey: string, deviceId: string, productId: string }
 * Response: { valid: boolean, message: string, expiresAt?: string }
 */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const { licenseKey, deviceId, productId } = req.body || {};
    const result = await validateLicense(licenseKey, deviceId, productId);
    return res.status(result.valid ? 200 : 403).json(result);
  } catch (error) {
    console.error('Validate error:', error);
    return res.status(500).json({ valid: false, message: 'Lỗi máy chủ: ' + error.message });
  }
};
