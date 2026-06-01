const { getFirestore } = require('./firebase');

/**
 * Validate a license key or email and bind it to a device fingerprint.
 * Allows mapping an email to a license key for easier access.
 * Returns: { valid, message, expiresAt?, productId?, isNewEmail?, licenseKey? }
 */
async function validateLicense(inputKeyOrEmail, deviceId, productId, linkEmail = null) {
  if (!inputKeyOrEmail || !deviceId || !productId) {
    return { valid: false, message: 'Thiếu thông tin kích hoạt.' };
  }

  const db = getFirestore();
  let licenseDoc = null;
  let licenseRef = null;
  let usedKey = inputKeyOrEmail;

  // Try to treat input as license key first
  licenseRef = db.collection('app_licenses').doc(inputKeyOrEmail);
  licenseDoc = await licenseRef.get();

  // If not found by ID, try to find by mapped email
  if (!licenseDoc.exists) {
    const emailQuery = await db.collection('app_licenses')
      .where('email', '==', inputKeyOrEmail.toLowerCase())
      .get();
    
    if (!emailQuery.empty) {
      // User might have multiple keys linked to the same email.
      // We must find one that either already has this deviceId, or has room for it.
      let bestDoc = emailQuery.docs[0];
      for (const doc of emailQuery.docs) {
        const d = doc.data();
        const fKey = `fingerprints_${productId}`;
        const fps = d[fKey] || d.fingerprints || [];
        
        // If this license already belongs to this device, it's a perfect match!
        if (fps.includes(deviceId) || d.deviceId === deviceId) {
          bestDoc = doc;
          break;
        }
        // If it has no devices yet, it's also a good candidate
        if (fps.length === 0 && !d.deviceId) {
          bestDoc = doc;
        }
      }
      
      licenseDoc = bestDoc;
      licenseRef = licenseDoc.ref;
      usedKey = licenseDoc.id;
    } else {
      return { valid: false, message: 'Mã kích hoạt hoặc Email không tồn tại.' };
    }
  }

  const data = licenseDoc.data();

  // Check product compatibility (Multi-product support)
  // - Nếu key có field allowedProducts (array), chỉ cho phép các product trong danh sách
  // - Nếu key có field productId (legacy), cho phép TẤT CẢ product (backward compatible)
  // - Ví dụ: key gốc productId="chuyenword" vẫn dùng được cho "thaycoai_vsto"
  if (data.allowedProducts && Array.isArray(data.allowedProducts)) {
    if (!data.allowedProducts.includes(productId)) {
      return { valid: false, message: 'Mã/Email không đúng sản phẩm.' };
    }
  }

  // Check status
  if (data.status === 'revoked') {
    return { valid: false, message: 'Mã kích hoạt đã bị thu hồi.' };
  }

  // Check expiry
  if (data.expiresAt) {
    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      await licenseRef.update({ status: 'expired' });
      return { valid: false, message: 'Mã kích hoạt đã hết hạn.' };
    }
  }

  // Fingerprint logic - PHÂN TÁCH THEO PRODUCT ID
  // Mỗi productId có mảng fingerprint riêng biệt (tối đa 1 thiết bị/product)
  // VD: fingerprints_chuyenword = ["browser-fp"], fingerprints_thaycoai_vsto = ["hw-uuid"]
  // => Cho phép cùng 1 key dùng trên cả Webapp LẪN VSTO mà không xung đột
  
  const fpKey = `fingerprints_${productId}`;  // VD: "fingerprints_chuyenword" hoặc "fingerprints_thaycoai_vsto"
  let productFingerprints = data[fpKey] || [];
  
  // Backward compatibility: Migrate from old global fingerprints/deviceId sang product-specific
  if (productFingerprints.length === 0) {
    const legacyFp = data.fingerprints || [];
    const legacyDeviceId = data.deviceId;
    
    // Chỉ migrate nếu chưa có fingerprint cho product này VÀ product trùng với product gốc
    if (legacyFp.length > 0 && (data.productId === productId || !data.productId)) {
      productFingerprints = [...legacyFp];
    } else if (legacyDeviceId && (data.productId === productId || !data.productId)) {
      productFingerprints = [legacyDeviceId];
    }
  }

  let isNewDevice = false;
  if (!productFingerprints.includes(deviceId)) {
    if (productFingerprints.length >= 1) { // Tối đa 1 thiết bị PER PRODUCT
      return { valid: false, message: `Mã kích hoạt đã đạt giới hạn thiết bị cho ${productId} (Tối đa 1).` };
    } else {
      productFingerprints.push(deviceId);
      isNewDevice = true;
    }
  }

  const updatePayload = {};
  const currentLoginCount = (data.loginCount || 0) + 1;
  updatePayload.loginCount = currentLoginCount;

  if (isNewDevice || data.deviceId) {
    updatePayload[fpKey] = productFingerprints;
    updatePayload.deviceId = null; // Clear old legacy field
  }

  if (data.status !== 'active') {
    updatePayload.activatedAt = new Date().toISOString();
    updatePayload.status = 'active';
  }

  // Link email if provided and not already linked
  let isNewEmailLinked = false;
  if (linkEmail && !data.email) {
    updatePayload.email = linkEmail.toLowerCase();
    isNewEmailLinked = true;
  }

  if (Object.keys(updatePayload).length > 0) {
    await licenseRef.update(updatePayload);
  }

  return {
    valid: true,
    message: 'Kích hoạt thành công!',
    expiresAt: data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate().toISOString() : data.expiresAt) : null,
    productId: data.productId || productId,
    licenseKey: usedKey,
    mappedEmail: updatePayload.email || data.email || null,
    loginCount: currentLoginCount,
    isNewEmailLinked,
    hasLinkedEmail: !!data.email || isNewEmailLinked
  };
}

module.exports = { validateLicense };
