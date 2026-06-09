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

    // Check product compatibility
    if (data.allowedProducts && Array.isArray(data.allowedProducts)) {
      if (!data.allowedProducts.includes(productId)) {
        return res.status(403).json({ success: false, message: 'Mã kích hoạt không đúng sản phẩm.' });
      }
    } else if (productId && data.productId && data.productId !== productId) {
      return res.status(403).json({ success: false, message: 'Mã kích hoạt không đúng sản phẩm.' });
    }

    const fpKey = productId ? `fingerprints_${productId}` : 'fingerprints';
    let productFingerprints = data[fpKey] || [];
    
    if (productFingerprints.length === 0) {
      const legacyFp = data.fingerprints || [];
      if (legacyFp.length > 0) productFingerprints = legacyFp;
      else if (data.deviceId) productFingerprints = [data.deviceId];
    }

    if (!productFingerprints.includes(deviceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Thiết bị không hợp lệ hoặc chưa được cấp phép.' 
      });
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
        table, th, td { border: 2.25pt solid black; }
        th, td { padding: 6px; vertical-align: middle; text-align: center; }
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
    // BƯỚC 3: HẬU KỲ XML - TRẢ LẠI DẤU $ & ÉP VIỀN BẢNG ĐẬM
    // ============================================================
    const JSZip = require('jszip');
    const docxData = readFileSync(outputPath);
    const zip = await JSZip.loadAsync(docxData);
    const docXmlPath = 'word/document.xml';
    let docXml = await zip.file(docXmlPath).async('string');

    // 3.1 Trả lại dấu $ cho MathType
    if (disableMath) {
      const MATH_MARKER = 'NTSM_DOLLAR_MARKER';
      console.log('[Pandoc-Convert] Swapping markers back to $...');
      docXml = docXml.replace(new RegExp(MATH_MARKER, 'g'), '$');
    }

    // 3.2 PHẪU THUẬT XML: Xử lý ZZZFLOATRIGHTZZZ và ZZZFLOATLEFTZZZ
    console.log('[Pandoc-Convert] Injecting anchors for floats...');
    docXml = docXml.replace(/<w:p\b[^>]*>(.*?)<\/w:p>/gs, (match, pContent) => {
        const markerMatch = match.match(/(ZZZFLOAT(?:RIGHT|LEFT)ZZZ)(?:_W(\d+))?/);
        if (markerMatch) {
            const markerBase = markerMatch[1];
            const widthPct = markerMatch[2] ? parseInt(markerMatch[2], 10) : 0;
            const isLeft = markerBase.includes("LEFT");
            const alignStr = isLeft ? "left" : "right";
            
            let current_y_offset = 0;
            
            let newMatch = match.replace(/<w:drawing>(.*?)<\/w:drawing>/gs, (drawingMatch, drawingContent) => {
                const inlineMatch = drawingContent.match(/<wp:inline[^>]*>(.*?)<\/wp:inline>/s);
                if (!inlineMatch) return drawingMatch;
                
                const inlineContent = inlineMatch[1];
                const extentMatch = inlineContent.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
                if (!extentMatch) return drawingMatch;
                
                let orig_cx = parseInt(extentMatch[1], 10);
                let orig_cy = parseInt(extentMatch[2], 10);
                let cx = orig_cx;
                let cy = orig_cy;
                
                let updatedInlineContent = inlineContent;
                
                if (widthPct > 0) {
                    cx = Math.floor((widthPct / 100.0) * 5943600);
                    cy = orig_cx > 0 ? Math.floor(orig_cy * (cx / orig_cx)) : orig_cy;
                    
                    updatedInlineContent = updatedInlineContent.replace(
                        /<wp:extent\s+cx="\d+"\s+cy="\d+"\s*\/>/, 
                        `<wp:extent cx="${cx}" cy="${cy}"/>`
                    );
                    
                    updatedInlineContent = updatedInlineContent.replace(
                        /<a:ext\s+cx="\d+"\s+cy="\d+"\s*\/>/, 
                        `<a:ext cx="${cx}" cy="${cy}"/>`
                    );
                }
                
                const extentTagMatch = updatedInlineContent.match(/<wp:extent[^>]*\/>/);
                const effectExtentMatch = updatedInlineContent.match(/<wp:effectExtent[^>]*\/>/);
                const docPrMatch = updatedInlineContent.match(/<wp:docPr[^>]*\/>/);
                const cNvGraphicFramePrMatch = updatedInlineContent.match(/<wp:cNvGraphicFramePr>.*?<\/wp:cNvGraphicFramePr>/s) || updatedInlineContent.match(/<wp:cNvGraphicFramePr[^>]*\/>/s);
                const graphicMatch = updatedInlineContent.match(/<a:graphic[^>]*>.*?<\/a:graphic>/s);
                
                const extentTag = extentTagMatch ? extentTagMatch[0] : '';
                const effectExtentTag = effectExtentMatch ? effectExtentMatch[0] : '';
                const docPrTag = docPrMatch ? docPrMatch[0] : '';
                const cNvGraphicFramePrTag = cNvGraphicFramePrMatch ? cNvGraphicFramePrMatch[0] : '';
                const graphicTag = graphicMatch ? graphicMatch[0] : '';
                
                const anchorXml = `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:align>${alignStr}</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${current_y_offset}</wp:posOffset></wp:positionV>${extentTag}${effectExtentTag}<wp:wrapSquare wrapText="bothSides"/>${docPrTag}${cNvGraphicFramePrTag}${graphicTag}</wp:anchor>`;
                
                current_y_offset += cy + 127000;
                
                return `<w:drawing>${anchorXml}</w:drawing>`;
            });
            
            newMatch = newMatch.replace(/<w:t[^>]*>.*?<\/w:t>/gs, '');
            return newMatch;
        }
        return match;
    });

    // 3.3 PHẪU THUẬT XML: Xử lý Border bảng (Có viền cho bảng thường, Không viền cho bảng HEADER/LAYOUT)
    console.log('[Pandoc-Convert] Formatting tables...');
    
    docXml = docXml.replace(/<w:tbl\b[^>]*>.*?<\/w:tbl>/gs, (tblMatch) => {
      let isHeaderOrLayout = false;
      let newTblMatch = tblMatch;
      
      if (tblMatch.includes('ZZZHEADERZZZ')) {
        isHeaderOrLayout = true;
        newTblMatch = newTblMatch.replace(/<w:t[^>]*>.*?<\/w:t>/gs, (tMatch) => {
           if(tMatch.includes('ZZZHEADERZZZ')) return tMatch.replace('ZZZHEADERZZZ', '');
           return tMatch;
        });
      }
      
      if (tblMatch.includes('ZZZLAYOUTZZZ')) {
        isHeaderOrLayout = true;
        newTblMatch = newTblMatch.replace(/<w:t[^>]*>.*?<\/w:t>/gs, (tMatch) => {
           if(tMatch.includes('ZZZLAYOUTZZZ')) return tMatch.replace('ZZZLAYOUTZZZ', '');
           return tMatch;
        });
      }

      if (isHeaderOrLayout) {
        const noBorders = `<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders>`;
        newTblMatch = newTblMatch.replace(/<w:tblPr>(.*?)<\/w:tblPr>/s, (m, content) => {
          let c = content.replace(/<w:tblBorders>.*?<\/w:tblBorders>/gs, '');
          c = c.replace(/<w:jc[^>]+>/gs, '');
          return `<w:tblPr>${c}<w:jc w:val="center"/>${noBorders}</w:tblPr>`;
        });
      } else {
        const thickBorders = `<w:tblBorders><w:top w:val="single" w:sz="18" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="18" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="18" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="18" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="18" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="18" w:space="0" w:color="auto"/></w:tblBorders>`;
        newTblMatch = newTblMatch.replace(/<w:tblPr>(.*?)<\/w:tblPr>/s, (m, content) => {
          let c = content.replace(/<w:tblBorders>.*?<\/w:tblBorders>/gs, '');
          c = c.replace(/<w:jc[^>]+>/gs, '');
          return `<w:tblPr>${c}<w:jc w:val="center"/>${thickBorders}</w:tblPr>`;
        });
      }
      return newTblMatch;
    });

    // Ép căn giữa cho nội dung trong ô (Cell Paragraph Justification)
    docXml = docXml.replace(/<w:tc>(.*?)<\/w:tc>/gs, (match, cellContent) => {
      // 1. Căn ngang (Paragraph jc)
      let updatedCell = cellContent.replace(/<w:pPr>(.*?)<\/w:pPr>/gs, (m, pPrContent) => {
        let newPpr = pPrContent.replace(/<w:jc[^>]+>/gs, '');
        return `<w:pPr>${newPpr}<w:jc w:val="center"/></w:pPr>`;
      });
      // 2. Căn dọc (Cell vAlign)
      updatedCell = updatedCell.replace(/<w:tcPr>(.*?)<\/w:tcPr>/gs, (m, tcPrContent) => {
        let newTcPr = tcPrContent.replace(/<w:vAlign[^>]+>/gs, '');
        return `<w:tcPr>${newTcPr}<w:vAlign w:val="center"/></w:tcPr>`;
      });
      return `<w:tc>${updatedCell}</w:tc>`;
    });

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
