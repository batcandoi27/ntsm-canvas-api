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
    const { licenseKey, deviceId, productId } = req.body || {};

    // Validate license first
    const authResult = await validateLicense(licenseKey, deviceId, productId);
    if (!authResult.valid) {
      return res.status(403).json({ success: false, message: authResult.message });
    }

    const db = getFirestore();
    const promptDoc = await db.collection('app_prompts').doc(productId).get();

    if (!promptDoc.exists) {
      return res.status(404).json({ success: false, message: 'Chưa có prompt cho sản phẩm này.' });
    }

    const rawData = promptDoc.data();
    
    // ============================================================
    // JIT RE-ENCRYPTION: Mã hóa AES-256-GCM dành riêng cho Client
    // Chìa khóa = licenseKey + deviceId
    // Server đọc cipher từ DB (đã mã hóa bằng MASTER_KEY), giải mã
    // sau đó mã hóa lại bằng chìa khóa riêng của client.
    // ============================================================
    const crypto = require('crypto');
    const AES_MASTER_KEY = 'NTSM_CHUYENWORD_AES256_MASTER_2026';
    
    function getDerivedKey(password) {
      return crypto.pbkdf2Sync(password, 'ntsm_salt_v4', 100000, 32, 'sha256');
    }

    const masterKeyBuf = getDerivedKey(AES_MASTER_KEY);

    // Key cho Client cụ thể
    const clientSecret = licenseKey + '_' + deviceId;
    const clientKeyBuf = getDerivedKey(clientSecret);

    const securePrompts = {};

    for (const [key, value] of Object.entries(rawData)) {
      if (key.endsWith('_cipher')) {
        // 1. Giải mã từ DB
        const parts = value.split(':');
        if (parts.length === 3) {
          try {
            const iv = Buffer.from(parts[0], 'base64');
            const authTag = Buffer.from(parts[1], 'base64');
            const encryptedText = Buffer.from(parts[2], 'base64');
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', masterKeyBuf, iv);
            decipher.setAuthTag(authTag);
            let plainText = decipher.update(encryptedText, 'base64', 'utf8');
            plainText += decipher.final('utf8');

            // 2. Mã hóa lại cho Client
            const newIv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv('aes-256-gcm', clientKeyBuf, newIv);
            let newEncrypted = cipher.update(plainText, 'utf8', 'base64');
            newEncrypted += cipher.final('base64');
            const newAuthTag = cipher.getAuthTag();

            const finalKey = key.replace('_cipher', '');
            securePrompts[finalKey] = `${newIv.toString('base64')}:${newAuthTag.toString('base64')}:${newEncrypted}`;
          } catch (e) {
            console.error('Decryption/Encryption error for key:', key, e);
          }
        }
      }
    }

    // Nếu không có _cipher (backward compatibility), dùng Base64 tĩnh
    if (Object.keys(securePrompts).length === 0) {
      for (const [key, value] of Object.entries(rawData)) {
         if (!key.endsWith('_readable') && !key.endsWith('_cipher') && key !== 'updatedAt') {
           // Giả lập cipher bằng plain text (fallback)
           let plain = "";
           try { plain = Buffer.from(value, 'base64').toString('utf8'); } catch(e) { plain = value; }
           
           const newIv = crypto.randomBytes(12);
           const cipher = crypto.createCipheriv('aes-256-gcm', clientKeyBuf, newIv);
           let newEncrypted = cipher.update(plain, 'utf8', 'base64');
           newEncrypted += cipher.final('base64');
           const newAuthTag = cipher.getAuthTag();
           securePrompts[key] = `${newIv.toString('base64')}:${newAuthTag.toString('base64')}:${newEncrypted}`;
         }
      }
    }

    return res.status(200).json({
      success: true,
      prompts: securePrompts
    });
  } catch (error) {
    console.error('Prompts error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
};
