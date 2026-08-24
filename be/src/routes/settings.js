const express = require('express');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');
const { uploadMemory, uploadLogo } = require('../services/minio.service');

const router = express.Router();

// Semua route settings butuh autentikasi
router.use(verifyToken);

/**
 * Sensor Midtrans Secret Key agar hanya menampilkan beberapa karakter terakhir untuk keamanan
 * Contoh: "SB-Mid-server-x12345ABCD" -> "••••••••••••••••ABCD"
 */
function maskSecretKey(key) {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 4) return '••••' + trimmed;
  return '••••••••••••••••' + trimmed.slice(-4);
}

// GET /api/settings — ambil profil user (tanpa password_hash, dan masked Midtrans secret key)
router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        address: true,
        business_name: true,
        logo_url: true,
        tier: true,
        subscription_ends_at: true,
        midtrans_server_key: true,
        midtrans_client_key: true,
        bank_accounts: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const now = new Date();
    if (user.tier === 'pro' && user.subscription_ends_at && new Date(user.subscription_ends_at) <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: 'free' },
      });
      user.tier = 'free';
    }

    const sanitizedUser = {
      ...user,
      midtrans_server_key: maskSecretKey(user.midtrans_server_key),
      midtrans_client_key: maskSecretKey(user.midtrans_client_key),
      has_midtrans_server_key: Boolean(user.midtrans_server_key),
      has_midtrans_client_key: Boolean(user.midtrans_client_key),
    };

    return res.json(sanitizedUser);
  } catch (err) {
    console.error('[GET /settings]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// PUT /api/settings — update profil bisnis, email, no telp, alamat, Midtrans keys, dan bank accounts
router.put('/', async (req, res) => {
  try {
    const {
      email,
      phone,
      address,
      business_name,
      logo_url,
      midtrans_server_key,
      midtrans_client_key,
      bank_accounts,
    } = req.body;

    // Validasi email jika diubah
    if (email !== undefined) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return res.status(400).json({ message: 'Email tidak boleh kosong.' });
      }
      if (trimmedEmail !== req.user.email) {
        const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
        if (existing) {
          return res.status(400).json({ message: 'Email sudah terdaftar oleh akun lain.' });
        }
      }
    }

    // Validasi bank_accounts
    if (bank_accounts !== undefined) {
      if (!Array.isArray(bank_accounts)) {
        return res.status(400).json({ message: 'bank_accounts harus berupa array.' });
      }
      if (bank_accounts.length > 5) {
        return res.status(400).json({ message: 'Maksimal 5 rekening bank.' });
      }
      for (const acc of bank_accounts) {
        if (!acc.bank_name || !acc.account_number) {
          return res.status(400).json({
            message: 'Setiap rekening harus memiliki bank_name dan account_number.',
          });
        }
        if (typeof acc.bank_name !== 'string' || typeof acc.account_number !== 'string') {
          return res.status(400).json({ message: 'bank_name dan account_number harus berupa string.' });
        }
      }
    }

    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isPro =
      currentUser?.tier === 'pro' &&
      (!currentUser.subscription_ends_at || new Date(currentUser.subscription_ends_at) > new Date());

    // Bangun objek update secara selektif
    const updateData = {};
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (business_name !== undefined) updateData.business_name = business_name?.trim() || null;
    if (logo_url !== undefined) updateData.logo_url = logo_url?.trim() || null;

    // Hanya pengguna berstatus PRO yang dapat menyimpan konfigurasi Midtrans BYOK
    if (isPro) {
      if (midtrans_server_key !== undefined) {
        const trimmed = midtrans_server_key?.trim();
        if (trimmed === '') {
          updateData.midtrans_server_key = null;
        } else if (trimmed && !trimmed.startsWith('••••')) {
          // Hanya simpan jika user menginput key baru asli, bukan string sensor bawaan
          updateData.midtrans_server_key = trimmed;
        }
      }
      if (midtrans_client_key !== undefined) {
        const trimmed = midtrans_client_key?.trim();
        if (trimmed === '') {
          updateData.midtrans_client_key = null;
        } else if (trimmed && !trimmed.startsWith('••••')) {
          // Hanya simpan jika user menginput key baru asli, bukan string sensor bawaan
          updateData.midtrans_client_key = trimmed;
        }
      }
    }

    if (bank_accounts !== undefined) updateData.bank_accounts = bank_accounts;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        address: true,
        business_name: true,
        logo_url: true,
        midtrans_server_key: true,
        midtrans_client_key: true,
        bank_accounts: true,
      },
    });

    return res.json({
      message: 'Pengaturan identitas bisnis berhasil disimpan.',
      user: {
        ...updated,
        midtrans_server_key: maskSecretKey(updated.midtrans_server_key),
        midtrans_client_key: maskSecretKey(updated.midtrans_client_key),
        has_midtrans_server_key: Boolean(updated.midtrans_server_key),
        has_midtrans_client_key: Boolean(updated.midtrans_client_key),
      },
    });
  } catch (err) {
    console.error('[PUT /settings]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/settings/logo — upload logo brand bisnis ke MinIO Storage
router.post('/logo', uploadMemory.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Harap pilih file gambar logo.' });
    }

    // Upload ke MinIO bucket (folder logos/)
    const { url } = await uploadLogo(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Simpan url logo ke profil user
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { logo_url: url },
      select: {
        id: true,
        logo_url: true,
      },
    });

    return res.json({
      message: 'Logo bisnis berhasil diunggah.',
      logo_url: updated.logo_url,
    });
  } catch (err) {
    console.error('[POST /settings/logo]', err);
    return res.status(500).json({ message: err.message || 'Gagal mengunggah logo.' });
  }
});

// DELETE /api/settings/logo — hapus logo brand
router.delete('/logo', async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { logo_url: null },
    });

    return res.json({ message: 'Logo bisnis berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /settings/logo]', err);
    return res.status(500).json({ message: 'Gagal menghapus logo.' });
  }
});

module.exports = router;
