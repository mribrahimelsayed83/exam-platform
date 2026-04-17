const https = require('https');

/**
 * Send WhatsApp message via Green API (free: 5000 msg/month).
 * Dashboard: https://console.green-api.com
 *
 * @param {string} phone        - Egyptian phone e.g. 01XXXXXXXXX
 * @param {string} message      - Message text
 * @param {string} instanceId   - Green API instance ID
 * @param {string} token        - Green API token
 */
function sendWhatsApp(phone, message, instanceId, token) {
  if (!instanceId || !token || !phone) return Promise.resolve();

  // Format: 01XXXXXXXXX → 201XXXXXXXXX@c.us
  let num = phone.replace(/\D/g, '');
  if (num.startsWith('0')) num = '2' + num;
  const chatId = `${num}@c.us`;

  const body = JSON.stringify({ chatId, message });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.green-api.com',
      path:     `/waInstance${instanceId}/sendMessage/${token}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
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
