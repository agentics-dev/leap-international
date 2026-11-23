const { submitEnquiry } = require('../functions/_enquiry');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
  const result = await submitEnquiry(body, process.env);
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
};
