const https    = require('https');
const qs       = require('querystring');

/**
 * Send a WhatsApp message via UltraMsg API.
 * @param {string} phone        - Egyptian phone number (01XXXXXXXXX)
 * @param {string} message      - Message text
 * @param {string} instanceId   - UltraMsg instance ID
 * @param {string} token        - UltraMsg token
 */
function sendWhatsApp(phone, message, instanceId, token) {
  if (!instanceId || !token || !phone) return Promise.resolve();

  // Format: 01XXXXXXXXX → 201XXXXXXXXX
  let to = phone.replace(/\D/g, '');
  if (to.startsWith('0')) to = '2' + to;

  const body = qs.stringify({ token, to, body: message });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.ultramsg.com',
      path:     `/${instanceId}/messages/chat`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', (err) => {
      console.error('WhatsApp send error:', err.message);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

module.exports = sendWhatsApp;
