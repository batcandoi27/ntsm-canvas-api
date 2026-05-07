/**
 * CORS middleware for Vercel serverless functions.
 * Gemini Canvas sandbox runs on a Google domain, so we allow all origins.
 */
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Signal: preflight handled, stop processing
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  return false; // Signal: continue processing
}

module.exports = { cors };
