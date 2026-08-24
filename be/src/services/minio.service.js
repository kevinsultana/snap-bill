const Minio = require('minio');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const BUCKET_NAME = process.env.MINIO_BUCKET || 'snapbill-receipts';

// Inisialisasi MinIO Client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || '100.110.43.25',
  port: parseInt(process.env.MINIO_PORT, 10) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

// Middleware Multer (Memory Storage) untuk upload file via Express
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Maks 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap unggah gambar (JPG, PNG, WebP) atau PDF.'));
    }
  },
});

/**
 * Memastikan bucket ada di MinIO dan memiliki akses publik read-only
 */
async function ensureBucket(bucketName = BUCKET_NAME) {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`[minio.service] Bucket '${bucketName}' berhasil dibuat.`);
    }

    // Set policy agar file di bucket bisa diakses publik (read-only) untuk preview struk
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(`[minio.service] ✅ Policy public read diterapkan pada bucket '${bucketName}'.`);
  } catch (err) {
    console.warn(`[minio.service] Catatan bucket '${bucketName}':`, err.message);
  }
}

/**
 * Validasi Magic Bytes Buffer untuk memastikan integritas dan tipe file asli
 * Mencegah ekstensi palsu, spoofing Content-Type, dan file upload attacks
 *
 * @param {Buffer} buffer
 * @returns {{ mime: string, ext: string }}
 */
function detectMimeAndExtFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    throw new Error('File buffer kosong atau rusak.');
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // 3. WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  // 4. PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mime: 'application/pdf', ext: '.pdf' };
  }

  throw new Error('Format file tidak valid atau isi file tidak sesuai. Harap unggah berkas gambar (JPG, PNG, WebP) atau PDF yang valid.');
}

/**
 * Upload bukti transfer (receipt) ke MinIO
 *
 * @param {Buffer} buffer - Buffer file dari req.file.buffer
 * @param {string} originalName - Nama asli file
 * @param {string} mimeType - MIME type file
 * @returns {Promise<{ objectName: string, url: string }>}
 */
async function uploadReceipt(buffer, originalName, mimeType) {
  await ensureBucket(BUCKET_NAME);

  // 🔒 Validasi magic bytes secara ketat
  const detected = detectMimeAndExtFromBuffer(buffer);
  const randomStr = crypto.randomBytes(8).toString('hex');
  const objectName = `receipts/${Date.now()}-${randomStr}${detected.ext}`;

  const metaData = {
    'Content-Type': detected.mime,
    'X-Content-Type-Options': 'nosniff',
  };

  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);

  // Buat URL publik MinIO (bersihkan trailing slash)
  const rawHost = process.env.MINIO_PUBLIC_URL || `http://${process.env.MINIO_ENDPOINT || '100.110.43.25'}:${process.env.MINIO_PORT || 9000}`;
  const host = rawHost.replace(/\/+$/, '');
  const url = `${host}/${BUCKET_NAME}/${objectName}`;

  console.log(`[minio.service] ✅ Bukti transfer (${detected.mime}) berhasil diupload ke MinIO: ${url}`);
  return { objectName, url };
}

/**
 * Upload logo bisnis ke MinIO
 *
 * @param {Buffer} buffer - Buffer file logo
 * @param {string} originalName - Nama file asli
 * @param {string} mimeType - MIME type file
 * @returns {Promise<{ objectName: string, url: string }>}
 */
async function uploadLogo(buffer, originalName, mimeType) {
  await ensureBucket(BUCKET_NAME);

  // 🔒 Validasi magic bytes secara ketat (hanya gambar, tolak pdf untuk logo)
  const detected = detectMimeAndExtFromBuffer(buffer);
  if (detected.mime === 'application/pdf') {
    throw new Error('Logo bisnis harus berupa gambar (JPG, PNG, atau WebP), bukan PDF.');
  }

  const randomStr = crypto.randomBytes(8).toString('hex');
  const objectName = `logos/${Date.now()}-${randomStr}${detected.ext}`;

  const metaData = {
    'Content-Type': detected.mime,
    'X-Content-Type-Options': 'nosniff',
  };

  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);

  const rawHost = process.env.MINIO_PUBLIC_URL || `http://${process.env.MINIO_ENDPOINT || '100.110.43.25'}:${process.env.MINIO_PORT || 9000}`;
  const host = rawHost.replace(/\/+$/, '');
  const url = `${host}/${BUCKET_NAME}/${objectName}`;

  console.log(`[minio.service] ✅ Logo bisnis (${detected.mime}) berhasil diupload ke MinIO: ${url}`);
  return { objectName, url };
}

module.exports = {
  minioClient,
  uploadMemory,
  ensureBucket,
  uploadReceipt,
  uploadLogo,
  detectMimeAndExtFromBuffer,
};
