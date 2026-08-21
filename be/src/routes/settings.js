const express = require('express');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Semua route settings butuh autentikasi
router.use(verifyToken);

// GET /api/settings — ambil profil user (tanpa password_hash)
router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
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

    return res.json(user);
  } catch (err) {
    console.error('[GET /settings]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// PUT /api/settings — update Midtrans keys dan bank accounts
router.put('/', async (req, res) => {
  try {
    const { midtrans_server_key, midtrans_client_key, bank_accounts, business_name, phone } = req.body;

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

    // Bangun objek update secara selektif
    const updateData = {};
    if (midtrans_server_key !== undefined) updateData.midtrans_server_key = midtrans_server_key;
    if (midtrans_client_key !== undefined) updateData.midtrans_client_key = midtrans_client_key;
    if (bank_accounts !== undefined) updateData.bank_accounts = bank_accounts;
    if (business_name !== undefined) updateData.business_name = business_name;
    if (phone !== undefined) updateData.phone = phone;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        business_name: true,
        midtrans_server_key: true,
        midtrans_client_key: true,
        bank_accounts: true,
      },
    });

    return res.json({ message: 'Pengaturan berhasil disimpan.', user: updated });
  } catch (err) {
    console.error('[PUT /settings]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
