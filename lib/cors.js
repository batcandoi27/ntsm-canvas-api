/**
 * CORS middleware for Vercel serverless functions.
 * Gemini Canvas sandbox runs on a Google domain, so we allow all origins.
 */
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Signal: preflight handled, stop processing
  }

  return false; // Signal: continue processing
}

module.exports = { cors };
