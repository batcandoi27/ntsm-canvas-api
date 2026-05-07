const { cors } = require('../lib/cors');
const { validateLicense } = require('../lib/auth');

/**
 * POST /api/validate
 * Body: { licenseKey: string, deviceId: string, productId: string, linkEmail?: string }
 * Response: { valid: boolean, message: string, expiresAt?: string, isNewEmailLinked?: boolean }
 */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const { licenseKey, deviceId, productId, linkEmail } = req.body || {};
    const result = await validateLicense(licenseKey, deviceId, productId, linkEmail);
    return res.status(result.valid ? 200 : 403).json(result);
  } catch (error) {
    console.error('Validate error:', error);
    return res.status(500).json({ valid: false, message: 'Lỗi máy chủ: ' + error.message });
  }
};
