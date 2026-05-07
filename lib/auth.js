const { getFirestore } = require('./firebase');

/**
 * Validate a license key and bind it to a deviceId.
 * Returns: { valid, message, expiresAt?, productId? }
 */
async function validateLicense(licenseKey, deviceId, productId) {
  if (!licenseKey || !deviceId || !productId) {
    return { valid: false, message: 'Thiếu thông tin kích hoạt.' };
  }

  const db = getFirestore();
  const licenseRef = db.collection('app_licenses').doc(licenseKey);
  const licenseDoc = await licenseRef.get();

  if (!licenseDoc.exists) {
    return { valid: false, message: 'Mã kích hoạt không tồn tại.' };
  }

  const data = licenseDoc.data();

  // Check product match
  if (data.productId !== productId) {
    return { valid: false, message: 'Mã kích hoạt không đúng sản phẩm.' };
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

  // Check device binding
  if (data.deviceId && data.deviceId !== deviceId) {
    return { valid: false, message: 'Mã kích hoạt đã được sử dụng trên thiết bị khác.' };
  }

  // Bind device on first use
  if (!data.deviceId) {
    await licenseRef.update({
      deviceId: deviceId,
      activatedAt: new Date().toISOString(),
      status: 'active'
    });
  }

  return {
    valid: true,
    message: 'Kích hoạt thành công!',
    expiresAt: data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate().toISOString() : data.expiresAt) : null,
    productId: data.productId
  };
}

module.exports = { validateLicense };
