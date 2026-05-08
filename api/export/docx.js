const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');
const HTMLtoDOCX = require('html-to-docx');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { licenseKey, deviceId, htmlContent } = req.body;

    if (!licenseKey || !deviceId || !htmlContent) {
      return res.status(400).json({ success: false, message: 'Invalid request: Missing required fields' });
    }

    // 1. Verify license and deviceId in Database (Security Check)
    const db = getFirestore();
    const licenseDoc = await db.collection('app_licenses').doc(licenseKey).get();
    
    if (!licenseDoc.exists || licenseDoc.data().status !== 'active') {
      return res.status(403).json({ success: false, message: 'License invalid or not active' });
    }

    const fingerprints = licenseDoc.data().fingerprints || [];
    if (!fingerprints.includes(deviceId)) {
      return res.status(403).json({ success: false, message: 'Thiết bị không hợp lệ hoặc chưa được cấp phép.' });
    }

    // 2. Generate DOCX from HTML
    // We add some basic styling to the HTML if needed
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: "Times New Roman", Times, serif; font-size: 14pt; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 8px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    const fileBuffer = await HTMLtoDOCX(styledHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    // 3. Return the DOCX file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Exported_Document.docx"');
    
    return res.send(fileBuffer);

  } catch (error) {
    console.error('DOCX Export Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during export: ' + error.message });
  }
};
