const rateLimit = require('express-rate-limit');

/**
 * Standard response handler for rate limit exceeded
 */
const createLimitHandler = (message) => (req, res) => {
  return res.status(429).json({
    status: 429,
    error: 'Too Many Requests',
    message: message || 'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba kembali.',
  });
};

/**
 * 1. Global API Rate Limiter
 * Melindungi seluruh endpoint API dari request flooding & scraping
 * Limit: 300 requests per 15 menit per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Batas kuota request API terlampaui. Silakan tunggu beberapa menit.'
  ),
});

/**
 * 2. Auth Rate Limiter (Brute-Force Protection)
 * Melindungi login & registrasi dari password guessing & credential stuffing
 * Limit: 15 percobaan per 15 menit per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Terlalu banyak percobaan autentikasi (login/register). Silakan coba lagi setelah 15 menit.'
  ),
});

/**
 * 3. Public Payment & Receipt Rate Limiter
 * Melindungi portal pembayaran klien & upload bukti transfer dari spamming
 * Limit: 30 requests per 10 menit per IP
 */
const publicPaymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Terlalu banyak permintaan pembayaran atau upload bukti transaksi. Harap tunggu beberapa saat.'
  ),
});

/**
 * 4. PDF Generation Rate Limiter
 * Melindungi server dari resource exhaustion (Puppeteer PDF rendering)
 * Limit: 15 requests per 1 menit per IP
 */
const pdfLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Pembuatan berkas PDF terlalu sering. Harap tunggu 1 menit sebelum mengunduh PDF kembali.'
  ),
});

/**
 * 5. Email Dispatch Rate Limiter
 * Melindungi kuota SMTP email dari pengiriman berulang
 * Limit: 10 requests per 15 menit per IP
 */
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Batas pengiriman email invoice tercapai. Harap tunggu sebelum mengirim email kembali.'
  ),
});

/**
 * 6. Subscription Payment Token Rate Limiter
 * Melindungi pembuatan transaksi upgrade langganan Midtrans
 * Limit: 10 requests per 15 menit per IP
 */
const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler(
    'Terlalu banyak permintaan sesi pembayaran langganan. Harap tunggu beberapa saat.'
  ),
});

module.exports = {
  globalLimiter,
  authLimiter,
  publicPaymentLimiter,
  pdfLimiter,
  emailLimiter,
  subscriptionLimiter,
};
