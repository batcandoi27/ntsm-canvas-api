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
    
    const latexHeader = `\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[vietnamese]{babel}\n\\usepackage{amsmath, amssymb, mathrsfs}\n\\usepackage{graphicx}\n\\usepackage{tabularx}\n\\usepackage{geometry}\n\\geometry{a4paper, margin=2cm}\n\\begin{document}\n\n`;
    const latexFooter = `\n\n\\end{document}`;
    
    let tempText = markdownContent;
    
    // Markdown Table to LaTeX
    tempText = tempText.replace(/(?:^|\n)([ \t]*\|.*\|[ \t]*(?:\n[ \t]*\|.*\|[ \t]*)+)/g, (match, tableBlock) => {
        const lines = tableBlock.trim().split('\n');
        if (lines.length < 2) return match;
        const hasSeparator = /^[ \-\:|]+$/.test(lines[1].trim());
        let dataLines = lines;
        if (hasSeparator) dataLines = lines.filter((_, idx) => idx !== 1);
        const colCount = dataLines[0].split('|').filter(c => c.trim() !== '').length;
        const colFormat = Array(colCount).fill('c').join('|');
        let latexTable = `\n\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{|${colFormat}|}\n\\hline\n`;
        dataLines.forEach(line => {
            const cells = line.split('|').filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);
            latexTable += cells.map(c => c.trim()).join(' & ') + ' \\\\\n\\hline\n';
        });
        latexTable += `\\end{tabular}\n\\end{table}\n`;
        return latexTable;
    });

    tempText = tempText.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
    tempText = tempText.replace(/\*(.*?)\*/g, '\\textit{$1}');
    
    if (images) {
        const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
        tempText = tempText.replace(imgRegex, (match, imageId) => {
          if (images[imageId]) {
            const base64Data = images[imageId].split(',')[1];
            imgFolder.file(`${imageId}.png`, base64Data, {base64: true});
            return `\n\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.6\\textwidth]{images/${imageId}.png}\n  \\caption{Hình ảnh minh họa}\n\\end{figure}\n`;
          }
          return `\n\\begin{figure}[htbp]\n  \\centering\n  \\rule{5cm}{3cm}\n  \\caption{Hình ảnh lỗi}\n\\end{figure}\n`;
        });
    }
      
    const finalLatex = latexHeader + tempText + latexFooter;
    zip.file("TaiLieu.tex", finalLatex);

    const fileBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="TaiLieu_LaTeX.zip"');
    
    return res.send(fileBuffer);

  } catch (error) {
    console.error('LaTeX Export Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during export: ' + error.message });
  }
};
