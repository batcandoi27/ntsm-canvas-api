const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');
const JSZip = require('jszip');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { licenseKey, deviceId, markdownContent, images } = req.body;

    if (!licenseKey || !deviceId || !markdownContent) {
      return res.status(400).json({ success: false, message: 'Invalid request: Missing required fields' });
    }

    const db = getFirestore();
    const licenseDoc = await db.collection('app_licenses').doc(licenseKey).get();
    
    if (!licenseDoc.exists || licenseDoc.data().status !== 'active') {
      return res.status(403).json({ success: false, message: 'License invalid or not active' });
    }

    const fingerprints = licenseDoc.data().fingerprints || [];
    if (!fingerprints.includes(deviceId)) {
      return res.status(403).json({ success: false, message: 'Thiết bị không hợp lệ hoặc chưa được cấp phép.' });
    }

    const zip = new JSZip();
    const imgFolder = zip.folder("images");

    let mdText = markdownContent;
    
    if (images) {
      const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
      mdText = mdText.replace(imgRegex, (match, imageId) => {
        if (images[imageId]) {
          const base64Data = images[imageId].split(',')[1];
          imgFolder.file(`${imageId}.png`, base64Data, {base64: true});
          return `\n\n![](images/${imageId}.png)\n\n`;
        }
        return `\n\n[Lỗi ảnh]\n\n`;
      });
    }

    zip.file("TaiLieu.md", mdText);

    const fileBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="TaiLieu_Pandoc.zip"');
    
    return res.send(fileBuffer);

  } catch (error) {
    console.error('Pandoc Export Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during export: ' + error.message });
  }
};
