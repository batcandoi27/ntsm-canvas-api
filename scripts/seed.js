/**
 * Script tạo test data trong Firestore
 * Chạy: node scripts/seed.js path/to/serviceAccount.json
 */
const admin = require('firebase-admin');

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error('❌ Thiếu đường dẫn Service Account JSON!');
  console.log('Cách dùng: node scripts/seed.js path/to/serviceAccount.json');
  process.exit(1);
}

const serviceAccount = require(require('path').resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ntsmprotoan'
});

const db = admin.firestore();

async function seed() {
  console.log('🚀 Bắt đầu tạo test data...\n');

  // ============================================================
  // 1. Tạo Product
  // ============================================================
  const productId = 'chuyenword';
  await db.collection('app_products').doc(productId).set({
    name: 'Trợ Lý Số Hóa Tài Liệu Giáo Dục',
    description: 'AI phân tích ảnh đề thi, xuất Bảng và Toán học chuẩn LaTeX. Hỗ trợ tạo đề tương tự, làm sạch đề, thêm đáp án.',
    price: 299000,
    currency: 'VND',
    status: 'active'
  });
  console.log('✅ Product "chuyenword" đã tạo');

  // ============================================================
  // 2. Tạo License Keys (3 keys test)
  // ============================================================
  const testKeys = ['NTSM1-TEST1-AAAAA-BBBBB', 'NTSM1-TEST2-CCCCC-DDDDD', 'NTSM1-TEST3-EEEEE-FFFFF'];
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 86400000);

  for (const key of testKeys) {
    await db.collection('app_licenses').doc(key).set({
      productId: productId,
      deviceId: null,
      status: 'unused',
      createdAt: now.toISOString(),
      expiresAt: oneYearLater.toISOString(),
      activatedAt: null,
      buyerEmail: 'test@thaycoai.com',
      buyerName: 'Test User'
    });
  }
  console.log(`✅ Đã tạo ${testKeys.length} license keys:`);
  testKeys.forEach(k => console.log(`   🔑 ${k}`));

  // ============================================================
  // 3. Tạo Prompts (trích từ chuyenword.jsx gốc)
  // ============================================================
  await db.collection('app_prompts').doc(productId).set({
    originalMode: 'Hãy chuyển đổi toàn bộ nội dung trong hình ảnh này thành văn bản có cấu trúc.',
    cleanMode: 'LÀM SẠCH ĐỀ THI: Hãy chuyển đổi văn bản. Tuyệt đối bỏ qua và xóa bỏ các vết khoanh tròn đáp án, nét gạch xóa, nét viết tay của học sinh. Chỉ trích xuất phần chữ in gốc của đề bài.',
    similarMode: 'TẠO ĐỀ TƯƠNG TỰ: Hãy phân tích đề bài trong ảnh gốc và TẠO RA MỘT ĐỀ BÀI MỚI TƯƠNG TỰ (cùng cấu trúc, cùng dạng câu hỏi, cùng mức độ khó, nhưng THAY ĐỔI các số liệu, tên nhân vật, biến số hoặc bối cảnh trong câu hỏi sao cho khác biệt nhưng vẫn logic và giải được). LƯU Ý ĐẶC BIỆT: TUYỆT ĐỐI GIỮ NGUYÊN phần tiêu đề của đề thi (bao gồm Tên Trường, Sở, Phòng Giáo dục, Quận, Phường, Thành phố, Kỳ thi, Thời gian làm bài, Năm học...). KHÔNG được chế hay thay đổi các địa danh ở phần thông tin chung của đề thi.',
    answerInstruction: '\n\nLƯU Ý CỰC QUAN TRỌNG VỀ ĐÁP ÁN: TUYỆT ĐỐI KHÔNG tự ý bịa thêm câu hỏi, KHÔNG tự ý thêm \'Phần Tự Luận\' hay bất kỳ phần nào vào nội dung ĐỀ BÀI nếu trong ảnh gốc không có. Đề có bao nhiêu ghi bấy nhiêu.\nChỉ khi đã hoàn thành việc trích xuất đề bài, Ở DƯỚI CÙNG CỦA VĂN BẢN, hãy thêm một mục hoàn toàn độc lập có tiêu đề in đậm là **HƯỚNG DẪN CHẤM**.\nTrong mục này, hãy giải đề:\n- Nếu đề có Trắc nghiệm: Kẻ bảng Markdown ngang (Dòng trên: Số câu, Dòng dưới: Đáp án).\n- Nếu đề có Tự luận: Kẻ bảng Markdown dọc 3 cột (| Bài/Câu | Nội dung / Lời giải chi tiết | Điểm |).\nMọi công thức Toán trong bảng phải được bọc trong dấu $.',
    baseRules: 'YÊU CẦU ĐẶC BIỆT CHUNG (TUÂN THỦ NGHIÊM NGẶT):\n1. Xử lý Bảng biểu: BẮT BUỘC xuất dưới dạng Bảng Markdown chuẩn (ví dụ: | Cột 1 | Cột 2 |). TUYỆT ĐỐI KHÔNG dùng mã lệnh LaTeX.\n2. CÔNG THỨC TOÁN HỌC VÀ BIẾN SỐ (QUAN TRỌNG NHẤT):\n- BẮT BUỘC bọc TẤT CẢ công thức, số đo góc, phương trình, phân số, căn bậc, và biến số đứng lẻ vào trong ký hiệu $ (ví dụ: $2y^2+2x+3=9$, $x$, $60^\\circ$).\n- LƯU Ý TỬ THẦN (CHỐNG LỖI MATHTYPE): TUYỆT ĐỐI KHÔNG ĐƯỢC bọc chữ tiếng Việt vào trong dấu $. Mọi chữ tiếng Việt (ví dụ: điểm, và, nội tiếp, tại...) BẮT BUỘC phải nằm NGOÀI dấu $.\n3. Định dạng: Các Tiêu đề, Số thứ tự Câu phải in đậm bằng định dạng Markdown (ví dụ: **Câu 1:**).\n- ĐẶC BIỆT CHÚ Ý TRẮC NGHIỆM: Các phương án (A, B, C, D) BẮT BUỘC phải được tách xuống từng dòng riêng biệt (mỗi đáp án một dòng). TUYỆT ĐỐI KHÔNG viết dính liền A, B, C, D trên cùng 1 dòng. KHÔNG in đậm các chữ A, B, C, D.',
    imageOriginal: '4. Hình ảnh minh hoạ (DÙNG ẢNH GỐC): BẮT BUỘC phát hiện hộp bao quanh của từng hình ảnh thật trong đề gốc và xuất ra thẻ `[IMG_BBOX: ymin, xmin, ymax, xmax]` chuẩn hóa thang 1000 để dùng lại.',
    imageSvg: '4. Hình ảnh minh hoạ (TẠO BẰNG MÃ SVG): Tuyệt đối KHÔNG dùng thẻ [IMG_BBOX]. Tự động phân tích ảnh gốc và VIẾT MÃ NGUỒN CHUẨN SVG để vẽ lại biểu đồ/hình vẽ đó một cách chính xác. BẮT BUỘC bọc toàn bộ mã SVG (không dùng markdown code block) trong thẻ: `[SVG_IMAGE: <mã_svg>]`. LƯU Ý: Trong mã SVG, các thẻ chữ (<text>) TUYỆT ĐỐI KHÔNG ĐƯỢC CHỨA KÝ HIỆU $ (ví dụ viết C thay vì $C$, viết 3m thay vì $3$m).',
    imagePollinations: '4. Hình ảnh minh hoạ (ẢNH AI POLLINATIONS): Tuyệt đối KHÔNG dùng thẻ [IMG_BBOX]. Tự động phân tích ảnh gốc và sinh ra một đoạn Prompt mô tả biểu đồ/hình vẽ đó bằng TIẾNG ANH (dưới 10 từ). Xuất ra thẻ theo format: `[POLLINATIONS_PROMPT: your english prompt here]`.',
    imageAi: '4. Hình ảnh minh hoạ (ẢNH AI NANO BANANA): Tuyệt đối KHÔNG dùng thẻ [IMG_BBOX]. Tự động phân tích ảnh gốc và sinh ra một đoạn Prompt mô tả biểu đồ/hình vẽ đó bằng TIẾNG ANH (dưới 10 từ). Xuất ra thẻ theo format: `[AI_IMAGE_PROMPT: your english prompt here]`.',
    updatedAt: now.toISOString()
  });
  console.log('✅ Prompts cho "chuyenword" đã tạo');

  console.log('\n🎉 HOÀN TẤT! Bạn có thể test với các key trên.');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
