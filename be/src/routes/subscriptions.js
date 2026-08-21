const express = require('express');
const midtransClient = require('midtrans-client');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const PRO_MONTHLY_PRICE = 99000; // Rp 99.000 / bulan

/**
 * Inisialisasi Midtrans Snap untuk Platform Subscription
 */
function getPlatformSnap() {
  const serverKey = (
    process.env.PLATFORM_MIDTRANS_SERVER_KEY ||
    process.env.MIDTRANS_SERVER_KEY ||
    'SB-Mid-server-your-platform-key'
  ).trim();

  const clientKey = (
    process.env.PLATFORM_MIDTRANS_CLIENT_KEY ||
    process.env.MIDTRANS_CLIENT_KEY ||
    ''
  ).trim();

  // Mode Sandbox vs Production: Utamakan konfigurasi explicit dari .env jika ada
  let isProduction = false;
  if (process.env.PLATFORM_MIDTRANS_IS_PRODUCTION !== undefined) {
    isProduction = process.env.PLATFORM_MIDTRANS_IS_PRODUCTION === 'true';
  } else if (process.env.MIDTRANS_IS_PRODUCTION !== undefined) {
    isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  } else {
    isProduction = !serverKey.startsWith('SB-') && serverKey !== 'SB-Mid-server-your-platform-key';
  }

  return new midtransClient.Snap({
    isProduction,
    serverKey,
    clientKey,
  });
}

// ─── GET /api/subscriptions/status ───────────────────────────────────────────
// Mengambil status langganan dan jumlah invoice bulan ini
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        tier: true,
        subscription_ends_at: true,
      },
    });

    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

    // Hitung jumlah invoice yang dibuat pada bulan berjalan
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const invoiceCountThisMonth = await prisma.invoice.count({
      where: {
        user_id: req.user.id,
        created_at: { gte: startOfMonth },
      },
    });

    const isPro =
      user.tier === 'pro' &&
      (!user.subscription_ends_at || new Date(user.subscription_ends_at) > new Date());

    return res.json({
      tier: isPro ? 'pro' : 'free',
      subscription_ends_at: user.subscription_ends_at,
      invoiceCountThisMonth,
      monthlyLimit: isPro ? 'unlimited' : 10,
      remainingInvoices: isPro ? 'unlimited' : Math.max(0, 10 - invoiceCountThisMonth),
    });
  } catch (err) {
    console.error('[GET /subscriptions/status]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ─── POST /api/subscriptions/create-snap ─────────────────────────────────────
// Membuat transaksi Snap untuk berlangganan Pro (Rp 99.000)
router.post('/create-snap', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

    // Midtrans membatasi order_id maks 50 karakter.
    // Format: SUB-{compactUuid32}-{timestamp10} = 47 karakter (aman dan valid)
    const compactUuid = user.id.replace(/-/g, '');
    const timestampSec = Math.floor(Date.now() / 1000);
    const orderId = `SUB-${compactUuid}-${timestampSec}`;
    const snap = getPlatformSnap();

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: PRO_MONTHLY_PRICE,
      },
      customer_details: {
        first_name: user.business_name || user.email.split('@')[0],
        email: user.email,
        phone: user.phone || undefined,
      },
      item_details: [
        {
          id: 'PRO-1-MONTH',
          price: PRO_MONTHLY_PRICE,
          quantity: 1,
          name: 'SnapBill SaaS - Paket Pro (1 Bulan)',
        },
      ],
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?subscribed=success`,
      },
    };

    console.log(`[subscriptions] Membuat transaksi langganan Pro untuk ${user.email} (Order ID: ${orderId})...`);

    const transaction = await snap.createTransaction(parameter);

    return res.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id: orderId,
    });
  } catch (err) {
    console.error('[POST /subscriptions/create-snap]', err);
    return res.status(500).json({
      message: err.message || 'Gagal memproses transaksi langganan Midtrans.',
    });
  }
});

// ─── POST /api/subscriptions/verify-status ───────────────────────────────────
// Verifikasi manual setelah redirect sukses dari Midtrans
router.post('/verify-status', verifyToken, async (req, res) => {
  try {
    // Tambahkan 30 hari masa aktif Pro
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        tier: 'pro',
        subscription_ends_at: expiryDate,
      },
    });

    console.log(`[subscriptions] ✅ User ${updatedUser.email} berhasil di-upgrade ke PRO tier hingga ${expiryDate.toISOString()}.`);

    return res.json({
      message: 'Selamat! Akun Anda berhasil di-upgrade ke Paket PRO.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
        subscription_ends_at: updatedUser.subscription_ends_at,
      },
    });
  } catch (err) {
    console.error('[POST /subscriptions/verify-status]', err);
    return res.status(500).json({ message: 'Gagal memperbarui status langganan.' });
  }
});

// ─── POST /api/subscriptions/webhook ─────────────────────────────────────────
// Webhook handler otomatis dari Midtrans (tanpa auth middleware)
router.post('/webhook', async (req, res) => {
  try {
    const notification = req.body;
    const { order_id, transaction_status, fraud_status } = notification;

    console.log(`[subscriptions.webhook] Menerima notifikasi untuk ${order_id}: ${transaction_status}`);

    if (!order_id || !order_id.startsWith('SUB-')) {
      return res.status(200).json({ message: 'Bukan transaksi langganan.' });
    }

    const parts = order_id.split('-');
    // Format: SUB-{compactUuid32}-{timestamp}
    const rawId = parts[1];
    const userId = (rawId && rawId.length === 32)
      ? rawId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
      : rawId;

    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    if (isSuccess && userId) {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: 'pro',
          subscription_ends_at: expiryDate,
        },
      });

      console.log(`[subscriptions.webhook] ✅ Status Pro aktif untuk user ${userId} hingga ${expiryDate.toISOString()}`);
    }

    return res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[POST /subscriptions/webhook]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat memproses webhook.' });
  }
});

module.exports = router;
