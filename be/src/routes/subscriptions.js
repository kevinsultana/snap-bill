const fs = require('fs');
const path = require('path');
const express = require('express');
const midtransClient = require('midtrans-client');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');
const { subscriptionLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const PRO_MONTHLY_PRICE = 99000; // Rp 99.000 / bulan

// Penyimpanan order_id langganan yang sudah berhasil diproses agar idempoten (tidak bertambah ganda saat refresh)
const PROCESSED_STORE_FILE = path.join(__dirname, '../../data/processed_subscriptions.json');

function ensureDataDir() {
  const dir = path.dirname(PROCESSED_STORE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getProcessedOrders() {
  try {
    ensureDataDir();
    if (!fs.existsSync(PROCESSED_STORE_FILE)) {
      fs.writeFileSync(PROCESSED_STORE_FILE, JSON.stringify({}), 'utf8');
      return {};
    }
    const content = fs.readFileSync(PROCESSED_STORE_FILE, 'utf8');
    return JSON.parse(content || '{}');
  } catch (err) {
    return {};
  }
}

function isOrderProcessed(orderId) {
  if (!orderId) return false;
  const orders = getProcessedOrders();
  return Boolean(orders[orderId]);
}

function markOrderProcessed(orderId, details) {
  if (!orderId) return;
  try {
    ensureDataDir();
    const orders = getProcessedOrders();
    orders[orderId] = {
      ...details,
      processed_at: new Date().toISOString(),
    };
    fs.writeFileSync(PROCESSED_STORE_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.warn('[processed_orders] Error saving file:', err.message);
  }
}

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

/**
 * Menghitung tanggal berakhir langganan per tanggal penuh (jam 00:00:00 + 1 hari / 23:59:59 WIB)
 * Tidak mengikuti jam transaksi user, melainkan berlaku penuh per tanggal hingga jam 00:00 hari berikutnya.
 */
function calculateSubscriptionExpiry(currentExpiry, daysToAdd = 30) {
  const now = new Date();
  const base = (currentExpiry && new Date(currentExpiry) > now)
    ? new Date(currentExpiry)
    : now;

  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const baseJakarta = new Date(base.getTime() + jakartaOffsetMs);

  // Tambahkan 30 hari + 1 hari dan set jam ke 00:00:00 WIB
  baseJakarta.setUTCDate(baseJakarta.getUTCDate() + daysToAdd + 1);
  baseJakarta.setUTCHours(0, 0, 0, 0);

  return new Date(baseJakarta.getTime() - jakartaOffsetMs);
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

    const now = new Date();
    let isPro =
      user.tier === 'pro' &&
      (!user.subscription_ends_at || new Date(user.subscription_ends_at) > now);

    // Jika masa aktif Pro telah berakhir, otomatis turunkan status tier ke Free
    if (user.tier === 'pro' && user.subscription_ends_at && new Date(user.subscription_ends_at) <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: 'free' },
      });
      user.tier = 'free';
      isPro = false;
    }

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

// POST /api/subscriptions/create-snap ─────────────────────────────────────
// Membuat transaksi Snap untuk berlangganan Pro (Rp 99.000)
router.post('/create-snap', verifyToken, subscriptionLimiter, async (req, res) => {
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
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription?subscribed=check&order_id=${orderId}`,
        unfinish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription?subscribed=pending&order_id=${orderId}`,
        error: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription?subscribed=error&order_id=${orderId}`,
      },
    };

    console.log(`[subscriptions] Membuat transaksi langganan Pro untuk ${user.email} (Order ID: ${orderId})...`);

    const transaction = await snap.createTransaction(parameter);

    return res.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      payment_url: transaction.redirect_url,
      order_id: orderId,
    });
  } catch (err) {
    console.error('[POST /subscriptions/create-snap]', err);
    return res.status(500).json({
      message: err.message || 'Gagal memproses transaksi langganan Midtrans.',
    });
  }
});

// ─── POST /api/subscriptions/check-status & /verify-status ───────────────────
// Memeriksa status transaksi langganan ke Midtrans Core API secara otentik
router.post('/check-status', verifyToken, async (req, res) => {
  return handleSubscriptionStatusCheck(req, res);
});

router.post('/verify-status', verifyToken, async (req, res) => {
  return handleSubscriptionStatusCheck(req, res);
});

async function handleSubscriptionStatusCheck(req, res) {
  try {
    const { order_id } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    if (!order_id) {
      const isPro =
        user.tier === 'pro' &&
        (!user.subscription_ends_at || new Date(user.subscription_ends_at) > new Date());

      return res.json({
        status: isPro ? 'settlement' : 'none',
        isPro,
        tier: user.tier,
        subscription_ends_at: user.subscription_ends_at,
        message: isPro ? 'Akun Anda aktif sebagai Pro.' : 'Belum ada transaksi aktif.',
      });
    }

    const snap = getPlatformSnap();

    try {
      const statusResponse = await snap.transaction.status(order_id);
      const txStatus = (statusResponse.transaction_status || '').toLowerCase();
      const fraudStatus = (statusResponse.fraud_status || '').toLowerCase();

      console.log(`[subscriptions.check-status] Status Midtrans untuk ${order_id}: ${txStatus} (fraud: ${fraudStatus})`);

      const isSuccess =
        txStatus === 'settlement' ||
        (txStatus === 'capture' && (fraudStatus === 'accept' || !fraudStatus));

      if (isSuccess) {
        // Idempoten: Cek apakah transaksi dengan order_id ini sudah pernah diproses
        if (isOrderProcessed(order_id)) {
          console.log(`[subscriptions.check-status] ℹ️ Order ${order_id} sudah pernah diterapkan. Tidak menambah masa aktif lagi.`);
          return res.json({
            status: 'settlement',
            isPro: true,
            message: 'Langganan Pro Anda aktif.',
            user: {
              id: user.id,
              email: user.email,
              tier: user.tier,
              subscription_ends_at: user.subscription_ends_at,
            },
          });
        }

        // Upgrade atau perpanjang Pro tier selama 30 hari per tanggal penuh di jam 00:00+1
        const expiryDate = calculateSubscriptionExpiry(user.subscription_ends_at, 30);

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: 'pro',
            subscription_ends_at: expiryDate,
          },
        });

        // Tandai transaksi order_id ini sudah diproses
        markOrderProcessed(order_id, {
          user_id: user.id,
          email: user.email,
          expiry_date: expiryDate.toISOString(),
        });

        console.log(`[subscriptions] ✅ User ${updatedUser.email} berhasil diperpanjang / di-upgrade ke PRO tier hingga ${expiryDate.toISOString()}.`);

        return res.json({
          status: 'settlement',
          isPro: true,
          message: '🎉 Selamat! Pembayaran langganan Pro Anda berhasil terverifikasi lunas.',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            tier: updatedUser.tier,
            subscription_ends_at: updatedUser.subscription_ends_at,
          },
        });
      }

      if (txStatus === 'pending') {
        return res.json({
          status: 'pending',
          isPro: user.tier === 'pro',
          order_id,
          message: 'Pembayaran masih menunggu penyelesaian (Pending). Silakan lakukan transfer sebelum batas waktu.',
          payment_type: statusResponse.payment_type,
          va_numbers: statusResponse.va_numbers,
          bill_key: statusResponse.bill_key,
          biller_code: statusResponse.biller_code,
          gross_amount: statusResponse.gross_amount,
        });
      }

      if (txStatus === 'expire' || txStatus === 'cancel' || txStatus === 'deny') {
        return res.json({
          status: 'failed',
          isPro: user.tier === 'pro',
          order_id,
          message: `Transaksi pembayaran ${txStatus === 'expire' ? 'telah kedaluwarsa' : 'dibatalkan atau ditolak'}.`,
        });
      }

      return res.json({
        status: txStatus,
        isPro: user.tier === 'pro',
        order_id,
        message: `Status transaksi saat ini: ${txStatus}.`,
      });
    } catch (midtransErr) {
      console.warn(`[subscriptions.check-status] ⚠️ Midtrans API error untuk ${order_id}:`, midtransErr.message);
      return res.status(400).json({
        status: 'error',
        message: `Gagal memeriksa status ke Midtrans: ${midtransErr.message}`,
      });
    }
  } catch (err) {
    console.error('[POST /subscriptions/check-status]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat memeriksa status langganan.' });
  }
}

// ─── POST /api/subscriptions/cancel ──────────────────────────────────────────
// Batalkan langganan Pro dan kembalikan akun ke tier Free
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        tier: 'free',
        subscription_ends_at: null,
      },
    });

    console.log(`[subscriptions] 🚫 Langganan Pro untuk user ${updatedUser.email} dibatalkan.`);

    return res.json({
      message: 'Langganan Pro berhasil dibatalkan. Akun Anda kembali ke paket Free.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
        subscription_ends_at: null,
      },
    });
  } catch (err) {
    console.error('[POST /subscriptions/cancel]', err);
    return res.status(500).json({ message: 'Gagal membatalkan langganan.' });
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

    if (isSuccess && userId && order_id) {
      if (isOrderProcessed(order_id)) {
        console.log(`[subscriptions.webhook] ℹ️ Webhook: Order ${order_id} sudah pernah diproses sebelumnya.`);
        return res.status(200).json({ status: 'OK' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const expiryDate = calculateSubscriptionExpiry(user?.subscription_ends_at, 30);

        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: 'pro',
            subscription_ends_at: expiryDate,
          },
        });

        markOrderProcessed(order_id, {
          user_id: userId,
          email: user.email,
          expiry_date: expiryDate.toISOString(),
        });

        console.log(`[subscriptions.webhook] ✅ Status Pro diperpanjang untuk user ${userId} hingga ${expiryDate.toISOString()}`);
      }
    }

    return res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[POST /subscriptions/webhook]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat memproses webhook.' });
  }
});

module.exports = router;
