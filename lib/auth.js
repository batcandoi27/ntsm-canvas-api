const { getFirestore } = require('./firebase');

/**
 * Validate a license key and bind it to a Firebase UID.
 * Uses UID (permanent) instead of DeviceID (lost on sandbox refresh).
 */
async function validateLicense(licenseKey, userId, productId) {
  if (!licenseKey || !userId || !productId) {
    return { valid: false, message: 'Thiếu thông tin kích hoạt.' };
  }

  const db = getFirestore();
  const licenseRef = db.collection('app_licenses').doc(licenseKey);
  const licenseDoc = await licenseRef.get();

  if (!licenseDoc.exists) {
    return { valid: false, message: 'Mã kích hoạt không tồn tại.' };
  }

  const data = licenseDoc.data();

  if (data.productId !== productId) {
    return { valid: false, message: 'Mã kích hoạt không đúng sản phẩm.' };
  }

  if (data.status === 'revoked') {
    return { valid: false, message: 'Mã kích hoạt đã bị thu hồi.' };
  }

  if (data.expiresAt) {
    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      await licenseRef.update({ status: 'expired' });
      return { valid: false, message: 'Mã kích hoạt đã hết hạn.' };
    }
  }

  // Check user binding - allow SAME user to re-validate (sandbox refresh)
  if (data.userId && data.userId !== userId) {
    return { valid: false, message: 'Mã kích hoạt đã được sử dụng bởi tài khoản khác.' };
  }

  // Bind user on first use or update last access
  await licenseRef.update({
    userId: userId,
    activatedAt: data.activatedAt || new Date().toISOString(),
    lastAccessAt: new Date().toISOString(),
    status: 'active'
  });

  return {
    valid: true,
    message: 'Kích hoạt thành công!',
    expiresAt: data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate().toISOString() : data.expiresAt) : null,
    productId: data.productId
  };
}

module.exports = { validateLicense };
