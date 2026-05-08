/**
 * ooxmlParser.js — Parse Markdown → OOXML (Word XML)
 * Backend version ported from markdownParser_v5.ts
 */

function createConversionContext(options = { indent: 720, lineSpacing: 360 }) {
  return {
      pendingImages: new Map(),
      imgIdCounter: 1,
      options
  };
}

function cleanupMarkdown(markdown) {
  markdown = markdown.replace(/([^\n])\s+([A-D]\.\s+|[a-e]\)\s+)/g, '$1\n$2');
  markdown = markdown.replace(/^\s*-\s+([A-D]\.\s+|[a-e]\)\s+)/gm, '$1');

  const dataUris = [];
  const placeholder = markdown.replace(/data:image\/[^)]+/g, (match) => {
      dataUris.push(match);
      return `__DATA_URI_${dataUris.length - 1}__`;
  });

  let cleaned = placeholder;
  const customTags = [];
  cleaned = cleaned.replace(/\[\[.*?\]\]/g, (match) => {
      customTags.push(match);
      return `__CUSTOM_TAG_${customTags.length - 1}__`;
  });

  if (/<(?:\/)?w:(?!drawing|graphic|anchor|inline|extent|effectExtent|docPr|cNvPr|cNvGraphicFramePr|graphicData)[^>]+>/i.test(cleaned)) {
      cleaned = cleaned.replace(/<([^>]+)>/g, '&lt;$1&gt;');
  }

  customTags.forEach((tag, i) => {
      cleaned = cleaned.replace(`__CUSTOM_TAG_${i}__`, tag);
  });

  dataUris.forEach((uri, i) => {
      cleaned = cleaned.replace(`__DATA_URI_${i}__`, uri);
  });

  return cleaned
      .replace(/\r\n/g, '\n')           
      .replace(/[ \t]+$/gm, '')         
      .replace(/\n{3,}/g, '\n\n')       
      .replace(/\\\[/g, '[')
      .replace(/\\\]/g, ']')
      .trim();
}

function parseMarkdown(markdown) {
  const rawMarkdown = cleanupMarkdown(markdown);
  const lines = rawMarkdown.split('\n');
  const blocks = [];
  let i = 0;

  const isTableLine = (l) => l.includes('|') && l.split('|').length >= 3;

  while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) { i++; continue; }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      const isMath = line.trim().startsWith('$');
      const romanMatch = !isMath ? line.match(/^(#{1,2}\s+)(\**[IVXLC]+\.\**)\s+([^$(){}^_]+)$/) : null;
      const isMultipleChoice = line.match(/^[A-D]\.\s+/);
      
      if ((headingMatch || romanMatch) && !isMultipleChoice) {
          let level = 3; 
          let content = '';

          if (headingMatch && !romanMatch) {
              level = headingMatch[1].length;
              content = headingMatch[2];
          } else if (romanMatch) {
              level = 2; 
              content = (romanMatch[2] + ' ' + romanMatch[3]).replace(/^#+\s+/, '');
          }

          blocks.push({ type: 'heading', level, content: content.trim() });
          i++;
          continue;
      }

      const listRegex = /^\s*([-*+]|\d+\.)\s+/;
      if (listRegex.test(lines[i])) {
          const items = [];
          let isOrdered = /^\s*\d+\.\s+/.test(lines[i]);
          let currentItemLines = [];
          
          while (i < lines.length) {
              const nextLine = lines[i].trim();
              if (nextLine.match(/^#{1,6}\s/) || nextLine.match(/^[IVXLC]+\.\s/) || 
                  nextLine.startsWith('```') || isTableLine(nextLine)) { 
                  break;
              }
              
              if (listRegex.test(nextLine)) {
                  if (currentItemLines.length > 0) {
                      items.push(currentItemLines.join(' '));
                      currentItemLines = [];
                  }
                  currentItemLines.push(nextLine.replace(/^\s*([-*+]|\d+\.)\s+/, ''));
              } else if (nextLine !== '') {
                  if (currentItemLines.length > 0) {
                      currentItemLines.push(nextLine);
                  } else {
                      break; 
                  }
              } else {
                  let hasNextListLine = false;
                  for (let j = i + 1; j < lines.length && j < i + 3; j++) {
                      if (listRegex.test(lines[j])) {
                          hasNextListLine = true;
                          break;
                      }
                      if (lines[j].trim() !== '') break;
                  }
                  if (!hasNextListLine) break; 
              }
              i++;
          }
          if (currentItemLines.length > 0) items.push(currentItemLines.join(' '));
          blocks.push({ type: 'list', content: '', items, isOrdered });
          continue;
      }

      if (isTableLine(line)) {
          const rows = [];
          let j = i;
          while (j < lines.length && (isTableLine(lines[j]) || lines[j].trim().match(/^\|?[-: ]+\|[-:| ]+\|?\s*$/))) {
              const cells = lines[j].split('|')
                  .map(c => c.trim())
                  .filter(c => c && !c.match(/^[-:]+$/));
              if (cells.length > 0) rows.push(cells);
              j++;
          }
          
          if (rows.length >= 2) {
              blocks.push({ type: 'table', content: '', rows });
              i = j;
              while (i < lines.length && lines[i].trim() === '') {
                  let nextNormalLine = -1;
                  for (let k = i; k < lines.length; k++) {
                      if (lines[k].trim() !== '') {
                          nextNormalLine = k;
                          break;
                      }
                  }
                  if (nextNormalLine !== -1) {
                      const isCaption = /^(\*\*|#)*\s*(Bảng|Hình|Bàng)\s+\d+/.test(lines[nextNormalLine].trim());
                      if (isCaption) {
                          i = nextNormalLine; 
                          break;
                      }
                  }
                  break; 
              }
              continue;
          }
      }

      if (line.startsWith('```')) {
          let code = '';
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
              code += lines[i] + '\n';
              i++;
          }
          i++;
          blocks.push({ type: 'code', content: code.trim() });
          continue;
      }

      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
          blocks.push({ type: 'image', content: imgMatch[2].trim() }); 
          i++;
          continue;
      }

      let paragraphContent = line;
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
          const nextLine = lines[i].trim();
          if (nextLine.match(/^#{1,6}\s/) || nextLine.match(/^[IVXLC]+\.\s/) || 
              nextLine.match(/^\d+\.\s/) || nextLine.match(/^[-*+]\s/) || 
              nextLine.startsWith('```') || isTableLine(nextLine) || 
              nextLine.match(/^!\[.*?\]\(.*?\)$/) ||
              nextLine.match(/^([A-D]\.\s+|[a-e]\)\s+)/)) { 
              break;
          }
          paragraphContent += ' ' + nextLine;
          i++;
      }

      blocks.push({ type: 'paragraph', content: paragraphContent });
  }

  return blocks;
}

function escXml(s) {
  return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

function inlineToXml(text, ctx) {
  if (!text) return '';

  const dollarCount = (text.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
      text = text.replace(/\$/g, ' '); 
  }

  const runs = [];
  const re = /!\[(.*?)\]\((data:image\/[^)]+)\)|(\$\$)([^$]+?)\3|(\$)([^$]+?)\5|<u>(.*?)<\/u>|(\*\*|__)(.*?)\8|(\*|_)(.*?)\10|`([^`]+)`|(\[\d+(?:\s*,\s*\d+)*\])|([^*_$`\[]+|\[)/g;
  let m;

  while ((m = re.exec(text)) !== null) {
      if (m[2]) { 
          runs.push(imageToXml(m[2], ctx, true));
      } else if (m[4]) { 
          runs.push(`<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">$$${escXml(m[4].trim())}$$</w:t></w:r>`);
      } else if (m[6]) { 
          runs.push(`<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">$${escXml(m[6].trim())}$</w:t></w:r>`);
      } else if (m[7]) { 
          const subContent = m[7];
          const hasBold = subContent.includes('**') || subContent.includes('__');
          const hasItalic = (subContent.match(/\*/g) || []).length === 2 || (subContent.match(/_/g) || []).length === 2;
          const pureText = subContent.replace(/[*_]+/g, '');

          runs.push(`<w:r><w:rPr><w:u w:val="single"/>${hasBold ? '<w:b/>' : ''}${hasItalic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escXml(pureText)}</w:t></w:r>`);
      } else if (m[9] || m[11]) { 
          const content = m[9] || m[11];
          const isBold = !!m[9];
          const isItalic = !!m[11];
          const captionMatch = content.match(/^((?:Hình|Bảng)\s+\d+\.?)(\s*.*)$/i);
          
          if (captionMatch) {
              const label = captionMatch[1];
              const rest = captionMatch[2];
              runs.push(`<w:r><w:rPr><w:b/>${isItalic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escXml(label)}</w:t></w:r>`);
              if (rest) {
                  runs.push(`<w:r><w:rPr>${isBold ? '<w:b/>' : ''}${isItalic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escXml(rest)}</w:t></w:r>`);
              }
          } else {
              runs.push(`<w:r><w:rPr>${isBold ? '<w:b/>' : ''}${isItalic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escXml(content)}</w:t></w:r>`);
          }
      } else if (m[12]) { 
          runs.push(`<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="E8E8E8"/></w:rPr><w:t xml:space="preserve">${escXml(m[12])}</w:t></w:r>`);
      } else if (m[13]) { 
          runs.push(`<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">${escXml(m[13])}</w:t></w:r>`);
      } else if (m[14]) { 
          runs.push(`<w:r><w:t xml:space="preserve">${escXml(m[14])}</w:t></w:r>`);
      }
  }

  if (runs.length === 0) {
      runs.push(`<w:r><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`);
  }

  return runs.join('');
}

function headingToXml(level, content, ctx) {
  const styleId = level <= 4 ? `Heading${level}` : 'Heading3';
  const isCenter = content.includes('[CENTER]');
  const cleanContent = content.replace('[CENTER]', '');
  
  return `<w:p>
<w:pPr>
<w:pStyle w:val="${styleId}"/>
${isCenter ? '<w:jc w:val="center"/>' : '<w:jc w:val="left"/>'}
<w:spacing w:before="240" w:after="120" w:line="${ctx.options.lineSpacing || 360}" w:lineRule="auto"/>
</w:pPr>
${inlineToXml(cleanContent, ctx)}
</w:p>`;
}

function paragraphToXml(content, ctx) {
  const isCenter = content.includes('[CENTER]');
  const contentNoCenter = content.replace(/\[\/?CENTER\]/g, '').trim();
  const isBoldAll = contentNoCenter.startsWith('**') && contentNoCenter.endsWith('**');
  
  let cleanContent = contentNoCenter;
  if (isBoldAll) {
      cleanContent = cleanContent.replace(/^\*\*|\*\*$/g, '');
  }
  
  const hasNumbering = /^\+?\d+(\.\d+)+\.?\s/.test(cleanContent.trim());
  const isCaption = /^(\*\*|#)*\s*(Bảng|Hình|Bàng)\s+\d+/.test(cleanContent.trim());
  const finalAlignment = (isCenter || isCaption) ? 'center' : 'both';

  return `<w:p>
<w:pPr>
<w:jc w:val="${finalAlignment}"/>
${(isCenter || hasNumbering || isCaption) ? '' : `<w:ind w:firstLine="${ctx.options.indent || 720}"/>`}
<w:spacing w:line="${ctx.options.lineSpacing || 360}" w:lineRule="auto" w:before="${isCaption ? '0' : '120'}" w:after="120"/>
</w:pPr>
${isBoldAll ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(cleanContent)}</w:t></w:r>` : inlineToXml(cleanContent, ctx)}
</w:p>`;
}

function tableToXml(rows, ctx) {
  if (!rows || rows.length === 0) return '';

  const numCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map(row => {
      const cells = [...row];
      while (cells.length < numCols) cells.push('');
      return cells;
  });

  const totalTwips = 9360;
  const sttWidth = 600;
  const hinhWidth = 3744; 
  
  const headers = normalizedRows[0].map(h => h.trim().toUpperCase());
  const sttColIndex = headers.indexOf('STT');
  const hinhColIndex = headers.indexOf('HÌNH') !== -1 ? headers.indexOf('HÌNH') : headers.indexOf('HINH');
  
  const colWidths = [];
  
  if (hinhColIndex !== -1 && numCols === 2) {
      for (let i = 0; i < numCols; i++) {
          colWidths.push(i === hinhColIndex ? hinhWidth : (totalTwips - hinhWidth));
      }
  } else if (sttColIndex !== -1 && numCols > 1) {
      const remainingWidth = totalTwips - sttWidth;
      const otherColWidth = Math.floor(remainingWidth / (numCols - 1));
      for (let i = 0; i < numCols; i++) {
          colWidths.push(i === sttColIndex ? sttWidth : otherColWidth);
      }
  } else {
      const defaultWidth = Math.floor(totalTwips / numCols);
      for (let i = 0; i < numCols; i++) colWidths.push(defaultWidth);
  }

  const isAnswerTable = normalizedRows.some(row =>
      row.some(cell => /^\s*[A-D]\.\s/.test(cell.trim()))
  );

  const borderDef = isAnswerTable
      ? `<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>`
      : `<w:top w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="18" w:space="0" w:color="000000"/>`;

  let xml = `<w:tbl><w:tblPr><w:tblW w:w="${totalTwips}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${borderDef}</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr>`;

  xml += '<w:tblGrid>';
  for (let c = 0; c < numCols; c++) {
      xml += `<w:gridCol w:w="${colWidths[c]}"/>`;
  }
  xml += '</w:tblGrid>';

  normalizedRows.forEach((row, rowIdx) => {
      xml += '<w:tr>';
      row.forEach((cell, cellIdx) => {
          const shading = (rowIdx === 0 && !isAnswerTable) ? '<w:shd w:val="clear" w:color="auto" w:fill="D5E8F0"/>' : '';
          const cellContent = (rowIdx === 0 && !isAnswerTable && !cell.startsWith('**')) ? `**${cell}**` : cell;
          const alignment = isAnswerTable ? 'left' : 'center';
          xml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[cellIdx]}" w:type="dxa"/><w:vAlign w:val="center"/>${shading}</w:tcPr>`;
          xml += `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr>${inlineToXml(cellContent, ctx)}</w:p></w:tc>`;
      });
      xml += '</w:tr>';
  });

  xml += '</w:tbl>';
  return xml;
}

function listToXml(items, isOrdered, ctx) {
  let xml = '';
  items.forEach((item, idx) => {
      const bullet = isOrdered ? `${idx + 1}. ` : '• ';
      xml += `<w:p><w:pPr>
<w:jc w:val="both"/>
<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs>
<w:ind w:left="720" w:hanging="360"/>
<w:spacing w:after="60"/>
</w:pPr>`;
      xml += `<w:r><w:t xml:space="preserve">${escXml(bullet)}</w:t><w:tab/></w:r>${inlineToXml(item, ctx)}</w:p>`;
  });
  return xml;
}

function codeToXml(content) {
  let xml = '';
  const codeLines = content.split('\n');
  for (const line of codeLines) {
      xml += `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/><w:spacing w:after="0"/></w:pPr>`;
      xml += `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r></w:p>`;
  }
  xml += '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>';
  return xml;
}

function imageToXml(src, ctx, isInline = false) {
  const isBase64 = src.startsWith('data:image/');
  const placeholderId = `IMG_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const docPrId = ctx.imgIdCounter++;

  if (isBase64) {
      ctx.pendingImages.set(placeholderId, src.split(',')[1]);
  }

  const cx = isInline ? 1500000 : 3000000; 
  const cy = isInline ? 1500000 : 3000000;

  const drawingContent = [
      `<wp:inline distT="0" distB="0" distL="0" distR="0">`,
      `<wp:extent cx="${cx}" cy="${cy}"/>`,
      `<wp:docPr id="${docPrId}" name="Image_${docPrId}"/>`,
      `<wp:cNvGraphicFramePr>`,
      `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
      `</wp:cNvGraphicFramePr>`,
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
      `<pic:nvPicPr>`,
      `<pic:cNvPr id="${docPrId}" name="Image_${docPrId}"/>`,
      `<pic:cNvPicPr/>`,
      `</pic:nvPicPr>`,
      `<pic:blipFill>`,
      `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${placeholderId}"/>`,
      `<a:stretch><a:fillRect/></a:stretch>`,
      `</pic:blipFill>`,
      `<pic:spPr>`,
      `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`,
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`,
      `</pic:spPr>`,
      `</pic:pic>`,
      `</a:graphicData>`,
      `</a:graphic>`,
      `</wp:inline>`
  ].join('');

  const drawingXml = `<w:r><w:drawing>${drawingContent}</w:drawing></w:r>`;
  if (isInline) {
      return drawingXml;
  }
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${drawingXml}</w:p>`;
}

function markdownToOoxml(markdown, optionsOrContext = { indent: 720, lineSpacing: 360 }) {
  if (!markdown || !markdown.trim()) return '';

  let ctx;
  if (optionsOrContext.pendingImages instanceof Map) {
      ctx = optionsOrContext;
  } else {
      ctx = createConversionContext(optionsOrContext);
  }

  const chunks = markdown.split(/\n---\s*\n/);
  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  return chunks.map(chunk => {
      const blocks = parseMarkdown(chunk);
      return blocks.map(block => {
          switch (block.type) {
              case 'heading': return headingToXml(block.level, block.content, ctx);
              case 'paragraph': return paragraphToXml(block.content, ctx);
              case 'table': return tableToXml(block.rows, ctx);
              case 'list': return listToXml(block.items, block.isOrdered, ctx);
              case 'code': return codeToXml(block.content);
              case 'image': return imageToXml(block.content, ctx);
              default: return '';
          }
      }).join('');
  }).join(pageBreak);
}

module.exports = {
  createConversionContext,
  markdownToOoxml
};
