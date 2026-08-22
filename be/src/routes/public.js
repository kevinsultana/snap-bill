const express = require('express');
const midtransClient = require('midtrans-client');
const prisma = require('../db/prisma');
const { uploadMemory, uploadReceipt } = require('../services/minio.service');
const { generateInvoicePDF } = require('../services/pdf.service');
const { createSnapTransaction } = require('../services/midtrans.service');

const router = express.Router();

// ─── GET /api/public/invoices/:token ─────────────────────────────────────────
// Fetch rincian tagihan beserta data rekening bank dari pemilik usaha
// TIDAK menggunakan middleware autentikasi JWT
router.get('/invoices/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Token invoice tidak valid.' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { public_link_token: token },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan atau link pembayaran tidak valid.' });
    }

    const isPro =
      invoice.user?.tier === 'pro' &&
      (!invoice.user.subscription_ends_at || new Date(invoice.user.subscription_ends_at) > new Date());
    const hasByok = Boolean(isPro && invoice.user?.midtrans_server_key);

    let paymentUrl = invoice.payment_url;

    // Jika pemilik usaha adalah PRO & memiliki Midtrans BYOK, buat payment_url otomatis jika belum ada
    if (hasByok && !paymentUrl && invoice.status !== 'paid') {
      try {
        const snapRes = await createSnapTransaction({
          serverKey: invoice.user.midtrans_server_key,
          clientKey: invoice.user.midtrans_client_key || '',
          invoice,
          client: invoice.client,
          items: invoice.items,
        });
        paymentUrl = snapRes.redirect_url;
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { payment_url: paymentUrl },
        });
      } catch (snapErr) {
        console.warn('[public.get] Gagal on-demand Midtrans Snap:', snapErr.message);
      }
    }

    // Format response aman tanpa mengekspos midtrans_server_key
    const safeUser = {
      id: invoice.user?.id,
      business_name: invoice.user?.business_name,
      email: invoice.user?.email,
      phone: invoice.user?.phone,
      address: invoice.user?.address,
      logo_url: invoice.user?.logo_url,
      bank_accounts: invoice.user?.bank_accounts,
      tier: invoice.user?.tier,
      has_midtrans: hasByok,
    };

    return res.json({
      ...invoice,
      payment_url: paymentUrl,
      user: safeUser,
    });
  } catch (err) {
    console.error('[GET /api/public/invoices/:token]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat memuat tagihan.' });
  }
});

// ─── POST /api/public/invoices/:token/pay-snap ────────────────────────────────
// On-demand Midtrans Snap payment session generator
router.post('/invoices/:token/pay-snap', async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: { public_link_token: token },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Invoice ini sudah lunas.' });
    }

    const isPro =
      invoice.user?.tier === 'pro' &&
      (!invoice.user.subscription_ends_at || new Date(invoice.user.subscription_ends_at) > new Date());

    if (!isPro || !invoice.user?.midtrans_server_key) {
      return res.status(403).json({
        message: 'Pemilik invoice belum mengaktifkan pembayaran otomatis Midtrans.',
      });
    }

    const snapRes = await createSnapTransaction({
      serverKey: invoice.user.midtrans_server_key,
      clientKey: invoice.user.midtrans_client_key || '',
      invoice,
      client: invoice.client,
      items: invoice.items,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { payment_url: snapRes.redirect_url },
    });

    return res.json({
      token: snapRes.token,
      redirect_url: snapRes.redirect_url,
    });
  } catch (err) {
    console.error('[POST /public/invoices/:token/pay-snap]', err);
    return res.status(500).json({
      message: err.message || 'Gagal membuat sesi pembayaran Midtrans.',
    });
  }
});

// ─── POST /api/public/invoices/:token/check-status ────────────────────────────
// Mengecek status pembayaran langsung ke Midtrans API dan update database jika sukses
router.post('/invoices/:token/check-status', async (req, res) => {
  try {
    const { token } = req.params;
    const { order_id } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { public_link_token: token },
      include: {
        user: true,
        client: true,
        items: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    if (invoice.status === 'paid') {
      return res.json({
        status: 'paid',
        invoice,
        message: 'Invoice sudah berstatus lunas.',
      });
    }

    const serverKey = invoice.user?.midtrans_server_key;
    if (!serverKey) {
      return res.json({
        status: invoice.status,
        invoice,
        message: 'Pemilik invoice belum mengatur Midtrans.',
      });
    }

    let isProd = false;
    if (process.env.MIDTRANS_IS_PRODUCTION !== undefined) {
      isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    } else if (process.env.PLATFORM_MIDTRANS_IS_PRODUCTION !== undefined) {
      isProd = process.env.PLATFORM_MIDTRANS_IS_PRODUCTION === 'true';
    } else {
      isProd = !serverKey.startsWith('SB-');
    }

    const snap = new midtransClient.Snap({
      isProduction: isProd,
      serverKey: serverKey.trim(),
      clientKey: invoice.user?.midtrans_client_key || '',
    });

    if (order_id) {
      try {
        const statusResponse = await snap.transaction.status(order_id);
        console.log(`[check-status] Status Midtrans untuk ${order_id}: ${statusResponse.transaction_status}`);

        const txStatus = (statusResponse.transaction_status || '').toLowerCase();
        const fraudStatus = (statusResponse.fraud_status || '').toLowerCase();
        const isSuccess =
          txStatus === 'settlement' ||
          (txStatus === 'capture' && (fraudStatus === 'accept' || !fraudStatus));

        if (isSuccess) {
          const updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'paid',
            },
            include: {
              client: true,
              items: true,
            },
          });

          console.log(`[check-status] ✅ Invoice #${invoice.invoice_number} berhasil diupdate ke LUNAS.`);

          return res.json({
            status: 'paid',
            invoice: updatedInvoice,
            message: '🎉 Pembayaran terverifikasi lunas oleh Midtrans!',
          });
        }

        if (txStatus === 'cancel' || txStatus === 'expire' || txStatus === 'deny') {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              payment_url: null,
            },
          });
        }
      } catch (midtransErr) {
        console.warn('[check-status] Error status Midtrans:', midtransErr.message);
      }
    }

    return res.json({
      status: invoice.status,
      invoice,
      message: 'Status invoice saat ini: ' + invoice.status,
    });
  } catch (err) {
    console.error('[POST /public/invoices/:token/check-status]', err);
    return res.status(500).json({ message: 'Gagal mengecek status pembayaran.' });
  }
});

// ─── POST /api/public/midtrans-webhook ────────────────────────────────────────
// Webhook handler otomatis untuk notifikasi pelunasan invoice klien via Midtrans BYOK
router.post('/midtrans-webhook', async (req, res) => {
  try {
    const { order_id, transaction_status, fraud_status } = req.body;
    console.log(`[public.midtrans-webhook] Menerima notifikasi untuk ${order_id}: ${transaction_status}`);

    if (!order_id) {
      return res.status(400).json({ message: 'order_id wajib disertakan.' });
    }

    // Format order_id: INV-YYYYMM-XXXX-timestamp
    const parts = order_id.split('-');
    const invoiceNumber = parts.slice(0, 3).join('-');

    const txStatus = (transaction_status || '').toLowerCase();
    const fStatus = (fraud_status || '').toLowerCase();

    const isSuccess =
      txStatus === 'settlement' ||
      (txStatus === 'capture' && (fStatus === 'accept' || !fStatus));

    const isCancelledOrExpired =
      txStatus === 'cancel' ||
      txStatus === 'expire' ||
      txStatus === 'deny';

    if (isSuccess && invoiceNumber) {
      const inv = await prisma.invoice.findFirst({
        where: { invoice_number: invoiceNumber },
      });

      if (inv && inv.status !== 'paid') {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status: 'paid',
          },
        });
        console.log(`[public.midtrans-webhook] ✅ Invoice #${invoiceNumber} otomatis diubah ke LUNAS (Paid).`);
      }
    } else if (isCancelledOrExpired && invoiceNumber) {
      const inv = await prisma.invoice.findFirst({
        where: { invoice_number: invoiceNumber },
      });

      if (inv && inv.status !== 'paid') {
        // Reset payment_url agar saat klien klik bayar lagi, sesi Midtrans baru otomatis ter-generate
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            payment_url: null,
          },
        });
        console.log(`[public.midtrans-webhook] ℹ️ Sesi Midtrans Invoice #${invoiceNumber} ${transaction_status}. payment_url direset untuk pembuatan sesi baru.`);
      }
    }

    return res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[POST /public/midtrans-webhook]', err);
    return res.status(500).json({ message: 'Gagal memproses webhook.' });
  }
});

// ─── GET /api/public/invoices/:token/pdf ──────────────────────────────────────
// Unduh PDF langsung dari link publik
router.get('/invoices/:token/pdf', async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: { public_link_token: token },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice);

    const filename = `Invoice-${invoice.invoice_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[GET /public/invoices/:token/pdf]', err);
    return res.status(500).json({ message: 'Gagal membuat file PDF invoice.' });
  }
});

// ─── POST /api/public/invoices/:token/upload-receipt ──────────────────────────
// Upload bukti transfer ke MinIO dan ubah status menjadi pending_verification
router.post(
  '/invoices/:token/upload-receipt',
  uploadMemory.single('receipt'),
  async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: 'Token invoice tidak valid.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Harap pilih file bukti transfer yang ingin diunggah.' });
      }

      // Pastikan invoice dengan token ini ada
      const invoice = await prisma.invoice.findFirst({
        where: { public_link_token: token },
      });

      if (!invoice) {
        return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
      }

      if (invoice.status === 'paid') {
        return res.status(400).json({ message: 'Invoice ini sudah lunas, tidak perlu mengunggah bukti transfer lagi.' });
      }

      // Upload file ke MinIO
      const uploadResult = await uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Update database: receipt_url dan ubah status ke pending_verification
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          receipt_url: uploadResult.url,
          status: 'pending_verification',
        },
        include: {
          client: true,
          items: true,
        },
      });

      console.log(`[public.route] ✅ Bukti transfer Invoice #${invoice.invoice_number} berhasil diunggah.`);

      return res.json({
        message: 'Bukti pembayaran berhasil diunggah! Status pembayaran kini menunggu verifikasi.',
        invoice: updatedInvoice,
        receipt_url: uploadResult.url,
      });
    } catch (err) {
      console.error('[POST /api/public/invoices/:token/upload-receipt]', err);
      return res.status(500).json({
        message: err.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.',
      });
    }
  }
);

module.exports = router;
