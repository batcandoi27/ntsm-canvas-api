const admin = require('firebase-admin');
const path = require('path');

// Đường dẫn tới file service account
const serviceAccount = require('../ntsmprotoan-firebase-adminsdk-fbsvc-424bddd48e.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updatePrompts() {
  const productId = 'chuyenword'; // ID sản phẩm của bạn
  
  // Nội dung prompt mới đã tối ưu:
  // 1. In đậm toàn bộ dòng đáp án A. B. C. D.
  // 2. Rút gọn tag ảnh thành [IMG_x]
  const newPromptText = `Bạn là chuyên gia OCR đề thi trắc nghiệm. Hãy chuyển đổi nội dung từ hình ảnh sang Markdown một cách chính xác nhất.

QUY TẮC ĐỊNH DẠNG:
1. TRẮC NGHIỆM: Các dòng đáp án A, B, C, D PHẢI được in đậm toàn bộ dòng (bao gồm cả chữ cái và nội dung). 
   Ví dụ: **A. Nội dung đáp án.**
   KHÔNG được chỉ in đậm mỗi chữ cái.

2. HÌNH ẢNH: Nếu thấy hình ảnh minh họa trong đề, hãy chèn ký hiệu [IMG_1], [IMG_2],... (theo số thứ tự) tại vị trí tương ứng. 
   KHÔNG thêm chữ "HÌNH ẢNH MINH HOẠ" hay bất kỳ mô tả nào khác. Chỉ để [IMG_x].

3. TOÁN HỌC: Giữ nguyên các công thức toán học trong ký hiệu $...$ (inline) hoặc $$...$$ (block). Sử dụng định dạng LaTeX chuẩn.

4. CẤU TRÚC: Giữ nguyên bố cục đề thi, các câu hỏi bắt đầu bằng "Câu 1:", "Câu 2:"...`;

  // Encode base64 vì server ntsm-canvas-api giải mã base64 trước khi dùng
  const base64Prompt = Buffer.from(newPromptText).toString('base64');

  try {
    console.log(`Đang cập nhật Prompt cho sản phẩm: ${productId}...`);
    
    await db.collection('app_prompts').doc(productId).set({
      systemPrompt: base64Prompt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      version: '2.0.0'
    }, { merge: true });

    console.log('✅ Cập nhật Prompt thành công!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật:', error);
    process.exit(1);
  }
}

updatePrompts();
