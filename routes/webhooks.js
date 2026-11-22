// WEBHOOK SEPAY: POST /webhooks/sepay
// Gắn TRƯỚC express.json / session / CSRF vì cần raw body để kiểm tra chữ ký và không dùng cookie
const express = require('express');
const { SEPAY } = require('../utils/env');
const sepay = require('../utils/sepay');
const { processTransfer } = require('../utils/payments');

const router = express.Router();

router.post('/sepay', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
  if (!SEPAY.enabled || !SEPAY.secret) return res.status(503).json({ success: false });
  const valid = sepay.verifySignature({
    secret: SEPAY.secret, rawBody: req.body,
    signature: req.get('X-SePay-Signature'), timestamp: req.get('X-SePay-Timestamp'),
  });
  if (!valid) return res.status(401).json({ success: false });

  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch (_) { return res.status(400).json({ success: false }); }
  try {
    const t = sepay.fromWebhook(body);
    if (t) await processTransfer(SEPAY, t);
    return res.status(200).json({ success: true });   // SePay chỉ coi là thành công khi có đúng body này
  } catch (e) {
    console.error('Lỗi webhook SePay:', e.message);
    return res.status(500).json({ success: false });  // SePay gửi lại; API đối soát cũng sẽ vớt
  }
});

module.exports = router;
