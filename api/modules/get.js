const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');
const crypto = require('crypto');

// Raw module codes
const MODULES = {
  mcq_and_crop: `
// --- MODULE: MCQ & CROP IMAGE ---
self.onmessage = async function(e) {
  try {
    const { action, payload, id } = e.data;
    
    if (action === 'formatMultipleChoice') {
      let text = payload.text;
      
      // -- LOGIC FORMAT MCQ BÍ MẬT --
      text = text.replace(/Câu\\s*\\d+[:.]/gi, (match) => '\\n\\n**' + match.toUpperCase() + '**');
      text = text.replace(/\\n\\s*(A\\.|B\\.|C\\.|D\\.)/gi, (match) => '\\n' + match.trim());
      
      const lines = text.split('\\n');
      const formattedLines = [];
      let currentQuestion = [];
      let isAnswerSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/\\*\\*Câu\\s*\\d+[:.]\\*\\*/i)) {
          isAnswerSection = false;
        } else if (line.match(/^(A\\.|B\\.|C\\.|D\\.)/i)) {
          isAnswerSection = true;
        }
        
        if (isAnswerSection && line.match(/^(A\\.|B\\.|C\\.|D\\.)/i)) {
          formattedLines.push('**' + line.trim() + '**');
        } else {
          formattedLines.push(line);
        }
      }
      
      self.postMessage({ id, success: true, result: formattedLines.join('\\n') });
    } 
    
    else if (action === 'cropImages') {
      const { text, imageUrl, globalIdx } = payload;
      const regex = /\\[IMG_BBOX:\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)\\]/g;
      let match;
      let imgCount = 0;
      let newText = text;
      const extractedImages = {};

      // Load image data from base64 or URL via fetch
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);

      while ((match = regex.exec(text)) !== null) {
        const ymin = parseInt(match[1], 10);
        const xmin = parseInt(match[2], 10);
        const ymax = parseInt(match[3], 10);
        const xmax = parseInt(match[4], 10);
        
        const sX = (xmin / 1000) * imgBitmap.width;
        const sY = (ymin / 1000) * imgBitmap.height;
        const sW = ((xmax - xmin) / 1000) * imgBitmap.width;
        const sH = ((ymax - ymin) / 1000) * imgBitmap.height;

        const offscreen = new OffscreenCanvas(sW, sH);
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(imgBitmap, sX, sY, sW, sH, 0, 0, sW, sH);
        
        const outBlob = await offscreen.convertToBlob();
        const reader = new FileReaderSync();
        const base64Data = reader.readAsDataURL(outBlob);

        const imageId = \`IMG_P\${globalIdx}_\${imgCount}\`;
        extractedImages[imageId] = base64Data;
        newText = newText.replace(match[0], \`\\n[HÌNH ẢNH MINH HOẠ: \${imageId}]\\n\`);
        imgCount++;
      }

      self.postMessage({ id, success: true, result: { newText, extractedImages } });
    }
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
  `
};

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { licenseKey, moduleId } = req.body;

    if (!licenseKey || !moduleId || !MODULES[moduleId]) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // 1. Verify license in Database
    const db = getFirestore();
    const licenseDoc = await db.collection('app_licenses').doc(licenseKey).get();
    
    if (!licenseDoc.exists || licenseDoc.data().status !== 'active') {
      return res.status(403).json({ success: false, message: 'License invalid or not active' });
    }

    // 2. Encryption logic
    const code = MODULES[moduleId];
    
    // Generate random Salt and IV
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // GCM standard IV size

    // Derive key using PBKDF2 (100,000 iterations, SHA-256)
    const key = crypto.pbkdf2Sync(licenseKey, salt, 100000, 32, 'sha256');

    // Encrypt using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(code, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    // Checksum of the original code for integrity verification
    const checksum = crypto.createHash('sha256').update(code).digest('hex');

    return res.status(200).json({
      success: true,
      version: '1.0',
      moduleId,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag,
      payload: encrypted,
      checksum
    });

  } catch (error) {
    console.error('Module Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
