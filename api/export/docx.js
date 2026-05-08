const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const { createConversionContext, markdownToOoxml } = require('../../lib/ooxmlParser');

async function injectMediaToZip(zip, ooxml, ctx) {
  if (ctx.pendingImages.size === 0) return ooxml;

  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  
  const relsFile = zip.file(relsPath);
  if (relsFile) {
    relsXml = await relsFile.async('string');
  }
  
  let updatedOoxml = ooxml;
  let rIdCounter = 1000; 

  for (const [placeholderId, base64] of ctx.pendingImages.entries()) {
      const rId = `rId${rIdCounter++}`;
      const fileName = `media/md_img_${placeholderId}.png`; 
      
      zip.file(`word/${fileName}`, base64, { base64: true });
      
      const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${fileName}"/>`;
      relsXml = relsXml.replace('</Relationships>', `${newRel}\n</Relationships>`);
      
      updatedOoxml = updatedOoxml.split(`r:embed="${placeholderId}"`).join(`r:embed="${rId}"`);
  }
  
  zip.file(relsPath, relsXml);

  const ctPath = '[Content_Types].xml';
  const ctFile = zip.file(ctPath);
  if (ctFile) {
      let ctXml = await ctFile.async('string');
      if (!ctXml.includes('Extension="png"')) {
          ctXml = ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
          zip.file(ctPath, ctXml);
      }
  }
  
  return updatedOoxml;
}

module.exports = async function handler(req, res) {
  // 0. Handle CORS
  if (cors(req, res)) return;

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { licenseKey, deviceId, markdownContent, images, htmlContent } = req.body;

    if (!licenseKey || !deviceId || (!markdownContent && !htmlContent)) {
      return res.status(400).json({ success: false, message: 'Yêu cầu không hợp lệ: Thiếu nội dung hoặc mã bản quyền.' });
    }

    // 1. Verify license and deviceId in Database
    const db = getFirestore();
    const licenseDoc = await db.collection('app_licenses').doc(licenseKey).get();
    
    if (!licenseDoc.exists || licenseDoc.data().status !== 'active') {
      return res.status(403).json({ success: false, message: 'License invalid or not active' });
    }

    const fingerprints = licenseDoc.data().fingerprints || [];
    if (!fingerprints.includes(deviceId)) {
      return res.status(403).json({ success: false, message: 'Thiết bị không hợp lệ hoặc chưa được cấp phép.' });
    }

    // 2. Load reference.docx template (Dùng đường dẫn tương đối để chạy được trên Vercel/Hosting)
    const templatePath = path.join(process.cwd(), 'reference.docx');
    let templateData;
    if (fs.existsSync(templatePath)) {
      templateData = fs.readFileSync(templatePath);
    } else {
      // Fallback
      templateData = fs.readFileSync(path.join(__dirname, 'reference.docx'));
    }

    const zip = await JSZip.loadAsync(templateData);

    // 3. Process Images: we need to replace [IMG_...] or [HÌNH ẢNH...] in markdown with base64 before parsing
    let processedMarkdown = markdownContent;
    if (images) {
      // Regex hỗ trợ cả [IMG_...], [IMG_BBOX: ...] và [HÌNH ẢNH MINH HOẠ: IMG_...]
      const imgRegex = /\[(?:HÌNH [ẢA]NH MINH H[OỌ][ẠA]:\s*)?(IMG_(?:BBOX[:_])?[\d,\s]+|IMG_[^\]]+)\]/gi;
      processedMarkdown = processedMarkdown.replace(imgRegex, (match, imageId) => {
        // Đảm bảo imageId có prefix IMG_ nếu user chỉ ghi số
        const fullId = imageId.startsWith('IMG_') ? imageId : `IMG_${imageId}`;
        if (images[fullId]) {
          return `\n\n![${fullId}](${images[fullId]})\n\n`;
        }
        return `\n\n[Lỗi ảnh ${fullId}]\n\n`;
      });
    }

    // 4. Convert Markdown to OOXML
    const ctx = createConversionContext();
    const ooxmlContent = markdownToOoxml(processedMarkdown, ctx);

    // 5. Inject Images
    const finalOoxml = await injectMediaToZip(zip, ooxmlContent, ctx);

    // 6. Inject OOXML into document.xml
    const docFile = zip.file('word/document.xml');
    if (docFile) {
        let docXml = await docFile.async('string');
        
        // Find [NOI_DUNG_CHINH] and replace it. If not found, inject before </w:body>
        if (docXml.includes('[NOI_DUNG_CHINH]')) {
          // Replace it with finalOoxml
          // First, we need to find the <w:p> containing it
          docXml = docXml.replace(/<w:p[^>]*>.*?\[NOI_DUNG_CHINH\].*?<\/w:p>/, finalOoxml);
        } else {
          docXml = docXml.replace('</w:body>', finalOoxml + '</w:body>');
        }

        // Add namespaces
        const namespaces = [
          'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
          'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
          'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
        ];
        namespaces.forEach(ns => {
            const prefix = ns.split('=')[0];
            if (!docXml.includes(prefix)) {
                docXml = docXml.replace('<w:document ', `<w:document ${ns} `);
            }
        });
        
        zip.file('word/document.xml', docXml);
    }

    // 7. Auto Update Table of Contents
    const settingsFile = zip.file('word/settings.xml');
    if (settingsFile) {
        let settingsXml = await settingsFile.async('string');
        if (!settingsXml.includes('w:updateFields')) {
            settingsXml = settingsXml.replace('</w:settings>', '<w:updateFields w:val="true"/></w:settings>');
            zip.file('word/settings.xml', settingsXml);
        }
    }

    // 8. Generate DOCX Buffer
    const fileBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Exported_Document.docx"');
    
    return res.send(fileBuffer);

  } catch (error) {
    console.error('DOCX Export Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during export: ' + error.message });
  }
};
