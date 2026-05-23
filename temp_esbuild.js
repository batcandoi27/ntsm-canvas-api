// temp_obf.jsx
import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
var executeSecureModule = async (moduleId, licenseKey, action, payload) => {
  const deviceId = await _getDeviceId();
  const res = await fetch("https://ntsm-canvas-api.vercel.app/api/modules/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey, deviceId, moduleId })
  });
  if (!res.ok) {
    let errorMsg = "Module load failed";
    try {
      const errData = await res.json();
      errorMsg = errData.message || errorMsg;
    } catch (e) {
    }
    throw new Error(errorMsg);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  const encData = Uint8Array.from(atob(data.payload), (c) => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(data.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(data.iv), (c) => c.charCodeAt(0));
  const encBuffer = encData.buffer;
  const masterPassword = licenseKey + "_" + deviceId;
  const encKey = new TextEncoder().encode(masterPassword);
  const keyMaterial = await crypto.subtle.importKey("raw", encKey, "PBKDF2", false, ["deriveKey"]);
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encBuffer);
  const decryptedText = new TextDecoder().decode(decryptedBuffer);
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(decryptedText));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hashHex !== data.checksum) throw new Error("Checksum mismatch");
  const blob = new Blob([decryptedText], { type: "application/javascript" });
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
var _C = {
  API: "https://ntsm-canvas-api.vercel.app",
  PID: "chuyenword"
};
var _getDeviceId = async () => {
  const nav = window.navigator;
  const screen = window.screen;
  let fp = [
    nav.userAgent,
    nav.language,
    nav.deviceMemory || "unknown",
    nav.hardwareConcurrency || "unknown",
    screen.colorDepth,
    screen.width + "x" + screen.height,
    (/* @__PURE__ */ new Date()).getTimezoneOffset()
  ].join("||");
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("NTSM_PRO_2026", 2, 15);
    fp += canvas.toDataURL();
  } catch (e) {
  }
  const msgBuffer = new TextEncoder().encode(fp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "FP_" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
};
var LicenseGate = ({ onSuccess, cachedKey }) => {
  const [key, setKey] = useState(cachedKey || "");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [validKeyForEmail, setValidKeyForEmail] = useState("");
  const activate = async () => {
    if (!key.trim()) return setErr("Vui l\xF2ng nh\u1EADp M\xE3 k\xEDch ho\u1EA1t ho\u1EB7c Email.");
    setLoading(true);
    setErr("");
    try {
      const deviceId = await _getDeviceId();
      const res = await fetch(`${_C.API}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key.trim(), deviceId, productId: _C.PID })
      });
      const data = await res.json();
      if (data.valid) {
        if (!key.includes("@") && key.trim().length > 10 && !data.hasLinkedEmail) {
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
        setErr(data.message || "M\xE3/Email kh\xF4ng h\u1EE3p l\u1EC7.");
      }
    } catch (e) {
      setErr("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i m\xE1y ch\u1EE7.");
    } finally {
      setLoading(false);
    }
  };
  const linkEmailAndContinue = async () => {
    if (!email.trim() || !email.includes("@")) return setErr("Vui l\xF2ng nh\u1EADp Email h\u1EE3p l\u1EC7.");
    setLoading(true);
    setErr("");
    try {
      const deviceId = await _getDeviceId();
      const res = await fetch(`${_C.API}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setErr(data.message || "C\xF3 l\u1ED7i x\u1EA3y ra khi li\xEAn k\u1EBFt email.");
      }
    } catch (e) {
      setErr("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i m\xE1y ch\u1EE7.");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl", children: [
    /* @__PURE__ */ jsx("div", { className: "flex justify-center mb-6", children: /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30", children: /* @__PURE__ */ jsx(ShieldCheck, { size: 40, className: "text-white" }) }) }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-black text-white text-center mb-2", children: "B\u1EA3n Quy\u1EC1n \u1EE8ng D\u1EE5ng" }),
    /* @__PURE__ */ jsx("p", { className: "text-blue-200/70 text-sm text-center mb-8", children: "Tr\u1EE3 L\xFD S\u1ED1 H\xF3a T\xE0i Li\u1EC7u Gi\xE1o D\u1EE5c" }),
    showEmailPrompt ? /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-green-300 text-sm font-semibold mb-1", children: "K\xEDch ho\u1EA1t th\xE0nh c\xF4ng!" }),
        /* @__PURE__ */ jsx("p", { className: "text-green-100/80 text-xs", children: "B\u1EA1n c\xF3 mu\u1ED1n li\xEAn k\u1EBFt Email \u0111\u1EC3 l\u1EA7n sau F5 ch\u1EC9 c\u1EA7n nh\u1EADp l\u1EA1i Email cho nhanh kh\xF4ng?" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(Mail, { size: 18, className: "absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: "Nh\u1EADp email c\u1EE7a b\u1EA1n...",
            className: "w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-4", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onSuccess({ key: validKeyForEmail, email: null, loginCount: 1 }),
            disabled: loading,
            className: "flex-1 py-3 bg-white/5 hover:bg-white/10 text-blue-200 text-sm font-semibold rounded-xl transition-all",
            children: "B\u1ECF qua"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: linkEmailAndContinue,
            disabled: loading,
            className: "flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg flex justify-center items-center gap-2",
            children: loading ? /* @__PURE__ */ jsx(Loader2, { size: 18, className: "animate-spin" }) : "Li\xEAn k\u1EBFt"
          }
        )
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(KeyRound, { size: 18, className: "absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: key,
            onChange: (e) => setKey(e.target.value),
            onKeyDown: (e) => e.key === "Enter" && activate(),
            placeholder: "Nh\u1EADp M\xE3 K\xEDch Ho\u1EA1t ho\u1EB7c Email...",
            className: "w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 text-center"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: activate,
          disabled: loading,
          className: "w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all",
          children: [
            loading ? /* @__PURE__ */ jsx(Loader2, { size: 20, className: "animate-spin" }) : /* @__PURE__ */ jsx(Lock, { size: 18 }),
            loading ? "\u0110ang x\xE1c th\u1EF1c..." : "X\xC1C TH\u1EF0C"
          ]
        }
      )
    ] }),
    err && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm mt-4", children: [
      /* @__PURE__ */ jsx(AlertCircle, { size: 16 }),
      " ",
      err
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-blue-300/30 text-[11px] text-center mt-6", children: "H\u1EC7 th\u1ED1ng nh\u1EADn di\u1EC7n v\xE2n tay tr\xECnh duy\u1EC7t an to\xE0n" })
  ] }) });
};
var PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
var PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
var KATEX_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
var KATEX_CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
var JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
var HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
var App = () => {
  const [isLicensed, setIsLicensed] = useState(false);
  const [licenseChecking, setLicenseChecking] = useState(true);
  const [serverPrompts, setServerPrompts] = useState(null);
  const [cachedKey, setCachedKey] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  useEffect(() => {
    const storedKey = localStorage.getItem("ntsm_license_chuyenword");
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
      const key = typeof payload === "string" ? payload : payload.key;
      if (typeof payload === "object") setUserInfo(payload);
      localStorage.setItem("ntsm_license_chuyenword", key);
      const deviceId = await _getDeviceId();
      const pRes = await fetch(`${_C.API}/api/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key, deviceId, productId: _C.PID })
      });
      const pData = await pRes.json();
      if (pData.success) {
        setServerPrompts(pData.prompts);
        setIsLicensed(true);
      } else {
        localStorage.removeItem("ntsm_license_chuyenword");
      }
    } catch (e) {
      console.error("Prompts error", e);
    } finally {
      setLicenseChecking(false);
    }
  };
  const [fileNames, setFileNames] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultText, setResultText] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [textStats, setTextStats] = useState({ questions: 0, hasMathError: false });
  const [saveStatus, setSaveStatus] = useState("\u0110\xE3 l\u01B0u nh\xE1p");
  const [mainTab, setMainTab] = useState("original");
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [isGenerateAnswer, setIsGenerateAnswer] = useState(false);
  const [similarImageType, setSimilarImageType] = useState("original");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const apiKey = "";
  const fileInputRef = useRef(null);
  const extractedImagesRef = useRef({});
  useEffect(() => {
    const draft = localStorage.getItem("draft_ocr_result");
    if (draft) {
      setResultText(draft);
      setStatus({ type: "info", message: "\u0110\xE3 kh\xF4i ph\u1EE5c b\u1EA3n nh\xE1p t\u1EEB l\u1EA7n l\xE0m vi\u1EC7c tr\u01B0\u1EDBc." });
      setTimeout(() => setStatus({ type: "", message: "" }), 4e3);
    }
    const script = document.createElement("script");
    script.src = PDF_JS_URL;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    };
    document.head.appendChild(script);
    const katexScript = document.createElement("script");
    katexScript.src = KATEX_JS_URL;
    document.head.appendChild(katexScript);
    const katexCss = document.createElement("link");
    katexCss.rel = "stylesheet";
    katexCss.href = KATEX_CSS_URL;
    document.head.appendChild(katexCss);
    const zipScript = document.createElement("script");
    zipScript.src = JSZIP_URL;
    document.head.appendChild(zipScript);
    const canvasScript = document.createElement("script");
    canvasScript.src = HTML2CANVAS_URL;
    document.head.appendChild(canvasScript);
  }, []);
  useEffect(() => {
    if (resultText) {
      localStorage.setItem("draft_ocr_result", resultText);
      setSaveStatus("\u0110ang l\u01B0u...");
      const timer = setTimeout(() => setSaveStatus("\u0110\xE3 l\u01B0u nh\xE1p"), 1e3);
      return () => clearTimeout(timer);
    }
  }, [resultText]);
  useEffect(() => {
    const qMatch = resultText.match(/\b[Cc]âu\s+\d+[\.:]/g);
    const qCount = qMatch ? qMatch.length : 0;
    const textWithoutBlockMath = resultText.replace(/\$\$.*?\$\$/g, "");
    const inlineMathCount = (textWithoutBlockMath.match(/\$/g) || []).length;
    const hasMathError = inlineMathCount % 2 !== 0;
    setTextStats({ questions: qCount, hasMathError });
  }, [resultText]);
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
    setResultText("");
    localStorage.removeItem("draft_ocr_result");
    setStatus({ type: "", message: "" });
  };
  const processFiles = async (files) => {
    if (files.length === 0) return;
    setStatus({ type: "info", message: `\u0110ang t\u1EA3i v\xE0 ph\xE2n t\xEDch ${files.length} file...` });
    setProgress(0);
    setIsProcessing(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const selectedFile = files[i];
        const isImage = selectedFile.type.startsWith("image/");
        const isPdf = selectedFile.type === "application/pdf";
        setFileNames((prev) => [...prev, selectedFile.name]);
        if (isImage) {
          const url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(selectedFile);
          });
          setPreviewUrls((prev) => [...prev, url]);
        } else if (isPdf) {
          const pdfUrls = await generatePdfPreviews(selectedFile);
          setPreviewUrls((prev) => [...prev, ...pdfUrls]);
        }
        setProgress(Math.round((i + 1) / files.length * 100));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      setStatus({ type: "success", message: `\u0110\xE3 t\u1EA3i l\xEAn ${files.length} trang/\u1EA3nh th\xE0nh c\xF4ng.` });
      setTimeout(() => setStatus({ type: "", message: "" }), 3e3);
    } catch (error) {
      setStatus({ type: "error", message: "C\xF3 l\u1ED7i khi \u0111\u1ECDc file. File c\xF3 th\u1EC3 b\u1ECB h\u1ECFng." });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 1e3);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const handleFileChange = async (e) => {
    await processFiles(Array.from(e.target.files));
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isProcessing) await processFiles(Array.from(e.dataTransfer.files));
  };
  useEffect(() => {
    const handlePaste = async (e) => {
      if (isProcessing || e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) files.push(new File([file], `Pasted_Image_${Date.now()}_${i}.png`, { type: file.type }));
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        await processFiles(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isProcessing]);
  const generatePdfPreviews = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const urls = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      urls.push(canvas.toDataURL("image/png"));
    }
    return urls;
  };
  const rotateImage = async (idx) => {
    const url = previewUrls[idx];
    const img = new window.Image();
    img.src = url;
    await new Promise((r) => img.onload = r);
    const canvas = document.createElement("canvas");
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const newUrl = canvas.toDataURL("image/png");
    setPreviewUrls((prev) => {
      const copy = [...prev];
      copy[idx] = newUrl;
      return copy;
    });
  };
  const removeImage = (idx) => {
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
    setFileNames((prev) => prev.filter((_, i) => i !== idx));
  };
  const stitchImages = async () => {
    if (previewUrls.length <= 1) return;
    setIsProcessing(true);
    setStatus({ type: "info", message: "\u0110ang ti\u1EBFn h\xE0nh d\xE0n \u1EA3nh..." });
    try {
      const loadedImages = await Promise.all(previewUrls.map((url) => new Promise((r) => {
        const img = new window.Image();
        img.onload = () => r(img);
        img.src = url;
      })));
      const MAX_CANVAS_HEIGHT = 8e3;
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
      setStatus({ type: "success", message: `D\xE0n th\xE0nh c\xF4ng! \u0110\xE3 g\u1ED9p th\xE0nh ${stitchedUrls.length} \u1EA3nh li\u1EC1n m\u1EA1ch.` });
      setTimeout(() => setStatus({ type: "", message: "" }), 3e3);
    } catch (err) {
      setStatus({ type: "error", message: "L\u1ED7i khi d\xE0n \u1EA3nh. K\xEDch th\u01B0\u1EDBc c\xF3 th\u1EC3 qu\xE1 l\u1EDBn." });
    } finally {
      setIsProcessing(false);
    }
  };
  const createStitchedCanvas = (images) => {
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
    const maxWidth = Math.max(...images.map((img) => img.width));
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let currentY = 0;
    for (const img of images) {
      ctx.drawImage(img, (maxWidth - img.width) / 2, currentY);
      currentY += img.height;
    }
    return canvas.toDataURL("image/png");
  };
  const processOCR = async () => {
    if (previewUrls.length === 0) return;
    setIsProcessing(true);
    setResultText("");
    setProgress(0);
    extractedImagesRef.current = {};
    try {
      const BATCH_SIZE = 3;
      const resultsArray = new Array(previewUrls.length).fill("");
      let completedCount = 0;
      for (let i = 0; i < previewUrls.length; i += BATCH_SIZE) {
        const currentBatch = previewUrls.slice(i, i + BATCH_SIZE);
        const endIdx = Math.min(i + BATCH_SIZE, previewUrls.length);
        setStatus({ type: "info", message: `\u0110ang ph\xE2n t\xEDch \u0111\u1ED3ng th\u1EDDi trang ${i + 1} \u0111\u1EBFn ${endIdx} / ${previewUrls.length}...` });
        const batchPromises = currentBatch.map(async (url, localIdx) => {
          const globalIdx = i + localIdx;
          const base64Data = url.split(",")[1];
          let modeInstruction = "";
          let specificRules = "";
          if (mainTab === "original") {
            modeInstruction = isCleanMode ? serverPrompts?.cleanMode || "" : serverPrompts?.originalMode || "";
          } else {
            modeInstruction = serverPrompts?.similarMode || "";
            if (isCleanMode) {
              modeInstruction += " L\u01AFU \xDD: H\xE3y t\u1EF1 \u0111\u1ED9ng b\u1ECF qua c\xE1c v\u1EBFt khoanh tr\xF2n \u0111\xE1p \xE1n ho\u1EB7c n\xE9t g\u1EA1ch x\xF3a b\u1EB1ng tay tr\xEAn \u1EA3nh g\u1ED1c khi ph\xE2n t\xEDch \u0111\u1EC3 t\u1EA1o \u0111\u1EC1 m\u1EDBi.";
            }
          }
          if (isGenerateAnswer) {
            modeInstruction += serverPrompts?.answerInstruction || "";
          }
          if (similarImageType === "svg") {
            specificRules = serverPrompts?.imageSvg || "";
          } else if (similarImageType === "pollinations") {
            specificRules = serverPrompts?.imagePollinations || "";
          } else if (similarImageType === "ai") {
            specificRules = serverPrompts?.imageAi || "";
          } else {
            specificRules = serverPrompts?.imageOriginal || "";
          }
          const promptText = `${modeInstruction}

${serverPrompts?.baseRules || ""}
${specificRules}`;
          const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }]
              })
            }
          );
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const bt = String.fromCharCode(96, 96, 96);
          let newText = text.replace(new RegExp(`${bt}(?:latex|tex|math|markdown)?\\n?`, "g"), "").replace(new RegExp(bt, "g"), "");
          newText = newText.replace(/\$\$\$/g, "$$");
          try {
            const licenseKey = localStorage.getItem("ntsm_license_chuyenword");
            newText = await executeSecureModule("mcq_and_crop", licenseKey, "formatMultipleChoice", { text: newText });
            const cropResult = await executeSecureModule("mcq_and_crop", licenseKey, "cropImages", {
              text: newText,
              imageUrl: url,
              globalIdx
            });
            newText = cropResult.newText;
            extractedImagesRef.current = { ...extractedImagesRef.current, ...cropResult.extractedImages };
          } catch (err) {
            console.error("Secure module error:", err);
            setStatus({ type: "error", message: "L\u1ED7i m\xE3 h\xF3a b\u1EA3o m\u1EADt \u1EDF b\u01B0\u1EDBc h\u1EADu x\u1EED l\xFD: " + err.message });
          }
          if (similarImageType === "svg") {
            const svgRegex = /\[SVG_IMAGE:\s*([\s\S]*?)\]/g;
            let svgMatch;
            while ((svgMatch = svgRegex.exec(newText)) !== null) {
              let objectUrl = null;
              try {
                let svgCode = svgMatch[1].replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
                if (!svgCode.includes("xmlns=")) {
                  svgCode = svgCode.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                if (!svgCode.includes("width=")) {
                  svgCode = svgCode.replace("<svg", '<svg width="600" height="400"');
                }
                svgCode = svgCode.replace(/\$/g, "");
                const blob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
                objectUrl = URL.createObjectURL(blob);
                const svgImage = new window.Image();
                svgImage.src = objectUrl;
                await new Promise((resolve, reject) => {
                  svgImage.onload = resolve;
                  svgImage.onerror = () => reject(new Error("M\xE3 SVG b\u1ECB l\u1ED7i \u0111\u1ECBnh d\u1EA1ng XML (AI v\u1EBD sai c\u1EA5u tr\xFAc)."));
                });
                const canvasSvg = document.createElement("canvas");
                canvasSvg.width = svgImage.width || 600;
                canvasSvg.height = svgImage.height || 400;
                const ctxSvg = canvasSvg.getContext("2d");
                ctxSvg.fillStyle = "#FFFFFF";
                ctxSvg.fillRect(0, 0, canvasSvg.width, canvasSvg.height);
                ctxSvg.drawImage(svgImage, 0, 0);
                const pngBase64Url = canvasSvg.toDataURL("image/png");
                const imageId = `IMG_SVG_${globalIdx}_${Date.now()}_${Math.floor(Math.random() * 100)}`;
                extractedImagesRef.current[imageId] = pngBase64Url;
                newText = newText.replace(svgMatch[0], `
[H\xCCNH \u1EA2NH MINH HO\u1EA0: ${imageId}]
`);
              } catch (err) {
                console.error("L\u1ED7i parse SVG:", err.message || err);
                newText = newText.replace(svgMatch[0], `
[L\u1ED6I T\u1EA0O \u1EA2NH SVG]
`);
              } finally {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
              }
            }
          }
          if (similarImageType === "pollinations") {
            const polliPromptRegex = /\[POLLINATIONS_PROMPT:\s*(.+?)\]/g;
            let polliMatch;
            while ((polliMatch = polliPromptRegex.exec(newText)) !== null) {
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
                newText = newText.replace(polliMatch[0], `
[H\xCCNH \u1EA2NH MINH HO\u1EA0: ${imageId}]
`);
              } catch (err) {
                console.error("L\u1ED7i fetch Pollinations image:", err);
                newText = newText.replace(polliMatch[0], `
[L\u1ED6I T\u1EA0O \u1EA2NH POLLINATIONS]
`);
              }
            }
          }
          if (similarImageType === "ai") {
            const aiPromptRegex = /\[AI_IMAGE_PROMPT:\s*(.+?)\]/g;
            let aiMatch;
            while ((aiMatch = aiPromptRegex.exec(newText)) !== null) {
              const styleSuffix = " simple line art, minimalist educational math textbook illustration, clean diagram, white background";
              const promptStr = aiMatch[1].trim() + styleSuffix;
              const imageId = `IMG_AI_${globalIdx}_${Date.now()}_${Math.floor(Math.random() * 100)}`;
              try {
                const geminiRes = await fetchWithRetry(
                  `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      instances: { prompt: promptStr },
                      parameters: { sampleCount: 1 }
                    })
                  }
                );
                const geminiData = await geminiRes.json();
                const base64Data2 = geminiData.predictions?.[0]?.bytesBase64Encoded;
                if (base64Data2) {
                  extractedImagesRef.current[imageId] = `data:image/png;base64,${base64Data2}`;
                  newText = newText.replace(aiMatch[0], `
[H\xCCNH \u1EA2NH MINH HO\u1EA0: ${imageId}]
`);
                } else {
                  throw new Error("No image data in AI response");
                }
              } catch (err) {
                console.error("L\u1ED7i fetch Gemini AI image:", err);
                newText = newText.replace(aiMatch[0], `
[L\u1ED6I T\u1EA0O \u1EA2NH GEMINI AI]
`);
              }
            }
          }
          resultsArray[globalIdx] = newText;
          completedCount++;
          setProgress(Math.round(completedCount / previewUrls.length * 100));
        });
        await Promise.all(batchPromises);
      }
      const combinedText = resultsArray.join("\n\n");
      setResultText(combinedText);
      setStatus({ type: "success", message: "Chuy\u1EC3n \u0111\u1ED5i ho\xE0n t\u1EA5t!" });
      setTimeout(() => setStatus({ type: "", message: "" }), 4e3);
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "L\u1ED7i trong qu\xE1 tr\xECnh x\u1EED l\xFD AI. Vui l\xF2ng th\u1EED l\u1EA1i." });
    } finally {
      setIsProcessing(false);
    }
  };
  const fetchWithRetry = async (url, options, retries = 5) => {
    let delay = 1e3;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        const errorText = await response.text();
        console.error(`Fetch failed (${response.status}):`, errorText);
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error(`Fatal Error: ${response.status} - ${errorText}`);
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`Fetch failed: ${response.status} - ${errorText}`);
        }
      } catch (e) {
        if (e.message.startsWith("Fatal Error") || i === retries - 1) throw e;
      }
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  };
  const getRenderedHtml = (text, renderMode = "web") => {
    let htmlText = text;
    if (serverPrompts && serverPrompts.formatMultipleChoiceFn) {
      try {
        const dynamicFormatter = new Function("text", serverPrompts.formatMultipleChoiceFn);
        htmlText = dynamicFormatter(htmlText);
      } catch (err) {
      }
    }
    const isForWord = renderMode.startsWith("word");
    const escapeHtml = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    htmlText = htmlText.replace(/(?:^|\n)([ \t]*\|.*\|[ \t]*(?:\n[ \t]*\|.*\|[ \t]*)+)/g, (match, tableBlock) => {
      const rows = tableBlock.trim().split("\n");
      let htmlTable = `<table ${isForWord ? 'border="1" cellpadding="6" cellspacing="0"' : ""} style="border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid black;">`;
      rows.forEach((row, rIdx) => {
        const inner = row.trim().replace(/^\||\|$/g, "");
        if (/^[ \-:\|]+$/.test(inner)) return;
        htmlTable += "<tr>";
        const cells = inner.split("|");
        const tag = rIdx === 0 ? "th" : "td";
        cells.forEach((cell) => {
          htmlTable += `<${tag} style="border: 1px solid black; padding: 6px; text-align: center;">${cell.trim()}</${tag}>`;
        });
        htmlTable += "</tr>";
      });
      htmlTable += "</table>";
      return htmlTable;
    });
    if (renderMode === "word_latex") {
      htmlText = htmlText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        return `

$$${escapeHtml(math.trim())}$$

`;
      });
      htmlText = htmlText.replace(/\$([^$]*?)\$/g, (match, math) => {
        return `$${escapeHtml(math.trim())}$`;
      });
    } else if (renderMode === "word_image_offline") {
    } else if (window.katex) {
      const processMath = (match, math, isDisplay) => {
        try {
          const cleanMathInput = math.trim();
          if (renderMode === "word_mathml") {
            const html = window.katex.renderToString(cleanMathInput, { displayMode: isDisplay, output: "mathml", throwOnError: false });
            let mathmlMatch = html.match(/<math[^>]*>[\s\S]*?<\/math>/i);
            if (mathmlMatch) {
              let cleanMath = mathmlMatch[0].replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, "");
              cleanMath = cleanMath.replace(/<\/?semantics[^>]*>/gi, "");
              cleanMath = cleanMath.replace(/<(\/?)([a-z]+)([^>]*)>/gi, function(m, p1, p2, p3) {
                return `<${p1}mml:${p2}${p3}>`;
              });
              cleanMath = cleanMath.replace(/xmlns="[^"]*"/g, "");
              return isDisplay ? `<div align="center" style="margin: 10px 0;">${cleanMath}</div>` : `<span style="font-family: 'Cambria Math', 'Times New Roman', serif;">${cleanMath}</span>`;
            }
            return match;
          } else {
            return window.katex.renderToString(cleanMathInput, { displayMode: isDisplay, output: "html", throwOnError: false });
          }
        } catch (e) {
          return match;
        }
      };
      htmlText = htmlText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => processMath(match, math, true));
      htmlText = htmlText.replace(/\$([^$]*?)\$/g, (match, math) => processMath(match, math, false));
    }
    htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    htmlText = htmlText.replace(/\*(.*?)\*/g, "<i>$1</i>");
    htmlText = htmlText.split("\n").map((line) => {
      if (line.trim().startsWith("<table") || line.trim().startsWith("</table") || line.trim().startsWith("<tr") || line.trim().startsWith("</tr") || line.trim().startsWith("<div") || line.trim().startsWith("</div") || line.trim().startsWith("<span") || line.trim().startsWith("</span") || line.trim().startsWith("<img")) {
        return line;
      }
      let style = "margin: 5px 0; font-family: 'Times New Roman', serif; font-size: 14pt;";
      if (/^(\*\*|)(A|B|C|D)\1\./.test(line.trim())) {
        style += " margin-left: 20px;";
      }
      return line.trim() === "" ? "<br>" : `<p style="${style}">${line}</p>`;
    }).join("\n");
    const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
    htmlText = htmlText.replace(imgRegex, (match, imageId) => {
      if (extractedImagesRef.current[imageId]) {
        return `<div style="text-align: center; margin: 15px 0;">
                  <img src="${extractedImagesRef.current[imageId]}" style="max-width: 100%; border-radius: 4px; box-shadow: ${isForWord ? "none" : "0 2px 4px rgba(0,0,0,0.15)"}; border: ${isForWord ? "none" : "1px solid #e2e8f0"};" />
                </div>`;
      }
      return match;
    });
    return htmlText;
  };
  const downloadAsWordLatex = () => {
    if (!resultText) return;
    setStatus({ type: "info", message: "\u0110ang t\u1EA1o file Word (M\xE3 LaTeX)..." });
    const htmlText = getRenderedHtml(resultText, "word_latex");
    const fullHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas-microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export MathType</title><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; } p { margin: 5px 0; }</style></head><body lang="vi-VN">${htmlText}</body></html>`;
    try {
      const blob = new Blob(["\uFEFF", fullHtml], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const fileDownload = document.createElement("a");
      fileDownload.href = url;
      fileDownload.download = "TaiLieu_MathType.doc";
      document.body.appendChild(fileDownload);
      fileDownload.click();
      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);
      setStatus({ type: "success", message: "\u0110\xE3 xu\u1EA5t file Word (M\xE3 LaTeX) th\xE0nh c\xF4ng!" });
      setTimeout(() => setStatus({ type: "", message: "" }), 3e3);
    } catch (error) {
      setStatus({ type: "error", message: "L\u1ED7i khi t\u1EA1o file Word." });
    }
  };
  const downloadAsLatex = async () => {
    if (!resultText) return;
    if (!window.JSZip) {
      setStatus({ type: "error", message: "Th\u01B0 vi\u1EC7n ZIP \u0111ang t\u1EA3i..." });
      return;
    }
    setStatus({ type: "info", message: "\u0110ang \u0111\xF3ng g\xF3i file LaTeX..." });
    const zip = new window.JSZip();
    const imgFolder = zip.folder("images");
    const latexHeader = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[vietnamese]{babel}
\\usepackage{amsmath, amssymb, mathrsfs}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage{geometry}
\\geometry{a4paper, margin=2cm}
\\begin{document}

`;
    const latexFooter = `

\\end{document}`;
    let tempText = resultText;
    tempText = tempText.replace(/(?:^|\n)([ \t]*\|.*\|[ \t]*(?:\n[ \t]*\|.*\|[ \t]*)+)/g, (match, tableBlock) => {
      const lines = tableBlock.trim().split("\n");
      if (lines.length < 2) return match;
      const hasSeparator = /^[ \-\:|]+$/.test(lines[1].trim());
      let dataLines = lines;
      if (hasSeparator) dataLines = lines.filter((_, idx) => idx !== 1);
      const colCount = dataLines[0].split("|").filter((c) => c.trim() !== "").length;
      const colFormat = Array(colCount).fill("c").join("|");
      let latexTable = `
\\begin{table}[htbp]
\\centering
\\begin{tabular}{|${colFormat}|}
\\hline
`;
      dataLines.forEach((line) => {
        const cells = line.split("|").filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);
        latexTable += cells.map((c) => c.trim()).join(" & ") + " \\\\\n\\hline\n";
      });
      latexTable += `\\end{tabular}
\\end{table}
`;
      return latexTable;
    });
    tempText = tempText.replace(/\*\*(.*?)\*\*/g, "\\textbf{$1}");
    tempText = tempText.replace(/\*(.*?)\*/g, "\\textit{$1}");
    const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
    tempText = tempText.replace(imgRegex, (match, imageId) => {
      if (extractedImagesRef.current[imageId]) {
        const base64Data = extractedImagesRef.current[imageId].split(",")[1];
        imgFolder.file(`${imageId}.png`, base64Data, { base64: true });
        return `
\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.6\\textwidth]{images/${imageId}.png}
  \\caption{H\xECnh \u1EA3nh minh h\u1ECDa}
\\end{figure}
`;
      }
      return `
\\begin{figure}[htbp]
  \\centering
  \\rule{5cm}{3cm}
  \\caption{H\xECnh \u1EA3nh l\u1ED7i}
\\end{figure}
`;
    });
    const finalLatex = latexHeader + tempText + latexFooter;
    zip.file("TaiLieu.tex", finalLatex);
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const source = URL.createObjectURL(content);
      const fileDownload = document.createElement("a");
      fileDownload.href = source;
      fileDownload.download = "TaiLieu_LaTeX.zip";
      document.body.appendChild(fileDownload);
      fileDownload.click();
      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(source);
      setStatus({ type: "success", message: "\u0110\xE3 xu\u1EA5t file ZIP (LaTeX) th\xE0nh c\xF4ng!" });
      setTimeout(() => setStatus({ type: "", message: "" }), 3e3);
    } catch (error) {
      setStatus({ type: "error", message: "L\u1ED7i \u0111\xF3ng g\xF3i file ZIP." });
    }
  };
  const downloadAsZipPandoc = async () => {
    if (!resultText) return;
    if (!window.JSZip) {
      setStatus({ type: "error", message: "Th\u01B0 vi\u1EC7n ZIP \u0111ang t\u1EA3i..." });
      return;
    }
    setStatus({ type: "info", message: "\u0110ang \u0111\xF3ng g\xF3i cho Pandoc..." });
    setIsProcessing(true);
    try {
      const zip = new window.JSZip();
      const imgFolder = zip.folder("images");
      let mdText = resultText;
      const imgRegex = /\[HÌNH ẢNH MINH HOẠ:\s*(IMG_[^\]]+)\]/g;
      mdText = mdText.replace(imgRegex, (match, imageId) => {
        if (extractedImagesRef.current[imageId]) {
          const base64Data = extractedImagesRef.current[imageId].split(",")[1];
          imgFolder.file(`${imageId}.png`, base64Data, { base64: true });
          return `

![](images/${imageId}.png)

`;
        }
        return `

[L\u1ED7i \u1EA3nh]

`;
      });
      zip.file("TaiLieu.md", mdText);
      const content = await zip.generateAsync({ type: "blob" });
      const source = URL.createObjectURL(content);
      const fileDownload = document.createElement("a");
      fileDownload.href = source;
      fileDownload.download = "TaiLieu_Pandoc.zip";
      document.body.appendChild(fileDownload);
      fileDownload.click();
      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(source);
      setStatus({ type: "success", message: "\u0110\xE3 xu\u1EA5t file ZIP (Pandoc) th\xE0nh c\xF4ng!" });
    } catch (error) {
      setStatus({ type: "error", message: "L\u1ED7i \u0111\xF3ng g\xF3i file ZIP." });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatus({ type: "", message: "" }), 3e3);
    }
  };
  const ToggleCard = ({ checked, onChange, icon, title, sub }) => /* @__PURE__ */ jsxs(
    "div",
    {
      onClick: onChange,
      className: `flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${checked ? "bg-blue-50 border-blue-400" : "bg-white border-slate-200 hover:border-blue-300"}`,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: `w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${checked ? "bg-white shadow-sm" : "bg-slate-100"}`, children: icon }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: `font-bold text-sm ${checked ? "text-blue-800" : "text-slate-700"}`, children: title }),
            /* @__PURE__ */ jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: sub })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: `w-11 h-6 rounded-full flex items-center p-1 transition-colors duration-300 shrink-0 ${checked ? "bg-blue-600" : "bg-slate-300"}`, children: /* @__PURE__ */ jsx("div", { className: `w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}` }) })
      ]
    }
  );
  const ExportCard = ({ onClick, disabled, type, title, sub, icon, color }) => {
    const colorStyles = {
      blue: "bg-[#185abd] text-white",
      // Word color
      orange: "bg-[#c07328] text-white",
      // Zip Pandoc color
      purple: "bg-[#6722c8] text-white"
      // Zip LaTeX color
    };
    return /* @__PURE__ */ jsxs(
      "button",
      {
        onClick,
        disabled,
        className: "flex flex-col xl:flex-row items-center xl:items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none text-left",
        children: [
          /* @__PURE__ */ jsx("div", { className: `w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${colorStyles[color]}`, children: icon }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-center xl:text-left justify-center h-full", children: [
            /* @__PURE__ */ jsx("span", { className: "font-bold text-sm text-slate-800", children: title }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] text-slate-500 font-medium", children: sub })
          ] })
        ]
      }
    );
  };
  if (licenseChecking) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center gap-4", children: [
      /* @__PURE__ */ jsx(Loader2, { size: 48, className: "text-blue-400 animate-spin" }),
      /* @__PURE__ */ jsx("div", { className: "text-blue-200 font-medium animate-pulse", children: "\u0110ang x\xE1c th\u1EF1c v\xE2n tay thi\u1EBFt b\u1ECB..." })
    ] });
  }
  if (!isLicensed) {
    return /* @__PURE__ */ jsx(LicenseGate, { cachedKey, onSuccess: handleLicenseSuccess });
  }
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-slate-50 font-sans flex flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsxs("header", { className: "bg-[#2a5ee8] text-white px-6 py-4 flex items-center gap-4 shadow-md z-10 shrink-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-inner", children: [
        /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", className: "w-8 h-8 text-blue-600", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ jsx("rect", { x: "3", y: "11", width: "18", height: "10", rx: "2" }),
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "5", r: "2" }),
          /* @__PURE__ */ jsx("path", { d: "M12 7v4" }),
          /* @__PURE__ */ jsx("line", { x1: "8", y1: "16", x2: "8", y2: "16" }),
          /* @__PURE__ */ jsx("line", { x1: "16", y1: "16", x2: "16", y2: "16" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -right-1 bg-white p-0.5 rounded text-blue-600 shadow-sm border border-slate-100", children: /* @__PURE__ */ jsx(FileText, { size: 12 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-xl md:text-2xl font-bold tracking-tight", children: "Tr\u1EE3 L\xFD S\u1ED1 H\xF3a T\xE0i Li\u1EC7u Gi\xE1o D\u1EE5c" }),
        /* @__PURE__ */ jsx("p", { className: "text-blue-100 text-xs md:text-sm font-medium mt-0.5", children: "AI ph\xE2n t\xEDch \u1EA3nh, xu\u1EA5t B\u1EA3ng v\xE0 To\xE1n h\u1ECDc chu\u1EA9n LaTeX." })
      ] }),
      userInfo && /* @__PURE__ */ jsxs("div", { className: "hidden sm:flex flex-col items-end text-sm", children: [
        /* @__PURE__ */ jsx("div", { className: "font-semibold text-blue-50 px-3 py-1 bg-black/10 rounded-full", children: userInfo.email ? userInfo.email : userInfo.key ? userInfo.key.substring(0, 12) + "..." : "\u0110\xE3 x\xE1c th\u1EF1c" }),
        /* @__PURE__ */ jsxs("div", { className: "text-blue-200/80 text-[11px] flex items-center gap-1.5 mt-1 mr-1", children: [
          /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" }),
          "\u0110\xE3 \u0111\u0103ng nh\u1EADp: ",
          userInfo.loginCount || 1,
          " l\u1EA7n"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sr-only", children: [
      /* @__PURE__ */ jsx("a", { href: "https://thaycoai.kgvh.io.vn", target: "_blank", rel: "noopener noreferrer", className: "font-bold text-emerald-600 hover:underline", children: "NTSM EDU AI - THAYCOAI.KGVH.IO.VN" }),
      /* @__PURE__ */ jsx("a", { href: "https://www.facebook.com/groups/1558282825472170", target: "_blank", rel: "noopener noreferrer", className: "font-bold text-blue-600 hover:underline", children: "FB - #THAYCOAI" }),
      /* @__PURE__ */ jsx("a", { href: "https://zalo.me/g/lhmlnt232", target: "_blank", rel: "noopener noreferrer", className: "font-bold text-violet-600 hover:underline", children: "Zalo: [Li\xEAn h\u1EC7 mua b\u1EA3n quy\u1EC1n]" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-row gap-5 p-5 max-w-[1600px] mx-auto w-full h-[calc(100vh-80px)] overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "w-[280px] shrink-0 flex flex-col gap-5 overflow-y-auto pb-4 custom-scrollbar", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex bg-slate-200/70 p-1.5 rounded-xl shrink-0", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setMainTab("original"),
              className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mainTab === "original" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
              children: "T\u1EA1o \u0110\u1EC1 G\u1ED1c"
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setMainTab("similar"),
              className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mainTab === "similar" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
              children: [
                /* @__PURE__ */ jsx(Wand2, { size: 16 }),
                " \u0110\u1EC1 T\u01B0\u01A1ng T\u1EF1"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-800 mb-3 text-sm", children: fileNames.length > 0 ? `${fileNames.length} t\u1EC7p \u0111\xE3 t\u1EA3i l\xEAn` : "T\u1EA3i l\xEAn t\u1EC7p" }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: `border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`,
              onClick: () => !isProcessing && fileInputRef.current?.click(),
              onDragOver: handleDragOver,
              onDragLeave: handleDragLeave,
              onDrop: handleDrop,
              children: [
                /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", ref: fileInputRef, accept: "image/*,application/pdf", multiple: true, onChange: handleFileChange, disabled: isProcessing }),
                /* @__PURE__ */ jsx("div", { className: "w-14 h-14 bg-[#e8efff] text-[#3b6df0] rounded-full flex items-center justify-center mb-3", children: /* @__PURE__ */ jsx(Upload, { size: 24, strokeWidth: 2.5 }) }),
                /* @__PURE__ */ jsx("span", { className: "font-bold text-sm text-slate-700", children: "H\u1ED7 tr\u1EE3 PDF, JPG, PNG" }),
                /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 mt-1", children: "(Kh\xF4ng gi\u1EDBi h\u1EA1n s\u1ED1 l\u01B0\u1EE3ng)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-800 mb-3 text-sm", children: "Tu\u1EF3 Ch\u1ECDn" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
            /* @__PURE__ */ jsx(
              ToggleCard,
              {
                checked: isCleanMode,
                onChange: () => setIsCleanMode(!isCleanMode),
                icon: /* @__PURE__ */ jsx(Sparkles, { size: 18, className: "text-[#f59e0b]" }),
                title: "L\xE0m s\u1EA1ch \u0111\u1EC1",
                sub: "X\xF3a v\u1EBFt khoanh tay, v\u1EBD b\u1EADy"
              }
            ),
            /* @__PURE__ */ jsx(
              ToggleCard,
              {
                checked: isGenerateAnswer,
                onChange: () => setIsGenerateAnswer(!isGenerateAnswer),
                icon: /* @__PURE__ */ jsx(ListChecks, { size: 18, className: "text-[#10b981]" }),
                title: "Th\xEAm \u0111\xE1p \xE1n",
                sub: "T\u1EF1 \u0111\u1ED9ng gi\u1EA3i v\xE0 k\u1EBB b\u1EA3ng \u0111i\u1EC3m"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col mt-2", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-800 mb-3 text-sm", children: "C\u1EA5u h\xECnh H\xECnh \u1EA3nh (\u0110\u1EC1 m\u1EDBi)" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 mb-4", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setSimilarImageType("original"),
                className: `flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === "original" ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" : "bg-white border-slate-200 hover:border-blue-300"}`,
                children: [
                  /* @__PURE__ */ jsx("div", { className: "mr-3 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsx(ImageIcon, { size: 16 }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsx("div", { className: `font-bold text-sm ${similarImageType === "original" ? "text-blue-700" : "text-slate-700"}`, children: "D\xF9ng \u1EA2nh G\u1ED1c" }),
                    /* @__PURE__ */ jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "B\xF3c t\xE1ch & gi\u1EEF nguy\xEAn \u1EA3nh th\u1EADt" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: `w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === "original" ? "border-blue-600" : "border-slate-300"}`, children: similarImageType === "original" && /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-blue-600 rounded-full" }) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setSimilarImageType("svg"),
                className: `flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === "svg" ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" : "bg-white border-slate-200 hover:border-indigo-300"}`,
                children: [
                  /* @__PURE__ */ jsx("div", { className: "mr-3 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsx(PenTool, { size: 16 }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsx("div", { className: `font-bold text-sm ${similarImageType === "svg" ? "text-indigo-700" : "text-slate-700"}`, children: "T\xE1i t\u1EA1o \u1EA3nh SVG" }),
                    /* @__PURE__ */ jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "AI tr\u1EA3 v\u1EC1 m\xE3 v\u1EBD chu\u1EA9n SVG" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: `w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === "svg" ? "border-indigo-600" : "border-slate-300"}`, children: similarImageType === "svg" && /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-indigo-600 rounded-full" }) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setSimilarImageType("pollinations"),
                className: `flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === "pollinations" ? "bg-pink-50 border-pink-500 ring-1 ring-pink-500" : "bg-white border-slate-200 hover:border-pink-300"}`,
                children: [
                  /* @__PURE__ */ jsx("div", { className: "mr-3 w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsx(ImagePlus, { size: 16 }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsx("div", { className: `font-bold text-sm ${similarImageType === "pollinations" ? "text-pink-700" : "text-slate-700"}`, children: "\u1EA2nh AI (Pollinations)" }),
                    /* @__PURE__ */ jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "V\u1EBD phong c\xE1ch SGK To\xE1n" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: `w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === "pollinations" ? "border-pink-600" : "border-slate-300"}`, children: similarImageType === "pollinations" && /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-pink-600 rounded-full" }) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setSimilarImageType("ai"),
                className: `flex items-center text-left p-3 rounded-xl border transition-all ${similarImageType === "ai" ? "bg-purple-50 border-purple-500 ring-1 ring-purple-500" : "bg-white border-slate-200 hover:border-purple-300"}`,
                children: [
                  /* @__PURE__ */ jsx("div", { className: "mr-3 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsx(Palette, { size: 16 }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsx("div", { className: `font-bold text-sm ${similarImageType === "ai" ? "text-purple-700" : "text-slate-700"}`, children: "T\xE1i t\u1EA1o \u1EA3nh AI \u{1F916}" }),
                    /* @__PURE__ */ jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "Nano Banana minh h\u1ECDa b\xE0i to\xE1n" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: `w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${similarImageType === "ai" ? "border-purple-600" : "border-slate-300"}`, children: similarImageType === "ai" && /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-purple-600 rounded-full" }) })
                ]
              }
            )
          ] }),
          (similarImageType === "ai" || similarImageType === "svg" || similarImageType === "pollinations") && /* @__PURE__ */ jsxs("div", { className: "bg-purple-50/80 border border-purple-100 rounded-xl p-3.5 text-[13px] text-purple-800 leading-relaxed shadow-sm animate-in fade-in", children: [
            /* @__PURE__ */ jsxs("strong", { className: "flex items-center gap-1.5 mb-1.5 text-purple-900", children: [
              /* @__PURE__ */ jsx(Sparkles, { size: 14 }),
              " Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (Auto):"
            ] }),
            similarImageType === "ai" || similarImageType === "pollinations" ? "H\u1EC7 th\u1ED1ng t\u1EF1 ph\xE2n t\xEDch ng\u1EEF c\u1EA3nh, sinh prompt m\xF4 t\u1EA3 b\u1EB1ng Ti\u1EBFng Anh v\xE0 t\u1EF1 v\u1EBD \u1EA3nh m\u1EDBi thay th\u1EBF." : "H\u1EC7 th\u1ED1ng t\u1EF1 ph\xE2n t\xEDch h\xECnh \u1EA3nh v\u1EADt l\xFD/to\xE1n h\u1ECDc v\xE0 t\u1EA1o l\u1EA1i b\u1EB1ng Code SVG si\xEAu n\xE9t kh\xF4ng v\u1EE1 h\u1EA1t.",
            /* @__PURE__ */ jsx("br", {}),
            /* @__PURE__ */ jsx("span", { className: "text-purple-600 font-bold block mt-2 text-[11px]", children: "*B\u1EA1n kh\xF4ng c\u1EA7n thao t\xE1c g\xEC th\xEAm." })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "w-full lg:w-[280px] shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm h-full", children: [
        /* @__PURE__ */ jsxs("div", { className: "p-3 px-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0", children: [
          /* @__PURE__ */ jsxs("span", { className: "font-bold text-sm text-slate-800", children: [
            "Trang t\xE0i li\u1EC7u (",
            previewUrls.length,
            ")"
          ] }),
          /* @__PURE__ */ jsxs("button", { disabled: previewUrls.length < 2 || isProcessing, onClick: stitchImages, className: "text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 border border-slate-200 px-2 py-1 rounded bg-slate-50 disabled:opacity-50 transition-colors", children: [
            /* @__PURE__ */ jsx(Layers, { size: 12 }),
            " D\xE0n \u1EA3nh d\u1ECDc"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 custom-scrollbar bg-slate-50/50", children: previewUrls.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-slate-400 text-sm text-center mt-10 font-medium", children: "Ch\u01B0a c\xF3 trang t\xE0i li\u1EC7u n\xE0o" }) : previewUrls.map((url, i) => /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: () => setActiveImageIndex(i),
            className: `group relative flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${activeImageIndex === i ? "border-[#386bf5] bg-[#f0f4ff]" : "border-transparent hover:bg-white hover:shadow-sm"}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "w-14 h-16 bg-white border border-slate-200 shadow-sm flex-shrink-0 relative overflow-hidden rounded", children: [
                /* @__PURE__ */ jsx("img", { src: url, className: "w-full h-full object-cover" }),
                /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity", children: [
                  /* @__PURE__ */ jsx("button", { onClick: (e) => {
                    e.stopPropagation();
                    rotateImage(i);
                  }, className: "text-white hover:text-blue-300", children: /* @__PURE__ */ jsx(RotateCw, { size: 14 }) }),
                  /* @__PURE__ */ jsx("button", { onClick: (e) => {
                    e.stopPropagation();
                    removeImage(i);
                  }, className: "text-white hover:text-red-400", children: /* @__PURE__ */ jsx(X, { size: 16 }) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-center", children: [
                /* @__PURE__ */ jsxs("span", { className: `font-bold text-sm ${activeImageIndex === i ? "text-[#1c50db]" : "text-slate-700"}`, children: [
                  "Trang ",
                  i + 1
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "text-[11px] text-slate-500 mt-0.5", children: [
                  "Trang ",
                  i + 1
                ] })
              ] })
            ]
          },
          i
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col min-w-0 h-full overflow-y-auto lg:overflow-hidden gap-4 custom-scrollbar pb-4 lg:pb-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col min-h-[400px] shadow-sm overflow-hidden relative", children: [
          status.message && /* @__PURE__ */ jsxs("div", { className: `absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${status.type === "error" ? "bg-red-100 text-red-700" : status.type === "success" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`, children: [
            status.type === "error" ? /* @__PURE__ */ jsx(AlertCircle, { size: 16 }) : status.type === "success" ? /* @__PURE__ */ jsx(CheckCircle2, { size: 16 }) : /* @__PURE__ */ jsx(Loader2, { size: 16, className: "animate-spin" }),
            status.message
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-white shrink-0", children: [
            /* @__PURE__ */ jsxs("h2", { className: "font-bold text-lg text-slate-800", children: [
              "Trang ",
              activeImageIndex + 1 || 1
            ] }),
            resultText && /* @__PURE__ */ jsxs("div", { className: "flex bg-slate-100 p-1 rounded-lg", children: [
              /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("preview"), className: `px-4 py-1 text-sm rounded-md font-bold transition-all ${activeTab === "preview" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`, children: "Xem tr\u01B0\u1EDBc" }),
              /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("edit"), className: `px-4 py-1 text-sm rounded-md font-bold transition-all ${activeTab === "edit" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`, children: "Code" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex-1 relative bg-slate-50/30 overflow-hidden min-h-0 rounded-b-2xl", children: !resultText && !isProcessing ? /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center text-slate-400", children: [
            /* @__PURE__ */ jsxs("div", { className: "w-20 h-24 border-2 border-slate-200 rounded-lg flex flex-col items-center justify-center mb-4 bg-slate-50", children: [
              /* @__PURE__ */ jsx("div", { className: "w-10 h-2 bg-slate-200 rounded mb-2" }),
              /* @__PURE__ */ jsx("div", { className: "w-14 h-2 bg-slate-200 rounded mb-2" }),
              /* @__PURE__ */ jsx("div", { className: "w-8 h-2 bg-slate-200 rounded" })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-600", children: "Xem tr\u01B0\u1EDBc t\xE0i li\u1EC7u" }),
            /* @__PURE__ */ jsxs("span", { className: "text-sm mt-2 text-slate-400 font-medium", children: [
              "N\u1ED9i dung trang ",
              activeImageIndex + 1 || 1,
              " s\u1EBD hi\u1EC3n th\u1ECB t\u1EA1i \u0111\xE2y"
            ] })
          ] }) : activeTab === "edit" ? /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "absolute inset-0 w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-[14px] text-slate-800 leading-relaxed custom-scrollbar",
              value: resultText,
              onChange: (e) => setResultText(e.target.value),
              placeholder: "K\u1EBFt qu\u1EA3 nh\u1EADn di\u1EC7n..."
            }
          ) : /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0 w-full h-full p-6 overflow-y-auto font-serif text-[16px] text-slate-800 leading-relaxed custom-scrollbar bg-white",
              dangerouslySetInnerHTML: { __html: getRenderedHtml(resultText, "web") }
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 shrink-0", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: processOCR,
              disabled: isProcessing || previewUrls.length === 0,
              className: "bg-[#185abd] hover:bg-[#124491] disabled:bg-[#a6c1ee] text-white w-full rounded-xl py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(24,90,189,0.39)] transition-all",
              children: [
                isProcessing ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin w-5 h-5" }) : /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F680}" }),
                "B\u1EAET \u0110\u1EA6U CHUY\u1EC2N \u0110\u1ED4I"
              ]
            }
          ),
          isProcessing && progress > 0 && /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-200 h-1.5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "bg-[#185abd] h-full transition-all duration-300", style: { width: `${progress}%` } }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap sm:flex-nowrap justify-between items-center bg-white border border-slate-200 rounded-xl p-3 px-6 text-sm font-bold text-slate-700 shadow-sm shrink-0 gap-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "p-1.5 bg-[#f3e8ff] text-[#9333ea] rounded-md", children: /* @__PURE__ */ jsx(FileQuestion, { size: 18, strokeWidth: 2.5 }) }),
            /* @__PURE__ */ jsxs("span", { children: [
              textStats.questions,
              " ",
              /* @__PURE__ */ jsx("span", { className: "font-medium text-slate-500", children: "C\xE2u h\u1ECFi" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "hidden sm:block w-px h-6 bg-slate-200" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: `p-1.5 rounded-md ${textStats.hasMathError ? "bg-red-100 text-red-600" : "bg-[#dcfce7] text-[#16a34a]"}`, children: textStats.hasMathError ? /* @__PURE__ */ jsx(AlertTriangle, { size: 18, strokeWidth: 2.5 }) : /* @__PURE__ */ jsx(Check, { size: 18, strokeWidth: 3 }) }),
            /* @__PURE__ */ jsx("span", { className: textStats.hasMathError ? "text-red-600" : "", children: textStats.hasMathError ? "L\u1ED7i ngo\u1EB7c To\xE1n" : "To\xE1n h\u1EE3p l\u1EC7" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "hidden sm:block w-px h-6 bg-slate-200" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "p-1.5 bg-[#e0f2fe] text-[#0284c7] rounded-md", children: /* @__PURE__ */ jsx(Save, { size: 18, strokeWidth: 2.5 }) }),
            /* @__PURE__ */ jsx("span", { className: "font-medium", children: saveStatus })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "shrink-0", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-800 mb-3 text-sm", children: "Xu\u1EA5t k\u1EBFt qu\u1EA3" }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-3 gap-3", children: [
            /* @__PURE__ */ jsx(ExportCard, { onClick: downloadAsWordLatex, disabled: !resultText || isProcessing, type: "word", title: "Word", sub: "(B\u1EA3n MathType)", color: "blue", icon: "W" }),
            /* @__PURE__ */ jsx(ExportCard, { onClick: downloadAsZipPandoc, disabled: !resultText || isProcessing, type: "zip", title: "Xu\u1EA5t ZIP", sub: "(Cho Pandoc)", color: "orange", icon: "ZIP" }),
            /* @__PURE__ */ jsx(ExportCard, { onClick: downloadAsLatex, disabled: !resultText || isProcessing, type: "zip", title: "Xu\u1EA5t ZIP", sub: "(LaTeX)", color: "purple", icon: "ZIP" })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      ` } })
  ] });
};
var temp_obf_default = App;
export {
  temp_obf_default as default
};
