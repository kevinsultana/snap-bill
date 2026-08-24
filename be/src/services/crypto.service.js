const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for GCM
const PREFIX = 'enc:v1:';

// Kunci enkripsi 32-byte (256 bits) yang diturunkan dari APP_ENCRYPTION_KEY atau JWT_SECRET
const RAW_KEY =
  process.env.APP_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  'snapbill-secret-encryption-master-key-2026';

const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

/**
 * Enkripsi teks rahasia (seperti Midtrans Server Key) menggunakan AES-256-GCM
 * Format hasil: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * @param {string} text - Teks plaintext yang akan dienkripsi
 * @returns {string} - Teks terenkripsi dengan auth tag
 */
function encryptSecret(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (trimmed === '') return '';

  // Jika sudah terenkripsi, jangan enkripsi ulang
  if (trimmed.startsWith(PREFIX)) return trimmed;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(trimmed, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `${PREFIX}${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi teks rahasia AES-256-GCM
 *
 * @param {string} cipherText - Teks terenkripsi format enc:v1:...
 * @returns {string} - Teks plaintext asli
 */
function decryptSecret(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  const trimmed = cipherText.trim();
  if (trimmed === '') return '';

  // Jika belum berformat enc:v1: (misal data legacy), kembalikan langsung
  if (!trimmed.startsWith(PREFIX)) {
    return trimmed;
  }

  try {
    const parts = trimmed.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
      console.warn('[crypto.service] ⚠️ Format ciphertext tidak valid, mengembalikan raw string.');
      return trimmed;
    }

    const [ivHex, authTagHex, encryptedData] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[crypto.service] ❌ Gagal mendekripsi secret:', err.message);
    return trimmed;
  }
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
