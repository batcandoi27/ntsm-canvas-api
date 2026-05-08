const { cors } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const { password } = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD || 'batcandoi27';

    if (!password || password !== adminPassword) {
      return res.status(401).json({ success: false, message: 'Sai mật khẩu quản trị.' });
    }

    return res.status(200).json({ success: true, message: 'Đăng nhập thành công.' });
  } catch (error) {
    console.error('Admin Auth Error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
};
