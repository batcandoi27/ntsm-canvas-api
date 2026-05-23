import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Download, 
  Loader2, 
  FileCode, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  RotateCw,
  X,
  Save,
  FileQuestion,
  AlertTriangle,
  Sparkles,
  ListChecks,
  Check,
  Wand2,
  Bot,
  PenTool,
  Palette,
  ImagePlus,
  KeyRound,
  ShieldCheck,
  Lock,
  Mail
} from 'lucide-react';

const executeSecureModule = async (moduleId, licenseKey, action, payload) => {
  // Lấy vân tay thiết bị để dùng làm một phần của Master Password
  const deviceId = await _getDeviceId();

  // 1. Fetch encrypted blob
  const res = await fetch('https://ntsm-canvas-api.vercel.app/api/modules/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, deviceId, moduleId })
  });
  
  if (!res.ok) {
    let errorMsg = 'Module load failed';
    try {
      const errData = await res.json();
      errorMsg = errData.message || errorMsg;
    } catch(e) {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.message);

  // 2. Decrypt
  const encData = Uint8Array.from(atob(data.payload), c => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(data.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
  const encBuffer = encData.buffer;

  // Derive key
  const masterPassword = licenseKey + '_' + deviceId;
  const encKey = new TextEncoder().encode(masterPassword);
  const keyMaterial = await crypto.subtle.importKey('raw', encKey, 'PBKDF2', false, ['deriveKey']);
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encBuffer);
  const decryptedText = new TextDecoder().decode(decryptedBuffer);

  // Verify checksum
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(decryptedText));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  if (hashHex !== data.checksum) throw new Error('Checksum mismatch');

  // 3. Create Web Worker
  const blob = new Blob([decryptedText], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);

  return new Promise((resolve, reject) => {
    const id = Date.now().toString() + Math.random().toString();
    worker.onmessage = (e) => {
      if (e.data.id === id) {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        if (e.data.success) resolve(e.data.result);
        else reject(new Error(e.data.error));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(err);
    };
    worker.postMessage({ id, action, payload });
  });
};

// ============================================================
// CẤU HÌNH BẢN QUYỀN & VÂN TAY THIẾT BỊ
// ============================================================
const _C = {
  API: 'https://ntsm-canvas-api.vercel.app',
  PID: 'chuyenword'
};

const _getDeviceId = async () => {
  // Advanced Browser Fingerprint
  const nav = window.navigator;
  const screen = window.screen;
  let fp = [
    nav.userAgent,
    nav.language,
    nav.deviceMemory || 'unknown',
    nav.hardwareConcurrency || 'unknown',
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset()
  ].join('||');

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('NTSM_PRO_2026', 2, 15);
    fp += canvas.toDataURL();
  } catch(e) {}
  
  const msgBuffer = new TextEncoder().encode(fp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'FP_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
};

// ============================================================
// COMPONENT: License Gate (Nhập Mã / Email)
// ============================================================
const LicenseGate = ({ onSuccess, cachedKey }) => {
  const [key, setKey] = useState(cachedKey || '');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [validKeyForEmail, setValidKeyForEmail] = useState('');

  const activate = async () => {
    if (!key.trim()) return setErr('Vui lòng nhập Mã kích hoạt hoặc Email.');
    setLoading(true); setErr('');
    try {
      const deviceId = await _getDeviceId();
      const res = await fetch(`${_C.API}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key.trim(), deviceId, productId: _C.PID })
      });
      const data = await res.json();
      
      if (data.valid) {
        // If they entered a license key, and NO email is linked, prompt to link email
        if (!key.includes('@') && key.trim().length > 10 && !data.hasLinkedEmail) {
          setValidKeyForEmail(key.trim());
          setShowEmailPrompt(true);
        } else {
          onSuccess({
            key: data.licenseKey || key.trim(),
            email: data.mappedEmail || null,
            loginCount: data.loginCount
          });
        }
      } else {
        setErr(data.message || 'Mã/Email không hợp lệ.');
      }
    } catch (e) {
      setErr('Không thể kết nối máy chủ.');
    } finally { setLoading(false); }
  };

  const linkEmailAndContinue = async () => {
    if (!email.trim() || !email.includes('@')) return setErr('Vui lòng nhập Email hợp lệ.');
    setLoading(true); setErr('');
    try {
      const deviceId = await _getDeviceId();
      const res = await fetch(`${_C.API}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: validKeyForEmail, deviceId, productId: _C.PID, linkEmail: email.trim() })
      });
      const data = await res.json();
      if (data.valid) {
        onSuccess({
          key: data.licenseKey || validKeyForEmail,
          email: data.mappedEmail || email.trim(),
          loginCount: data.loginCount
        });
      } else {
        setErr(data.message || 'Có lỗi xảy ra khi liên kết email.');
      }
    } catch (e) {
      setErr('Không thể kết nối máy chủ.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <ShieldCheck size={40} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-2">Bản Quyền Ứng Dụng</h1>
        <p className="text-blue-200/70 text-sm text-center mb-8">Trợ Lý Số Hóa Tài Liệu Giáo Dục</p>
        
        {showEmailPrompt ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-2">
              <p className="text-green-300 text-sm font-semibold mb-1">Kích hoạt thành công!</p>
              <p className="text-green-100/80 text-xs">Bạn có muốn liên kết Email để lần sau F5 chỉ cần nhập lại Email cho nhanh không?</p>
            </div>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Nhập email của bạn..."
                className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => onSuccess({ key: validKeyForEmail, email: null, loginCount: 1 })} disabled={loading}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-blue-200 text-sm font-semibold rounded-xl transition-all">
                Bỏ qua
              </button>
              <button onClick={linkEmailAndContinue} disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg flex justify-center items-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Liên kết'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50" />
              <input type="text" value={key} onChange={e => setKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && activate()}
                placeholder="Nhập Mã Kích Hoạt hoặc Email..."
                className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 text-center" />
            </div>
            <button onClick={activate} disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Lock size={18} />}
              {loading ? 'Đang xác thực...' : 'XÁC THỰC'}
            </button>
          </div>
        )}
        
        {err && (
          <div className="flex items-center gap-2 text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm mt-4">
            <AlertCircle size={16} /> {err}
          </div>
        )}
        <p className="text-blue-300/30 text-[11px] text-center mt-6">Hệ thống nhận diện vân tay trình duyệt an toàn</p>
      </div>
    </div>
  );
};

// Cấu hình PDF.js
const PDF_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
// Cấu hình KaTeX để xử lý Toán học
const KATEX_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
const KATEX_CSS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
// Thêm thư viện JSZip để đóng gói file LaTeX kèm ảnh
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
// Thư viện vẽ ảnh Base64 siêu nét
const HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

// --- HÀM XỬ LÝ SẼ ĐƯỢC LOAD TỪ SERVER ĐỂ BẢO MẬT ---
// Các logic đặc biệt sẽ được tải thông qua serverPrompts

const App = () => {
  // ============================================================
  // LICENSE STATE (Vân tay thiết bị + Key/Email)
  // ============================================================
  const [isLicensed, setIsLicensed] = useState(false);
  const [licenseChecking, setLicenseChecking] = useState(true);
  const [serverPrompts, setServerPrompts] = useState(null);
  const [cachedKey, setCachedKey] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Attempt auto-login if key is remembered in localStorage (might be wiped by Sandbox)
    const storedKey = localStorage.getItem('ntsm_license_chuyenword');
    if (storedKey) {
      setCachedKey(storedKey);
      handleLicenseSuccess(storedKey);
    } else {
      setLicenseChecking(false);
    }
  }, []);

  const handleLicenseSuccess = async (payload) => {
    setLicenseChecking(true);
    try {
      const key = typeof payload === 'string' ? payload : payload.key;
      if (typeof payload === 'object') setUserInfo(payload);

      localStorage.setItem('ntsm_license_chuyenword', key);
      const deviceId = await _getDeviceId();
      const pRes = await fetch(`${_C.API}/api/prompts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, deviceId, productId: _C.PID })
      });
      const pData = await pRes.json();
      if (pData.success) {
        setServerPrompts(pData.prompts);
        setIsLicensed(true);
      } else {
        localStorage.removeItem('ntsm_license_chuyenword');
      }
    } catch (e) { 
      /* handle prompt fetch error */ 
      console.error("Prompts error", e);
    } finally {
      setLicenseChecking(false);
    }
  };

  // ============================================================
  // ORIGINAL APP STATE
  // ============================================================
  const [fileNames, setFileNames] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultText, setResultText] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const [activeTab, setActiveTab] = useState('preview'); 
  const [textStats, setTextStats] = useState({ questions: 0, hasMathError: false });
  const [saveStatus, setSaveStatus] = useState('Đã lưu nháp');
  
  // Trạng thái cho Sidebar Settings
  const [mainTab, setMainTab] = useState('original'); // 'original' | 'similar'
  const [isCleanMode, setIsCleanMode] = useState(false); // Toggle Làm sạch đề
  const [isGenerateAnswer, setIsGenerateAnswer] = useState(false); // Toggle Thêm đáp án
  const [similarImageType, setSimilarImageType] = useState('original'); // 'original' | 'svg' | 'pollinations' | 'ai'

  // Trạng thái mới cho giao diện (xác định trang đang được chọn ở cột giữa)
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const apiKey = ""; // Sẽ được hệ thống cung cấp tại runtime
  const fileInputRef = useRef(null);
  const extractedImagesRef = useRef({});

  // 1. AUTO-SAVE & TẢI THƯ VIỆN
  useEffect(() => {
    const draft = localStorage.getItem('draft_ocr_result');
    if (draft) {
      setResultText(draft);
      setStatus({ type: 'info', message: 'Đã khôi phục bản nháp từ lần làm việc trước.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    }
    
    const script = document.createElement('script');
    script.src = PDF_JS_URL;
    script.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL; };
    document.head.appendChild(script);

    const katexScript = document.createElement('script');
    katexScript.src = KATEX_JS_URL;
    document.head.appendChild(katexScript);

    const katexCss = document.createElement('link');
    katexCss.rel = 'stylesheet';
    katexCss.href = KATEX_CSS_URL;
    document.head.appendChild(katexCss);

    const zipScript = document.createElement('script');
    zipScript.src = JSZIP_URL;
    document.head.appendChild(zipScript);

    const canvasScript = document.createElement('script');
    canvasScript.src = HTML2CANVAS_URL;
    document.head.appendChild(canvasScript);
  }, []);

  // 2. AUTO-SAVE & ĐẾM CÂU, KIỂM LỖI
  useEffect(() => {
    if(resultText) {
      localStorage.setItem('draft_ocr_result', resultText);
      setSaveStatus('Đang lưu...');
      const timer = setTimeout(() => setSaveStatus('Đã lưu nháp'), 1000);
      return () => clearTimeout(timer);
    }
  }, [resultText]);

  useEffect(() => {
    const qMatch = resultText.match(/\b[Cc]âu\s+\d+[\.:]/g);
    const qCount = qMatch ? qMatch.length : 0;

    const textWithoutBlockMath = resultText.replace(/\$\$.*?\$\$/g, '');
    const inlineMathCount = (textWithoutBlockMath.match(/\$/g) || []).length;
    const hasMathError = inlineMathCount % 2 !== 0;

    setTextStats({ questions: qCount, hasMathError });
  }, [resultText]);

  // Luôn đảm bảo index không vượt quá giới hạn
  useEffect(() => {
      if (previewUrls.length > 0 && activeImageIndex >= previewUrls.length) {
          setActiveImageIndex(Math.max(0, previewUrls.length - 1));
      } else if (previewUrls.length === 0) {
          setActiveImageIndex(0);
      }
  }, [previewUrls, activeImageIndex]);


  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setFileNames([]);
    setPreviewUrls([]);
    setResultText('');
    localStorage.removeItem('draft_ocr_result'); 
    setStatus({ type: '', message: '' });
  };

  const processFiles = async (files) => {
    if (files.length === 0) return;
    setStatus({ type: 'info', message: `Đang tải và phân tích ${files.length} file...` });
    setProgress(0);
    setIsProcessing(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const selectedFile = files[i];
        const isImage = selectedFile.type.startsWith('image/');
        const isPdf = selectedFile.type === 'application/pdf';

        setFileNames(prev => [...prev, selectedFile.name]);

        if (isImage) {
          const url = await new Promise((resolve) => {
             const reader = new FileReader();
             reader.onload = (e) => resolve(e.target.result);
             reader.readAsDataURL(selectedFile);
          });
          setPreviewUrls(prev => [...prev, url]);
        } else if (isPdf) {
          const pdfUrls = await generatePdfPreviews(selectedFile);
          setPreviewUrls(prev => [...prev, ...pdfUrls]);
        }

        setProgress(Math.round(((i + 1) / files.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      setStatus({ type: 'success', message: `Đã tải lên ${files.length} trang/ảnh thành công.` });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Có lỗi khi đọc file. File có thể bị hỏng.' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e) => { await processFiles(Array.from(e.target.files)); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e) => { e.preventDefault(); setIsDragging(false); if (!isProcessing) await processFiles(Array.from(e.dataTransfer.files)); };

  useEffect(() => {
    const handlePaste = async (e) => {
      if (isProcessing || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(new File([file], `Pasted_Image_${Date.now()}_${i}.png`, { type: file.type }));
        }
      }
      if (files.length > 0) { e.preventDefault(); await processFiles(files); }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isProcessing]);

  const generatePdfPreviews = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const urls = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      urls.push(canvas.toDataURL('image/png'));
    }
    return urls;
  };

  const rotateImage = async (idx) => {
    const url = previewUrls[idx];
    const img = new window.Image();
    img.src = url;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const newUrl = canvas.toDataURL('image/png');
    setPreviewUrls(prev => {
      const copy = [...prev];
      copy[idx] = newUrl;
      return copy;
    });
  };

  const removeImage = (idx) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
    setFileNames(prev => prev.filter((_, i) => i !== idx));
  };

  const stitchImages = async () => {
    if (previewUrls.length <= 1) return;
    setIsProcessing(true);
    setStatus({ type: 'info', message: 'Đang tiến hành dàn ảnh...' });
    try {
      const loadedImages = await Promise.all(previewUrls.map(url => new Promise(r => { const img = new window.Image(); img.onload = () => r(img); img.src = url; })));
      const MAX_CANVAS_HEIGHT = 8000;
      const stitchedUrls = [];
      let currentBatch = [];
      let currentHeight = 0;

      for (const img of loadedImages) {
        if (currentHeight + img.height > MAX_CANVAS_HEIGHT && currentBatch.length > 0) {
          stitchedUrls.push(createStitchedCanvas(currentBatch));
          currentBatch = [img];
          currentHeight = img.height;
        } else {
          currentBatch.push(img);
          currentHeight += img.height;
        }
      }
      if (currentBatch.length > 0) stitchedUrls.push(createStitchedCanvas(currentBatch));
      setPreviewUrls(stitchedUrls);
      setStatus({ type: 'success', message: `Dàn thành công! Đã gộp thành ${stitchedUrls.length} ảnh liền mạch.` });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (err) {
      setStatus({ type: 'error', message: 'Lỗi khi dàn ảnh. Kích thước có thể quá lớn.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const createStitchedCanvas = (images) => {
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
    const maxWidth = Math.max(...images.map(img => img.width));
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth; canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let currentY = 0;
    for (const img of images) {
      ctx.drawImage(img, (maxWidth - img.width) / 2, currentY);
      currentY += img.height;
    }
    return canvas.toDataURL('image/png');
  };

  const processOCR = async () => {
    if (previewUrls.length === 0) return;

    setIsProcessing(true);
    setResultText('');
    setProgress(0);
    extractedImagesRef.current = {}; 
    
    try {
      const BATCH_SIZE = 3;
      const resultsArray = new Array(previewUrls.length).fill('');
      let completedCount = 0;

      for (let i = 0; i < previewUrls.length; i += BATCH_SIZE) {
        const currentBatch = previewUrls.slice(i, i + BATCH_SIZE);
        const endIdx = Math.min(i + BATCH_SIZE, previewUrls.length);
        setStatus({ type: 'info', message: `Đang phân tích đồng thời trang ${i + 1} đến ${endIdx} / ${previewUrls.length}...` });

        const batchPromises = currentBatch.map(async (url, localIdx) => {
          const globalIdx = i + localIdx;
          const base64Data = url.split(',')[1];
          
          // ---- XÂY DỰNG PROMPT (SỬ DỤNG SERVER PROMPTS ĐỂ BẢO MẬT IP) ----
          let modeInstruction = "";
          let specificRules = "";

          if (mainTab === 'original') {
            modeInstruction = isCleanMode 
              ? (serverPrompts?.cleanMode || "")
              : (serverPrompts?.originalMode || "");
          } else {
            modeInstruction = serverPrompts?.similarMode || "";
            if (isCleanMode) {
              modeInstruction += " LƯU Ý: Hãy tự động bỏ qua các vết khoanh tròn đáp án hoặc nét gạch xóa bằng tay trên ảnh gốc khi phân tích để tạo đề mới.";
            }
          }

          if (isGenerateAnswer) {
             modeInstruction += (serverPrompts?.answerInstruction || "");
          }

          if (similarImageType === 'svg') {
            specificRules = serverPrompts?.imageSvg || "";
          } else if (similarImageType === 'pollinations') {
            specificRules = serverPrompts?.imagePollinations || "";
          } else if (similarImageType === 'ai') {
            specificRules = serverPrompts?.imageAi || "";
          } else {
            specificRules = serverPrompts?.imageOriginal || "";
          }

          const promptText = `${modeInstruction}\n\n${serverPrompts?.baseRules || ""}\n${specificRules}`;
          
          const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }]
              })
            }
          );

          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          const bt = String.fromCharCode(96, 96, 96);
          let newText = text.replace(new RegExp(`${bt}(?:latex|tex|math|markdown)?\\n?`, 'g'), '').replace(new RegExp(bt, 'g'), '');
          newText = newText.replace(/\$\$\$/g, '$$');
          
          try {
            // Sử dụng Web Worker Mã hóa (V3) để xử lý Trắc nghiệm và Cắt ảnh
            const licenseKey = localStorage.getItem('ntsm_license_chuyenword');
            
            // Bước 1: Format Trắc nghiệm qua Web Worker
            newText = await executeSecureModule('mcq_and_crop', licenseKey, 'formatMultipleChoice', { text: newText });

            // Bước 2: Cắt ảnh BBOX qua Web Worker
            const cropResult = await executeSecureModule('mcq_and_crop', licenseKey, 'cropImages', { 
              text: newText, 
              imageUrl: url, 
              globalIdx 
            });
            
            newText = cropResult.newText;
            extractedImagesRef.current = { ...extractedImagesRef.current, ...cropResult.extractedImages };
            
          } catch (err) {
            console.error('Secure module error:', err);
            setStatus({ type: 'error', message: 'Lỗi mã hóa bảo mật ở bước hậu xử lý: ' + err.message });
            // Fallback: Nếu Web Worker chết, vẫn hiện chữ nhưng không có cắt ảnh.
          }

        // ---- XỬ LÝ ẢNH SVG (NẾU CHỌN TÁI TẠO ẢNH SVG) ----
        if (similarImageType === 'svg') {
          const svgRegex = /\[SVG_IMAGE:\s*([\s\S]*?)\]/g;
          let svgMatch;
          while ((svgMatch = svgRegex.exec(newText)) !== null) {
            let objectUrl = null;
            try {
              // Xóa bỏ markdown code block nếu AI lỡ bọc vào
              let svgCode = svgMatch[1].replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
              
              // BẮT BUỘC phải có xmlns thì thẻ img mới render được SVG
              if (!svgCode.includes('xmlns=')) {
                svgCode = svgCode.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
              }
              // Bổ sung width/height mặc định nếu AI quên (chống lỗi canvas 0x0)
              if (!svgCode.includes('width=')) {
                svgCode = svgCode.replace('<svg', '<svg width="600" height="400"');
              }

              // LÀM SẠCH KÝ HIỆU $ TRONG SVG (Do AI thỉnh thoảng vẫn bọc $ vào text trong ảnh)
              svgCode = svgCode.replace(/\$/g, '');

              // SỬ DỤNG BLOB URL THAY VÌ DATA URL ĐỂ TRÁNH LỖI ENCODE UNICODE VÀ ĐỘ DÀI
              const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
              objectUrl = URL.createObjectURL(blob);
              
              // CHUYỂN ĐỔI SVG SANG PNG ĐỂ WORD CÓ THỂ ĐỌC ĐƯỢC
              const svgImage = new window.Image();
              svgImage.src = objectUrl;
              await new Promise((resolve, reject) => {
                svgImage.onload = resolve;
                svgImage.onerror = () => reject(new Error("Mã SVG bị lỗi định dạng XML (AI vẽ sai cấu trúc)."));
              });

              const canvasSvg = document.createElement('canvas');
              canvasSvg.width = svgImage.width || 600;
              canvasSvg.height = svgImage.height || 400;
              const ctxSvg = canvasSvg.getContext('2d');
              // Tô nền trắng để tránh PNG bị trong suốt lỗi nền đen trong Word
              ctxSvg.fillStyle = "#FFFFFF";
              ctxSvg.fillRect(0, 0, canvasSvg.width, canvasSvg.height);
              ctxSvg.drawImage(svgImage, 0, 0);

              const pngBase64Url = canvasSvg.toDataURL('image/png');
              const imageId = `IMG_SVG_${globalIdx}_${Date.now()}_${Math.floor(Math.random() * 100)}`;
              
              // Lưu bằng PNG thay vì SVG
              extractedImagesRef.current[imageId] = pngBase64Url;
              newText = newText.replace(svgMatch[0], `\n[HÌNH ẢNH MINH HOẠ: ${imageId}]\n`);
            } catch (err) {
              console.error("Lỗi parse SVG:", err.message || err);
              newText = newText.replace(svgMatch[0], `\n[LỖI TẠO ẢNH SVG]\n`);
            } finally {
              // Xóa Blob URL khỏi bộ nhớ trình duyệt sau khi đã xử lý xong
              if (objectUrl) URL.revokeObjectURL(objectUrl);
            }
          }
        }

        // ---- XỬ LÝ ẢNH POLLINATIONS ----
        if (similarImageType === 'pollinations') {
          const polliPromptRegex = /\[POLLINATIONS_PROMPT:\s*(.+?)\]/g;
          let polliMatch;
          while ((polliMatch = polliPromptRegex.exec(newText)) !== null) {
            // Ép phong cách vẽ SGK minh họa Toán
            const styleSuffix = ", flat educational textbook illustration, clean minimalist math diagram, white background";
            const promptStr = encodeURIComponent(polliMatch[1].trim() + styleSuffix);
            const imageId = `IMG_POLLI_${globalIdx}_${Date.now()}_${Math.floor(Math.random() * 100)}`;
            
            try {
              const res = await fetch(`https://image.pollinations.ai/prompt/${promptStr}?width=800&height=400&nologo=true`);
              const blob = await res.blob();
              const base64Url = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              extractedImagesRef.current[imageId] = base64Url;
              newText = newText.replace(polliMatch[0], `\n[HÌNH ẢNH MINH HOẠ: ${imageId}]\n`);
            } catch (err) {
              console.error("Lỗi fetch Pollinations image:", err);
              newText = newText.replace(polliMatch[0], `\n[LỖI TẠO ẢNH POLLINATIONS]\n`);
            }
          }
        }

        // ---- XỬ LÝ ẢNH AI NANO BANANA / GEMINI ----
        if (similarImageType === 'ai') {
          const aiPromptRegex = /\[AI_IMAGE_PROMPT:\s*(.+?)\]/g;
          let aiMatch;
          while ((aiMatch = aiPromptRegex.exec(newText)) !== null) {
            // Prompt mô tả thiết kế tối giản minh họa bài toán
            const styleSuffix = " simple line art, minimalist educational math textbook illustration, clean diagram, white background";
            const promptStr = aiMatch[1].trim() + styleSuffix;
            const imageId = `IMG_AI_${globalIdx}_${Date.now()}_${Math.floor(Math.random() * 100)}`;
            
            try {
              // Gọi API Imagen 4.0 chuyên dụng để tạo ảnh
              const geminiRes = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    instances: { prompt: promptStr },
                    parameters: { sampleCount: 1 }
                  })
                }
              );
              
              const geminiData = await geminiRes.json();
              const base64Data = geminiData.predictions?.[0]?.bytesBase64Encoded;
              
              if (base64Data) {
                extractedImagesRef.current[imageId] = `data:image/png;base64,${base64Data}`;
                newText = newText.replace(aiMatch[0], `\n[HÌNH ẢNH MINH HOẠ: ${imageId}]\n`);
              } else {
                throw new Error("No image data in AI response");
              }
            } catch (err) {
              console.error("Lỗi fetch Gemini AI image:", err);
              newText = newText.replace(aiMatch[0], `\n[LỖI TẠO ẢNH GEMINI AI]\n`);
            }
          }
        }

        resultsArray[globalIdx] = newText;
        completedCount++;
        setProgress(Math.round((completedCount / previewUrls.length) * 100));
        });

        await Promise.all(batchPromises);
      }

      const combinedText = resultsArray.join('\n\n');
      setResultText(combinedText);
      setStatus({ type: 'success', message: 'Chuyển đổi hoàn tất!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Lỗi trong quá trình xử lý AI. Vui lòng thử lại.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchWithRetry = async (url, options, retries = 5) => {
    let delay = 1000;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        const errorText = await response.text();
        console.error(`Fetch failed (${response.status}):`, errorText);
        
        // Tránh retry vô ích với các lỗi xác thực hoặc request sai
        if (response.status === 400 || response.status === 401 || response.status === 403) {
            throw new Error(`Fatal Error: ${response.status} - ${errorText}`);
        }
        
        if (response.status !== 429 && response.status < 500) {
           throw new Error(`Fetch failed: ${response.status} - ${errorText}`);
        }
      } catch (e) {
        if (e.message.startsWith('Fatal Error') || i === retries - 1) throw e;
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  };

  const getRenderedHtml = (text, renderMode = 'web') => {
    let htmlText = text;
    if (serverPrompts && serverPrompts.formatMultipleChoiceFn) {
      try {
        const dynamicFormatter = new Function('text', serverPrompts.formatMultipleChoiceFn);
        htmlText = dynamicFormatter(htmlText);
      } catch (err) {}
    }
    const isForWord = renderMode.startsWith('word');
    const escapeHtml = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1. Render Bảng Markdown
    htmlText = htmlText.replace(/(?:^|\n)([ \t]*\|.*\|[ \t]*(?:\n[ \t]*\|.*\|[ \t]*)+)/g, (match, tableBlock) => {
      const rows = tableBlock.trim().split('\n');
      let htmlTable = `<table ${isForWord ? 'border="1" cellpadding="6" cellspacing="0"' : ''} style="border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid black;">`;
      rows.forEach((row, rIdx) => {
        const inner = row.trim().replace(/^\||\|$/g, '');
        if (/^[ \-:\|]+$/.test(inner)) return; 
        htmlTable += '<tr>';
        const cells = inner.split('|');
        const tag = rIdx === 0 ? 'th' : 'td';
        cells.forEach(cell => {
          htmlTable += `<${tag} style="border: 1px solid black; padding: 6px; text-align: center;">${cell.trim()}</${tag}>`;
        });
        htmlTable += '</tr>';
      });
      htmlTable += '</table>';
      return htmlTable;
    });

    // 2. Render Toán Học
    if (renderMode === 'word_latex') {
        htmlText = htmlText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            return `\n\n$$${escapeHtml(math.trim())}$$\n\n`;
        });
        htmlText = htmlText.replace(/\$([^$]*?)\$/g, (match, math) => {
            return `$${escapeHtml(math.trim())}$`;
        });
    } else if (renderMode === 'word_image_offline') {
        // Bỏ qua vì Toán học đã được chuyển thành thẻ img
    } else if (window.katex) {
        const processMath = (match, math, isDisplay) => {
            try {
                const cleanMathInput = math.trim();
                if (renderMode === 'word_mathml') {
                    const html = window.katex.renderToString(cleanMathInput, { displayMode: isDisplay, output: 'mathml', throwOnError: false });
                    let mathmlMatch = html.match(/<math[^>]*>[\s\S]*?<\/math>/i);
                    if (mathmlMatch) {
                        let cleanMath = mathmlMatch[0].replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, '');
                        cleanMath = cleanMath.replace(/<\/?semantics[^>]*>/gi, '');
                        cleanMath = cleanMath.replace(/<(\/?)([a-z]+)([^>]*)>/gi, function(m, p1, p2, p3) {
                            return `<${p1}mml:${p2}${p3}>`;
                        });
                        cleanMath = cleanMath.replace(/xmlns="[^"]*"/g, ''); 
                        return isDisplay ? `<div align="center" style="margin: 10px 0;">${cleanMath}</div>` : `<span style="font-family: 'Cambria Math', 'Times New Roman', serif;">${cleanMath}</span>`;
                    }
                    return match;
                } else {
                    return window.katex.renderToString(cleanMathInput, { displayMode: isDisplay, output: 'html', throwOnError: false });
                }
            } catch (e) { return match; }
        };

        htmlText = htmlText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => processMath(match, math, true));
        htmlText = htmlText.replace(/\$([^$]*?)\$/g, (match, math) => processMath(match, math, false));
    }

    // 3. Render Chữ In đậm và In nghiêng
    htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    htmlText = htmlText.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // 4. Xử lý Xuống dòng & Thụt lề
    htmlText = htmlText.split('\n').map(line => {
        if (line.trim().startsWith('<table') || line.trim().startsWith('</table') || line.trim().startsWith('<tr') || line.trim().startsWith('</tr') || line.trim().startsWith('<div') || line.trim().startsWith('</div') || line.trim().startsWith('<span') || line.trim().startsWith('</span') || line.trim().startsWith('<img')) {
            return line;
        }
        
        let style = "margin: 5px 0; font-family: 'Times New Roman', serif; font-size: 14pt;";
        if (/^(\*\*|)(A|B|C|D)\1\./.test(line.trim())) {
            style += " margin-left: 20px;";
        }
        return line.trim() === '' ? '<br>' : `<p style="${style}">${line}</p>`;
    }).join('\n');

    // 5. Render Hình Ảnh Base64
    const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
    htmlText = htmlText.replace(imgRegex, (match, imageId) => {
      if (extractedImagesRef.current[imageId]) {
        return `<div style="text-align: center; margin: 15px 0;">
                  <img src="${extractedImagesRef.current[imageId]}" style="max-width: 100%; border-radius: 4px; box-shadow: ${isForWord ? 'none' : '0 2px 4px rgba(0,0,0,0.15)'}; border: ${isForWord ? 'none' : '1px solid #e2e8f0'};" />
                </div>`;
      }
      return match;
    });

    return htmlText;
  };

  // --- CÁC HÀM XUẤT FILE ---
  const downloadAsWordLatex = () => {
    if (!resultText) return;
    setStatus({ type: 'info', message: 'Đang tạo file Word (Mã LaTeX)...' });
    const htmlText = getRenderedHtml(resultText, 'word_latex');
    const fullHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas-microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export MathType</title><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; } p { margin: 5px 0; }</style></head><body lang="vi-VN">${htmlText}</body></html>`;

    try {
      const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const fileDownload = document.createElement("a");
      fileDownload.href = url; fileDownload.download = 'TaiLieu_MathType.doc'; 
      document.body.appendChild(fileDownload); fileDownload.click(); document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Đã xuất file Word (Mã LaTeX) thành công!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (error) { setStatus({ type: 'error', message: 'Lỗi khi tạo file Word.' }); }
  };

  const downloadAsLatex = async () => {
    if (!resultText) return;
    if (!window.JSZip) { setStatus({ type: 'error', message: 'Thư viện ZIP đang tải...' }); return; }
    setStatus({ type: 'info', message: 'Đang đóng gói file LaTeX...' });
    const zip = new window.JSZip();
    const imgFolder = zip.folder("images"); 
    const latexHeader = `\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[vietnamese]{babel}\n\\usepackage{amsmath, amssymb, mathrsfs}\n\\usepackage{graphicx}\n\\usepackage{tabularx}\n\\usepackage{geometry}\n\\geometry{a4paper, margin=2cm}\n\\begin{document}\n\n`;
    const latexFooter = `\n\n\\end{document}`;
    let tempText = resultText;
    
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
    const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
    tempText = tempText.replace(imgRegex, (match, imageId) => {
      if (extractedImagesRef.current[imageId]) {
        const base64Data = extractedImagesRef.current[imageId].split(',')[1];
        imgFolder.file(`${imageId}.png`, base64Data, {base64: true});
        return `\n\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.6\\textwidth]{images/${imageId}.png}\n  \\caption{Hình ảnh minh họa}\n\\end{figure}\n`;
      }
      return `\n\\begin{figure}[htbp]\n  \\centering\n  \\rule{5cm}{3cm}\n  \\caption{Hình ảnh lỗi}\n\\end{figure}\n`;
    });
      
    const finalLatex = latexHeader + tempText + latexFooter;
    zip.file("TaiLieu.tex", finalLatex);
    
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const source = URL.createObjectURL(content);
      const fileDownload = document.createElement("a");
      fileDownload.href = source; fileDownload.download = 'TaiLieu_LaTeX.zip';
      document.body.appendChild(fileDownload); fileDownload.click(); document.body.removeChild(fileDownload);
      URL.revokeObjectURL(source);
      setStatus({ type: 'success', message: 'Đã xuất file ZIP (LaTeX) thành công!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (error) { setStatus({ type: 'error', message: 'Lỗi đóng gói file ZIP.' }); }
  };

  const downloadAsZipPandoc = async () => {
    if (!resultText) return;
    if (!window.JSZip) { setStatus({ type: 'error', message: 'Thư viện ZIP đang tải...' }); return; }
    setStatus({ type: 'info', message: 'Đang đóng gói cho Pandoc...' });
    setIsProcessing(true);

    try {
      const zip = new window.JSZip();
      const imgFolder = zip.folder("images");
      let mdText = resultText;
      const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
      mdText = mdText.replace(imgRegex, (match, imageId) => {
        if (extractedImagesRef.current[imageId]) {
          const base64Data = extractedImagesRef.current[imageId].split(',')[1];
          imgFolder.file(`${imageId}.png`, base64Data, {base64: true});
          return `\n\n![](images/${imageId}.png)\n\n`;
        }
        return `\n\n[Lỗi ảnh]\n\n`;
      });
      zip.file("TaiLieu.md", mdText);

      const content = await zip.generateAsync({ type: "blob" });
      const source = URL.createObjectURL(content);
      const fileDownload = document.createElement("a");
      fileDownload.href = source; fileDownload.download = 'TaiLieu_Pandoc.zip';
      document.body.appendChild(fileDownload); fileDownload.click(); document.body.removeChild(fileDownload);
      URL.revokeObjectURL(source);

      setStatus({ type: 'success', message: 'Đã xuất file ZIP (Pandoc) thành công!' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Lỗi đóng gói file ZIP.' });
    } finally {
      setIsProcessing(false); setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };

  // --- COMPONENT GIAO DIỆN PHỤ ---
  const ToggleCard = ({ checked, onChange, icon, title, sub }) => (
      <div 
          onClick={onChange}
          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}
      >
          <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${checked ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                  {icon}
              </div>
              <div>
                  <div className={`font-bold text-sm ${checked ? 'text-blue-800' : 'text-slate-700'}`}>{title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
              </div>
          </div>
          {/* Switch UI */}
          <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors duration-300 shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </div>
      </div>
  );

  const ExportCard = ({ onClick, disabled, type, title, sub, icon, color }) => {
      // Styles for icon box
      const colorStyles = {
          blue: "bg-[#185abd] text-white", // Word color
          orange: "bg-[#c07328] text-white", // Zip Pandoc color
          purple: "bg-[#6722c8] text-white", // Zip LaTeX color
      };
      
      return (
          <button 
              onClick={onClick} disabled={disabled}
              className="flex flex-col xl:flex-row items-center xl:items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none text-left"
          >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${colorStyles[color]}`}>
                  {icon}
              </div>
              <div className="flex flex-col text-center xl:text-left justify-center h-full">
                  <span className="font-bold text-sm text-slate-800">{title}</span>
                  <span className="text-[11px] text-slate-500 font-medium">{sub}</span>
              </div>
          </button>
      );
  };

  // ============================================================
  // LICENSE GATE: Block UI until license is validated
  // ============================================================
  if (licenseChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-blue-400 animate-spin" />
        <div className="text-blue-200 font-medium animate-pulse">Đang xác thực vân tay thiết bị...</div>
      </div>
    );
  }

  if (!isLicensed) {
    return <LicenseGate cachedKey={cachedKey} onSuccess={handleLicenseSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-[#2a5ee8] text-white px-6 py-4 flex items-center gap-4 shadow-md z-10 shrink-0">
        <div className="relative flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-blue-600" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
            <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded text-blue-600 shadow-sm border border-slate-100">
                <FileText size={12} />
            </div>
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Trợ Lý Số Hóa Tài Liệu Giáo Dục</h1>
          <p className="text-blue-100 text-xs md:text-sm font-medium mt-0.5">AI phân tích ảnh, xuất Bảng và Toán học chuẩn LaTeX.</p>
        </div>

        {/* THÔNG TIN NGƯỜI DÙNG */}
        {userInfo && (
          <div className="hidden sm:flex flex-col items-end text-sm">
            <div className="font-semibold text-blue-50 px-3 py-1 bg-black/10 rounded-full">
              {userInfo.email ? userInfo.email : (userInfo.key ? userInfo.key.substring(0, 12) + '...' : 'Đã xác thực')}
            </div>
            <div className="text-blue-200/80 text-[11px] flex items-center gap-1.5 mt-1 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Đã đăng nhập: {userInfo.loginCount || 1} lần
            </div>
          </div>
        )}
      </header>

      {/* SEO HIDDEN LINKS */}
      <div className="sr-only">
        <a href="https://thaycoai.kgvh.io.vn" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-600 hover:underline">NTSM EDU AI - THAYCOAI.KGVH.IO.VN</a>
        <a href="https://www.facebook.com/groups/1558282825472170" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">FB - #THAYCOAI</a>
        <a href="https://zalo.me/g/lhmlnt232" target="_blank" rel="noopener noreferrer" className="font-bold text-violet-600 hover:underline">Zalo: [Liên hệ mua bản quyền]</a>
      </div>

      {/* MAIN LAYOUT (Ép cứng 3 cột flex-row) */}
      <div className="flex-1 flex flex-row gap-5 p-5 max-w-[1600px] mx-auto w-full h-[calc(100vh-80px)] overflow-hidden">
        
        {/* COLUMN 1: UPLOAD & SETTINGS */}
        <div className="w-[280px] shrink-0 flex flex-col gap-5 overflow-y-auto pb-4 custom-scrollbar">
            
            {/* Tabs Điều hướng (Gốc / Tương Tự) */}
            <div className="flex bg-slate-200/70 p-1.5 rounded-xl shrink-0">
                <button 
                    onClick={() => setMainTab('original')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mainTab === 'original' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Tạo Đề Gốc
                </button>
                <button 
                    onClick={() => setMainTab('similar')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mainTab === 'similar' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Wand2 size={16} /> Đề Tương Tự
                </button>
            </div>

            {/* Upload Box */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 text-sm">{fileNames.length > 0 ? `${fileNames.length} tệp đã tải lên` : "Tải lên tệp"}</h3>
                <div 
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input type="file" className="hidden" ref={fileInputRef} accept="image/*,application/pdf" multiple onChange={handleFileChange} disabled={isProcessing} />
                    <div className="w-14 h-14 bg-[#e8efff] text-[#3b6df0] rounded-full flex items-center justify-center mb-3">
                        <Upload size={24} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-sm text-slate-700">Hỗ trợ PDF, JPG, PNG</span>
                    <span className="text-xs text-slate-500 mt-1">(Không giới hạn số lượng)</span>
                </div>
            </div>

            {/* Tuỳ Chọn (Toggles) - Hiển thị chung */}
            <div className="flex-1">
                <h3 className="font-bold text-slate-800 mb-3 text-sm">Tuỳ Chọn</h3>
                <div className="flex flex-col gap-3">
                    <ToggleCard 
                        checked={isCleanMode} 
                        onChange={() => setIsCleanMode(!isCleanMode)}
                        icon={<Sparkles size={18} className="text-[#f59e0b]"/>} 
                        title="Làm sạch đề" 
                        sub="Xóa vết khoanh tay, vẽ bậy" 
                    />
                    <ToggleCard 
                        checked={isGenerateAnswer} 
                        onChange={() => setIsGenerateAnswer(!isGenerateAnswer)}
                        icon={<ListChecks size={18} className="text-[#10b981]"/>} 
                        title="Thêm đáp án" 
                        sub="Tự động giải và kẻ bảng điểm" 
                    />
                </div>
            </div>

            {/* Cấu hình Hình ảnh - Hiển thị chung */}
            <div className="flex-1 flex flex-col mt-2">
                <h3 className="font-bold text-slate-800 mb-3 text-sm">Cấu hình Hình ảnh (Đề mới)</h3>
                <div className="flex flex-col gap-3 mb-4">
                    <button 
                        onClick={() => setSimilarImageType('original')}
                        className={`flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === 'original' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                    >
                        <div className="mr-3 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><ImageIcon size={16}/></div>
                        <div className="flex-1">
                            <div className={`font-bold text-sm ${similarImageType === 'original' ? 'text-blue-700' : 'text-slate-700'}`}>Dùng Ảnh Gốc</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Bóc tách & giữ nguyên ảnh thật</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === 'original' ? 'border-blue-600' : 'border-slate-300'}`}>
                            {similarImageType === 'original' && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                        </div>
                    </button>

                    <button 
                        onClick={() => setSimilarImageType('svg')}
                        className={`flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === 'svg' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                    >
                        <div className="mr-3 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><PenTool size={16}/></div>
                        <div className="flex-1">
                            <div className={`font-bold text-sm ${similarImageType === 'svg' ? 'text-indigo-700' : 'text-slate-700'}`}>Tái tạo ảnh SVG</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">AI trả về mã vẽ chuẩn SVG</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === 'svg' ? 'border-indigo-600' : 'border-slate-300'}`}>
                            {similarImageType === 'svg' && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                        </div>
                    </button>

                    <button 
                        onClick={() => setSimilarImageType('pollinations')}
                        className={`flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === 'pollinations' ? 'bg-pink-50 border-pink-500 ring-1 ring-pink-500' : 'bg-white border-slate-200 hover:border-pink-300'}`}
                    >
                        <div className="mr-3 w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0"><ImagePlus size={16}/></div>
                        <div className="flex-1">
                            <div className={`font-bold text-sm ${similarImageType === 'pollinations' ? 'text-pink-700' : 'text-slate-700'}`}>Ảnh AI (Pollinations)</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Vẽ phong cách SGK Toán</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === 'pollinations' ? 'border-pink-600' : 'border-slate-300'}`}>
                            {similarImageType === 'pollinations' && <div className="w-2 h-2 bg-pink-600 rounded-full"></div>}
                        </div>
                    </button>

                    <button 
                        onClick={() => setSimilarImageType('ai')}
                        className={`flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === 'ai' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-slate-200 hover:border-purple-300'}`}
                    >
                        <div className="mr-3 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Palette size={16}/></div>
                        <div className="flex-1">
                            <div className={`font-bold text-sm ${similarImageType === 'ai' ? 'text-purple-700' : 'text-slate-700'}`}>Tái tạo ảnh AI 🤖</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Nano Banana minh họa bài toán</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === 'ai' ? 'border-purple-600' : 'border-slate-300'}`}>
                            {similarImageType === 'ai' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                        </div>
                    </button>
                </div>

                {(similarImageType === 'ai' || similarImageType === 'svg' || similarImageType === 'pollinations') && (
                    <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-3.5 text-[13px] text-purple-800 leading-relaxed shadow-sm animate-in fade-in">
                        <strong className="flex items-center gap-1.5 mb-1.5 text-purple-900"><Sparkles size={14}/> Trí tuệ nhân tạo (Auto):</strong>
                        {similarImageType === 'ai' || similarImageType === 'pollinations'
                            ? "Hệ thống tự phân tích ngữ cảnh, sinh prompt mô tả bằng Tiếng Anh và tự vẽ ảnh mới thay thế."
                            : "Hệ thống tự phân tích hình ảnh vật lý/toán học và tạo lại bằng Code SVG siêu nét không vỡ hạt."}
                        <br/>
                        <span className="text-purple-600 font-bold block mt-2 text-[11px]">*Bạn không cần thao tác gì thêm.</span>
                    </div>
                )}
            </div>
        </div>

        {/* COLUMN 2: THUMBNAILS LIST */}
        <div className="w-full lg:w-[280px] shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm h-full">
            <div className="p-3 px-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <span className="font-bold text-sm text-slate-800">Trang tài liệu ({previewUrls.length})</span>
                <button disabled={previewUrls.length < 2 || isProcessing} onClick={stitchImages} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 border border-slate-200 px-2 py-1 rounded bg-slate-50 disabled:opacity-50 transition-colors">
                    <Layers size={12}/> Dàn ảnh dọc
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 custom-scrollbar bg-slate-50/50">
                {previewUrls.length === 0 ? (
                    <div className="text-slate-400 text-sm text-center mt-10 font-medium">Chưa có trang tài liệu nào</div>
                ) : (
                    previewUrls.map((url, i) => (
                        <div 
                            key={i} 
                            onClick={() => setActiveImageIndex(i)} 
                            className={`group relative flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${activeImageIndex === i ? 'border-[#386bf5] bg-[#f0f4ff]' : 'border-transparent hover:bg-white hover:shadow-sm'}`}
                        >
                            <div className="w-14 h-16 bg-white border border-slate-200 shadow-sm flex-shrink-0 relative overflow-hidden rounded">
                                <img src={url} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); rotateImage(i); }} className="text-white hover:text-blue-300"><RotateCw size={14}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="text-white hover:text-red-400"><X size={16}/></button>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className={`font-bold text-sm ${activeImageIndex === i ? 'text-[#1c50db]' : 'text-slate-700'}`}>Trang {i+1}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">Trang {i+1}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* COLUMN 3: EDITOR & ACTIONS */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto lg:overflow-hidden gap-4 custom-scrollbar pb-4 lg:pb-0">
            
            {/* Main Editor Area */}
            <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col min-h-[400px] shadow-sm overflow-hidden relative">
                
                {status.message && (
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${status.type === 'error' ? 'bg-red-100 text-red-700' : status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {status.type === 'error' ? <AlertCircle size={16} /> : status.type === 'success' ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
                        {status.message}
                    </div>
                )}

                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <h2 className="font-bold text-lg text-slate-800">Trang {activeImageIndex + 1 || 1}</h2>
                    {resultText && (
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('preview')} className={`px-4 py-1 text-sm rounded-md font-bold transition-all ${activeTab === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                Xem trước
                            </button>
                            <button onClick={() => setActiveTab('edit')} className={`px-4 py-1 text-sm rounded-md font-bold transition-all ${activeTab === 'edit' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                Code
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 relative bg-slate-50/30 overflow-hidden min-h-0 rounded-b-2xl">
                    {!resultText && !isProcessing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-20 h-24 border-2 border-slate-200 rounded-lg flex flex-col items-center justify-center mb-4 bg-slate-50">
                                <div className="w-10 h-2 bg-slate-200 rounded mb-2"></div>
                                <div className="w-14 h-2 bg-slate-200 rounded mb-2"></div>
                                <div className="w-8 h-2 bg-slate-200 rounded"></div>
                            </div>
                            <span className="font-bold text-slate-600">Xem trước tài liệu</span>
                            <span className="text-sm mt-2 text-slate-400 font-medium">Nội dung trang {activeImageIndex + 1 || 1} sẽ hiển thị tại đây</span>
                        </div>
                    ) : (
                        activeTab === 'edit' ? (
                            <textarea 
                                className="absolute inset-0 w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-[14px] text-slate-800 leading-relaxed custom-scrollbar" 
                                value={resultText} 
                                onChange={(e) => setResultText(e.target.value)} 
                                placeholder="Kết quả nhận diện..."
                            />
                        ) : (
                            <div 
                                className="absolute inset-0 w-full h-full p-6 overflow-y-auto font-serif text-[16px] text-slate-800 leading-relaxed custom-scrollbar bg-white" 
                                dangerouslySetInnerHTML={{ __html: getRenderedHtml(resultText, 'web') }} 
                            />
                        )
                    )}
                </div>
            </div>

            {/* Convert Button & Progress */}
            <div className="flex flex-col gap-2 shrink-0">
                <button 
                    onClick={processOCR} 
                    disabled={isProcessing || previewUrls.length === 0} 
                    className="bg-[#185abd] hover:bg-[#124491] disabled:bg-[#a6c1ee] text-white w-full rounded-xl py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(24,90,189,0.39)] transition-all"
                >
                    {isProcessing ? <Loader2 className="animate-spin w-5 h-5"/> : <span className="text-lg">🚀</span>}
                    BẮT ĐẦU CHUYỂN ĐỔI
                </button>
                {isProcessing && progress > 0 && (
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#185abd] h-full transition-all duration-300" style={{width: `${progress}%`}}></div>
                    </div>
                )}
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center bg-white border border-slate-200 rounded-xl p-3 px-6 text-sm font-bold text-slate-700 shadow-sm shrink-0 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-[#f3e8ff] text-[#9333ea] rounded-md"><FileQuestion size={18} strokeWidth={2.5}/></div> 
                    <span>{textStats.questions} <span className="font-medium text-slate-500">Câu hỏi</span></span>
                </div>
                
                <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
                
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${textStats.hasMathError ? 'bg-red-100 text-red-600' : 'bg-[#dcfce7] text-[#16a34a]'}`}>
                        {textStats.hasMathError ? <AlertTriangle size={18} strokeWidth={2.5}/> : <Check size={18} strokeWidth={3}/>}
                    </div> 
                    <span className={textStats.hasMathError ? 'text-red-600' : ''}>{textStats.hasMathError ? 'Lỗi ngoặc Toán' : 'Toán hợp lệ'}</span>
                </div>
                
                <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
                
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-[#e0f2fe] text-[#0284c7] rounded-md"><Save size={18} strokeWidth={2.5}/></div> 
                    <span className="font-medium">{saveStatus}</span>
                </div>
            </div>

            {/* Exports */}
            <div className="shrink-0">
                <h3 className="font-bold text-slate-800 mb-3 text-sm">Xuất kết quả</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <ExportCard onClick={downloadAsWordLatex} disabled={!resultText || isProcessing} type="word" title="Word" sub="(Bản MathType)" color="blue" icon="W" />
                    <ExportCard onClick={downloadAsZipPandoc} disabled={!resultText || isProcessing} type="zip" title="Xuất ZIP" sub="(Cho Pandoc)" color="orange" icon="ZIP" />
                    <ExportCard onClick={downloadAsLatex} disabled={!resultText || isProcessing} type="zip" title="Xuất ZIP" sub="(LaTeX)" color="purple" icon="ZIP" />
                </div>
            </div>

        </div>
      </div>
      
      {/* Custom CSS for Scrollbars inside component to avoid external dependencies */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default App;