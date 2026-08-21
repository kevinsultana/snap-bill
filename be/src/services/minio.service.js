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
 * Upload bukti transfer (receipt) ke MinIO
 *
 * @param {Buffer} buffer - Buffer file dari req.file.buffer
 * @param {string} originalName - Nama asli file (untuk mendapatkan ekstensi)
 * @param {string} mimeType - MIME type file (misal image/png)
 * @returns {Promise<{ objectName: string, url: string }>}
 */
async function uploadReceipt(buffer, originalName, mimeType) {
  await ensureBucket(BUCKET_NAME);

  const ext = path.extname(originalName) || '.png';
  const randomStr = crypto.randomBytes(8).toString('hex');
  const objectName = `receipts/${Date.now()}-${randomStr}${ext}`;

  const metaData = {
    'Content-Type': mimeType,
  };

  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);

  // Buat URL publik MinIO
  const host = process.env.MINIO_PUBLIC_URL || `http://${process.env.MINIO_ENDPOINT || '100.110.43.25'}:${process.env.MINIO_PORT || 9000}`;
  const url = `${host}/${BUCKET_NAME}/${objectName}`;

  console.log(`[minio.service] ✅ Bukti transfer berhasil diupload ke MinIO: ${url}`);
  return { objectName, url };
}

module.exports = {
  minioClient,
  uploadMemory,
  ensureBucket,
  uploadReceipt,
};
