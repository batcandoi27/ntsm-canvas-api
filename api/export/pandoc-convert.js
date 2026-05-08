const { cors } = require('../../lib/cors');
const { getFirestore } = require('../../lib/firebase');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeFileSync, unlinkSync, existsSync, readFileSync, createWriteStream, chmodSync, statSync } = fs;
const { join } = path;
const { tmpdir } = require('os');
const https = require('https');
const tar = require('tar');

// ===================== PANDOC BINARY SETUP =====================
const PANDOC_VERSION = '3.1.11.1'; 
const PANDOC_URL = `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz`;
const pandocPath = join(tmpdir(), 'pandoc');

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                if (response.headers.location) {
                    downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                    return;
                }
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed with status: ${response.statusCode}`));
                return;
            }
            const file = createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (err) => { try { unlinkSync(dest); } catch(e) {} reject(err); });
        });
        request.on('error', (err) => { try { unlinkSync(dest); } catch(e) {} reject(err); });
    });
};

const ensurePandoc = async () => {
    if (existsSync(pandocPath)) {
        try {
            const stats = statSync(pandocPath);
            if (stats.size > 0) return; 
        } catch (e) {}
    }

    console.log(`[Pandoc] Installing version ${PANDOC_VERSION}...`);
    const tarPath = join(tmpdir(), 'pandoc.tar.gz');
    
    try {
        await downloadFile(PANDOC_URL, tarPath);
        await tar.x({ file: tarPath, cwd: tmpdir(), strip: 2, filter: (path) => path.endsWith('/bin/pandoc') });
        if (existsSync(pandocPath)) {
            chmodSync(pandocPath, '755');
        } else {
            throw new Error("Pandoc binary missing after extraction.");
        }
    } catch (e) {
        console.error("[Pandoc] Install Error:", e);
        throw e;
    } finally {
        if (existsSync(tarPath)) { try { unlinkSync(tarPath); } catch(e) {} }
    }
};

const sanitizeFilename = (name) => {
    if (!name) return 'document.docx';
    let str = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    str = str.replace(/[^a-zA-Z0-9\.]/g, '_');
    str = str.replace(/_+/g, '_');
    if (!str.toLowerCase().endsWith('.docx')) str += '.docx';
    return str || 'document.docx';
};

// ===================== API HANDLER =====================

/**
 * POST /api/export/pandoc-convert
 * 
 * Chuyển đổi HTML → DOCX bằng Pandoc binary thực sự
 * (Hỗ trợ $...$ LaTeX → Equation trong Word)
 * 
 * Có kiểm tra bảo mật license + deviceId trước khi cho phép xuất.
 * 
 * Body: {
 *   licenseKey: string,
 *   deviceId: string,
 *   productId?: string,
 *   html: string,
 *   filename?: string
 * }
 */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const timestamp = Date.now();
  const inputPath = join(tmpdir(), `input_${timestamp}.html`);
  const outputPath = join(tmpdir(), `output_${timestamp}.docx`);

  try {
    const { licenseKey, deviceId, productId, html, filename } = req.body || {};

    // ============================================================
    // BƯỚC 1: Kiểm tra bảo mật — License + Device Fingerprint
    // ============================================================
    if (!licenseKey || !deviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin xác thực (licenseKey hoặc deviceId).' 
      });
    }

    if (!html || html.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu nội dung HTML để chuyển đổi.' 
      });
    }

    const db = getFirestore();

    // Tìm license theo key hoặc email
    let licenseDoc = null;
    let licenseRef = db.collection('app_licenses').doc(licenseKey);
    licenseDoc = await licenseRef.get();

    if (!licenseDoc.exists) {
      const emailQuery = await db.collection('app_licenses')
        .where('email', '==', licenseKey.toLowerCase())
        .limit(1)
        .get();
      
      if (!emailQuery.empty) {
        licenseDoc = emailQuery.docs[0];
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'Mã kích hoạt hoặc Email không tồn tại.' 
        });
      }
    }

    const data = licenseDoc.data();

    if (data.status === 'revoked' || data.status === 'expired') {
      return res.status(403).json({ 
        success: false, 
        message: `Mã kích hoạt đã ${data.status === 'revoked' ? 'bị thu hồi' : 'hết hạn'}.` 
      });
    }

    if (data.expiresAt) {
      const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      if (expiresAt < new Date()) {
        return res.status(403).json({ success: false, message: 'Mã kích hoạt đã hết hạn.' });
      }
    }

    const fingerprints = data.fingerprints || [];
    if (data.deviceId && fingerprints.length === 0) {
      fingerprints.push(data.deviceId);
    }
    
    if (!fingerprints.includes(deviceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Thiết bị không hợp lệ hoặc chưa được cấp phép.' 
      });
    }

    if (productId && data.productId && data.productId !== productId) {
      return res.status(403).json({ success: false, message: 'Mã kích hoạt không đúng sản phẩm.' });
    }

    // ============================================================
    // BƯỚC 2: Cài đặt Pandoc (nếu chưa có) & Chuyển đổi
    // ============================================================
    console.log(`[Pandoc-Convert] Request from license: ${licenseKey.substring(0, 8)}...`);
    await ensurePandoc();

    const safeFilename = sanitizeFilename(filename);
    const { disableMath } = req.body || {};

    // Cấu hình CSS để Pandoc nhận diện: Font Times New Roman + Bảng có viền đơn black
    const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.1; }
        p { margin: 0 !important; padding: 0 !important; line-height: 1.1; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0 !important; }
        table, th, td { border: 1.5pt solid black; }
        th, td { padding: 4px; vertical-align: middle; text-align: center; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
    `;

    // Ghi file HTML tạm (Dữ liệu đã được Client làm sạch và đánh tráo dấu $)
    writeFileSync(inputPath, styledHtml);

    // KEY: Dùng file reference.docx để ép Font và Style
    const referencePath = path.resolve('reference.docx');
    
    // Xử lý Format: Nếu disableMath, dùng flag trừ (-) để tắt toán học
    const fromFormat = disableMath 
      ? 'html-tex_math_dollars-tex_math_single_backslash-tex_math_double_backslash' 
      : 'html+tex_math_dollars+tex_math_single_backslash';

    const pandocArgs = [
        inputPath,
        '-f', fromFormat, 
        '-t', 'docx',
        '--standalone',
        '-o', outputPath
    ];

    if (fs.existsSync(referencePath)) {
        pandocArgs.push('--reference-doc', referencePath);
    }

    execFileSync(pandocPath, pandocArgs);

    // ============================================================
    // BƯỚC 3: HẬU KỲ XML - TRẢ LẠI DẤU $ CHO MATHTYPE
    // ============================================================
    const JSZip = require('jszip');
    const docxData = readFileSync(outputPath);
    const zip = await JSZip.loadAsync(docxData);
    const docXmlPath = 'word/document.xml';
    let docXml = await zip.file(docXmlPath).async('string');

    if (disableMath) {
      const MATH_MARKER = 'NTSM_DOLLAR_MARKER';
      console.log('[Pandoc-Convert] Swapping markers back to $ for MathType...');
      // Thay ngược lại marker thành dấu $ trong file Word cuối cùng
      docXml = docXml.replace(new RegExp(MATH_MARKER, 'g'), '$');
    }

    // KHÔNG xóa <w:p> nữa để tránh hỏng file, chỉ xử lý Text
    zip.file(docXmlPath, docXml);
    const finalBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    console.log('[Pandoc-Convert] Success.');

    // ============================================================
    // BƯỚC 4: Trả file DOCX đã qua xử lý an toàn
    // ============================================================
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
    return res.send(finalBuffer);

  } catch (error) {
    console.error('[Pandoc-Convert] Fatal Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ khi chuyển đổi: ' + error.message 
    });
  } finally {
    // Dọn dẹp file tạm
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(outputPath)) unlinkSync(outputPath);
    } catch (e) {}
  }
};
