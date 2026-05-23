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

async function updateManualCropPrompt() {
  const productId = 'chuyenword';
  
  const manualCropPrompt = `Bạn là chuyên gia OCR tài liệu giáo dục cao cấp.
Nhiệm vụ: Chuyển đổi chính xác 100% nội dung ảnh thành văn bản Markdown/LaTeX.
QUY TẮC ĐẶC BIỆT:
1. Bạn sẽ thấy các vùng TRẮNG trên ảnh. Đó là các hình ảnh đã được người dùng trích xuất riêng.
2. Bạn CHỈ nhận diện phần VĂN BẢN (TEXT) còn lại trên ảnh.
3. TUYỆT ĐỐI KHÔNG sử dụng mã [IMG_BBOX] hay tự ý nhận diện ảnh.
4. Tại mỗi vị trí có vùng trắng, bạn PHẢI chèn đúng mã [HÌNH ẢNH MINH HOẠ: id] mà tôi cung cấp trong danh sách.
5. Luôn giữ đúng cấu trúc câu hỏi, đáp án và định dạng Toán học.`;

  const base64Prompt = Buffer.from(manualCropPrompt).toString('base64');

  try {
    console.log(`🚀 Đang cập nhật trường manualCropMode cho sản phẩm: ${productId}...`);
    
    await db.collection('app_prompts').doc(productId).set({
      manualCropMode: base64Prompt,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log('✅ Cập nhật Manual Crop Prompt thành công!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật:', error);
    process.exit(1);
  }
}

updateManualCropPrompt();
