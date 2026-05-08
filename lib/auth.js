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
      .limit(1)
      .get();
    
    if (!emailQuery.empty) {
      licenseDoc = emailQuery.docs[0];
      licenseRef = licenseDoc.ref;
      usedKey = licenseDoc.id;
    } else {
      return { valid: false, message: 'Mã kích hoạt hoặc Email không tồn tại.' };
    }
  }

  const data = licenseDoc.data();

  // Check product match
  if (data.productId && data.productId !== productId) {
    return { valid: false, message: 'Mã/Email không đúng sản phẩm.' };
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

  // Fingerprint logic (Max 1 device)
  let fingerprints = data.fingerprints || [];
  
  // Migrate from old deviceId to fingerprints array
  if (data.deviceId && fingerprints.length === 0) {
    fingerprints.push(data.deviceId);
  }

  let isNewDevice = false;
  if (!fingerprints.includes(deviceId)) {
    if (fingerprints.length >= 1) { // User requested max 1 device!
      return { valid: false, message: 'Mã kích hoạt đã đạt giới hạn thiết bị (Tối đa 1).' };
    } else {
      fingerprints.push(deviceId);
      isNewDevice = true;
    }
  }

  const updatePayload = {};
  const currentLoginCount = (data.loginCount || 0) + 1;
  updatePayload.loginCount = currentLoginCount;

  if (isNewDevice || data.deviceId) {
    updatePayload.fingerprints = fingerprints;
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
