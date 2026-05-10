const NTSM_CORE = (function() {
  const _0x5f21 = ['aHR0cHM6Ly9udHNtLWNhbnZhcy1hcGkudmVyY2VsLmFwcC9hcGkvbW9kdWxlcy9nZXQ=', 'aHR0cHM6Ly9udHNtLWNhbnZhcy1hcGkudmVyY2VsLmFwcA==', 'Y2h1eWVud29yZA==', 'bWNxX2FuZF9jcm9w', 'Zm9ybWF0TXVsdGlwbGVDaG9pY2U=', 'xJDhuqFuZyB0aOG7sWMgdGhpIHjDoWMgbmjhuq1uLi4u', 'RlBf', 'L2FwaS92YWxpZGF0ZQ==', 'L2FwaS9leHBvcnQvZG9jeA==', 'L2FwaS9leHBvcnQvcGFuZG9jLWNvbnZlcnQ=', 'Z2VtaW5pLTIuNS1mbGFzaC1wcmV2aWV3LTA5LTIwMjU=', 'aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy8=', 'L2FwaS9wcm9tcHRz'];
  const _0x4e12 = function(_0xidx) { return decodeURIComponent(escape(atob(_0x5f21[_0xidx]))); };

  if (typeof window !== 'undefined') {
    const _0xDH = '5ea71e7947f5eda0b48fddd3613d8908';
    setTimeout(() => {
      try {
        const _k = localStorage.getItem('ntsm_license_chuyenword') || '';
        const _p = _k.substring(0, 4);
        const _enc = new TextEncoder();
        crypto.subtle.digest('SHA-256', _enc.encode(_p)).then(_h => {
          const _hex = Array.from(new Uint8Array(_h)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
          if (_hex === _0xDH) return;
          setInterval(function() { const _t = performance.now(); debugger; if (performance.now() - _t > 100) { window.location.reload(); } }, 3000);
        });
      } catch(_e) {}
    }, 2000);
  }

  const _initSession = async () => {
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
    } catch (e) { }

    const msgBuffer = new TextEncoder().encode(fp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return _0x4e12(6) + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  };

  const runCore = async (_0x1a2, _0x3b4, _0x5c6, _0x7d8) => {
    const _0x9e0 = await _initSession();
    const res = await fetch(_0x4e12(0), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: _0x3b4, deviceId: _0x9e0, moduleId: _0x1a2 })
    });

    if (!res.ok) {
      let errorMsg = 'Module load failed';
      try { const errData = await res.json(); errorMsg = errData.message || errorMsg; } catch (e) { }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const encData = Uint8Array.from(atob(data.payload), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(data.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));

    const _0xac2 = _0x3b4 + '_' + _0x9e0;
    const encKey = new TextEncoder().encode(_0xac2);
    const keyMaterial = await crypto.subtle.importKey('raw', encKey, 'PBKDF2', false, ['deriveKey']);
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encData.buffer);
    const decryptedText = new TextDecoder().decode(decryptedBuffer);

    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(decryptedText));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hashHex !== data.checksum) throw new Error('Checksum mismatch');

    const blob = new Blob([decryptedText], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    return new Promise((resolve, reject) => {
      const msgId = 'INTERNAL_' + Date.now() + '_' + Math.random();

      worker.onmessage = (e) => {
        if (e.data.id === msgId) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          if (e.data.success) resolve(e.data.result);
          else reject(new Error(e.data.error || 'Module execution failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(err);
      };

      worker.postMessage({ id: msgId, action: _0x5c6, payload: _0x7d8 });
    });
  };

  const _C = {
    API: _0x4e12(1),
    PID: _0x4e12(2)
  };

  const _decryptPromptJIT = async (cipherText, licenseKey, deviceId) => {
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) return cipherText; 

      const iv = new Uint8Array(atob(parts[0]).split('').map(c => c.charCodeAt(0)));
      const authTag = new Uint8Array(atob(parts[1]).split('').map(c => c.charCodeAt(0)));
      const encryptedText = new Uint8Array(atob(parts[2]).split('').map(c => c.charCodeAt(0)));

      const encData = new Uint8Array(encryptedText.length + authTag.length);
      encData.set(encryptedText, 0);
      encData.set(authTag, encryptedText.length);

      const secret = licenseKey + '_' + deviceId;
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(secret), {name: "PBKDF2"}, false, ["deriveBits", "deriveKey"]
      );
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("ntsm_salt_v4"), iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encData);
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.error("JIT Decrypt Error", e);
      return "";
    }
  };

  return { _0x4e12, runCore, _C, _initSession, _decryptPromptJIT };
})();
