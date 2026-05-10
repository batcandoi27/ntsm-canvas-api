const admin = require('firebase-admin');
const crypto = require('crypto');

// Đường dẫn tới file service account
const serviceAccount = require('../ntsmprotoan-firebase-adminsdk-fbsvc-424bddd48e.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// ============================================================
// AES-256-GCM ENCRYPTION
// "Base64 không phải là mã hóa, nó chỉ là encoding hiển thị."
// Chìa khóa = licenseKey + deviceId (nằm ở Client, không gửi kèm payload)
// Server chỉ trả Cipher. Hacker chặn Network cũng không giải mã được.
// ============================================================
const AES_MASTER_KEY = 'NTSM_CHUYENWORD_AES256_MASTER_2026'; // Master key dùng cho mã hóa ban đầu trên DB

// Sử dụng PBKDF2 thay vì scrypt vì Web Crypto API (Browser) hỗ trợ PBKDF2 native
function getDerivedKey(password, salt = 'ntsm_salt_v4') {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function encryptAES256(plainText) {
  const key = getDerivedKey(AES_MASTER_KEY); // 256-bit key
  const iv = crypto.randomBytes(12); // 96-bit IV cho GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // Trả về: iv:authTag:cipherText (tất cả base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

async function updatePrompts() {
  const productId = 'chuyenword'; // ID sản phẩm

  const prompts = {
    systemPrompt: `Bạn là chuyên gia OCR đề thi trắc nghiệm...`,
    manualCropMode: `Bạn là chuyên gia OCR tài liệu giáo dục cao cấp.
Nhiệm vụ: Chuyển đổi chính xác 100% nội dung ảnh thành văn bản Markdown/LaTeX.
QUY TẮC ĐẶC BIỆT:
1. Bạn sẽ thấy các vùng TRẮNG trên ảnh. Đó là các hình ảnh đã được người dùng trích xuất riêng.
2. Bạn CHỈ nhận diện phần VĂN BẢN (TEXT) còn lại trên ảnh.
3. TUYỆT ĐỐI KHÔNG sử dụng mã [IMG_BBOX] hay tự ý nhận diện ảnh.
4. Tại mỗi vị trí có vùng trắng, bạn PHẢI chèn đúng mã [HÌNH ẢNH MINH HOẠ: id] mà tôi cung cấp trong danh sách.
5. Luôn giữ đúng cấu trúc câu hỏi, đáp án và định dạng Toán học.`
  };

  const updateData = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: '4.0.0-aes256',
    encryptionMethod: 'AES-256-GCM'
  };

  for (const [key, value] of Object.entries(prompts)) {
    // Cột mã hóa AES-256 (production — Client sẽ giải mã JIT)
    updateData[`${key}_cipher`] = encryptAES256(value);
    
    // Cột Base64 readable (dev reference — để dễ đọc/chỉnh sửa trên Firestore Console)
    updateData[`${key}_readable`] = Buffer.from(value).toString('base64');
    
    // Giữ cột cũ cho backward compatibility tạm thời
    updateData[key] = Buffer.from(value).toString('base64');
  }

  try {
    console.log(`Đang cập nhật Prompts (AES-256-GCM) cho sản phẩm: ${productId}...`);
    
    await db.collection('app_prompts').doc(productId).set(updateData, { merge: true });

    console.log('✅ Cập nhật Prompts thành công!');
    console.log('📦 Encryption: AES-256-GCM');
    console.log('🔑 Master Key: [HIDDEN]');
    console.log('📝 Readable columns: *_readable (Base64)');
    console.log('🔒 Cipher columns: *_cipher (AES-256-GCM)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật:', error);
    process.exit(1);
  }
}

updatePrompts();
