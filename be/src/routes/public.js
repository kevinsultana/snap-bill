const express = require('express');
const midtransClient = require('midtrans-client');
const prisma = require('../db/prisma');
const { uploadMemory, uploadReceipt } = require('../services/minio.service');
const { generateInvoicePDF } = require('../services/pdf.service');
const { createSnapTransaction, verifyMidtransSignature } = require('../services/midtrans.service');
const { sendPaymentSuccessEmail } = require('../services/email.service');
const { publicPaymentLimiter, pdfLimiter } = require('../middleware/rateLimiter');
const { decryptSecret } = require('../services/crypto.service');

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

    const paymentUrl = hasByok ? invoice.payment_url : null;

    // Format response aman tanpa mengekspos midtrans_server_key
    const safeUser = {
      id: invoice.user?.id,
      business_name: invoice.user?.business_name,
      email: invoice.user?.email,
      phone: invoice.user?.phone,
      address: invoice.user?.address,
      logo_url: invoice.user?.logo_url,
      bank_accounts: invoice.user?.bank_accounts,
      tier: isPro ? 'pro' : 'free',
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

// ─── POST /api/public/invoices/:token/pay & /pay-snap ─────────────────────────
// On-demand Midtrans Snap payment session generator
async function handlePaySnap(req, res) {
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

    if (invoice.status === 'draft') {
      return res.status(400).json({ message: 'Invoice ini masih dalam status draft dan belum diterbitkan secara resmi oleh pemilik usaha.' });
    }

    const isPro =
      invoice.user?.tier === 'pro' &&
      (!invoice.user.subscription_ends_at || new Date(invoice.user.subscription_ends_at) > new Date());

    const rawServerKey = invoice.user?.midtrans_server_key;
    const plainServerKey = decryptSecret(rawServerKey);
    const plainClientKey = decryptSecret(invoice.user?.midtrans_client_key || '');

    if (!isPro || !plainServerKey) {
      return res.status(403).json({
        message: 'Pemilik invoice belum mengaktifkan pembayaran otomatis Midtrans.',
      });
    }

    const snapRes = await createSnapTransaction({
      serverKey: plainServerKey,
      clientKey: plainClientKey,
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
      payment_url: snapRes.redirect_url,
    });
  } catch (err) {
    console.error('[POST /public/invoices/:token/pay-snap]', err);
    return res.status(500).json({
      message: err.message || 'Gagal membuat sesi pembayaran Midtrans.',
    });
  }
}

router.post('/invoices/:token/pay', publicPaymentLimiter, handlePaySnap);
router.post('/invoices/:token/pay-snap', publicPaymentLimiter, handlePaySnap);

// ─── POST /api/public/invoices/:token/check-status ────────────────────────────
// Mengecek status pembayaran langsung ke Midtrans API dan update database jika sukses
router.post('/invoices/:token/check-status', publicPaymentLimiter, async (req, res) => {
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

    const rawServerKey = invoice.user?.midtrans_server_key;
    const plainServerKey = decryptSecret(rawServerKey);
    const plainClientKey = decryptSecret(invoice.user?.midtrans_client_key || '');

    if (!plainServerKey) {
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
      isProd = !plainServerKey.startsWith('SB-');
    }

    const snap = new midtransClient.Snap({
      isProduction: isProd,
      serverKey: plainServerKey.trim(),
      clientKey: plainClientKey,
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
              user: true,
            },
          });

          console.log(`[check-status] ✅ Invoice #${invoice.invoice_number} berhasil diupdate ke LUNAS.`);

          // Kirim email terima kasih & kuitansi ke klien
          sendPaymentSuccessEmail({
            invoice: updatedInvoice,
            paymentMethod: 'Midtrans Online Payment',
          }).catch((emailErr) => {
            console.warn('[check-status] ⚠️ Gagal mengirim email terima kasih:', emailErr.message);
          });

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
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = req.body;

    console.log(`[public.midtrans-webhook] Menerima notifikasi untuk ${order_id}: ${transaction_status}`);

    if (!order_id) {
      return res.status(400).json({ message: 'order_id wajib disertakan.' });
    }

    // Format order_id: INV-YYYYMM-XXXX-timestamp
    const parts = order_id.split('-');
    const invoiceNumber = parts.slice(0, 3).join('-');

    if (!invoiceNumber) {
      return res.status(400).json({ message: 'Format order_id tidak valid.' });
    }

    const inv = await prisma.invoice.findFirst({
      where: { invoice_number: invoiceNumber },
      include: {
        client: true,
        user: true,
        items: true,
      },
    });

    if (!inv) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    // 🔒 Verifikasi Keamanan: Validasi HMAC SHA-512 Signature Key dari Midtrans
    const plainServerKey = decryptSecret(inv.user?.midtrans_server_key);
    if (!plainServerKey) {
      return res.status(400).json({ message: 'Kunci Midtrans pemilik invoice tidak ditemukan.' });
    }

    const isValidSignature = verifyMidtransSignature({
      orderId: order_id,
      statusCode: String(status_code || ''),
      grossAmount: String(gross_amount || ''),
      serverKey: plainServerKey,
      signatureKey: String(signature_key || ''),
    });

    if (!isValidSignature) {
      console.warn(`[public.midtrans-webhook] ⚠️ Signature verification FAILED untuk order ${order_id}. Request ditolak.`);
      return res.status(401).json({ message: 'Invalid Midtrans signature key.' });
    }

    const txStatus = (transaction_status || '').toLowerCase();
    const fStatus = (fraud_status || '').toLowerCase();

    const isSuccess =
      txStatus === 'settlement' ||
      (txStatus === 'capture' && (fStatus === 'accept' || !fStatus));

    const isCancelledOrExpired =
      txStatus === 'cancel' ||
      txStatus === 'expire' ||
      txStatus === 'deny';

    if (isSuccess) {
      if (inv.status !== 'paid') {
        const updatedInv = await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status: 'paid',
          },
          include: {
            client: true,
            user: true,
            items: true,
          },
        });
        console.log(`[public.midtrans-webhook] ✅ Invoice #${invoiceNumber} otomatis diverifikasi & diubah ke LUNAS (Paid).`);

        // Kirim email terima kasih & kuitansi ke klien
        sendPaymentSuccessEmail({
          invoice: updatedInv,
          paymentMethod: 'Midtrans Online Payment',
        }).catch((emailErr) => {
          console.warn('[midtrans-webhook] ⚠️ Gagal mengirim email terima kasih:', emailErr.message);
        });
      }
    } else if (isCancelledOrExpired) {
      if (inv.status !== 'paid') {
        // Reset payment_url agar saat klien klik bayar lagi, sesi Midtrans baru otomatis ter-generate
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            payment_url: null,
          },
        });
        console.log(`[public.midtrans-webhook] ℹ️ Sesi Midtrans Invoice #${invoiceNumber} ${transaction_status}. payment_url direset.`);
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
router.get('/invoices/:token/pdf', pdfLimiter, async (req, res) => {
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

// ─── POST /api/public/invoices/:token/receipt & /upload-receipt ──────────────
// Upload bukti transfer ke MinIO dan ubah status menjadi pending_verification
async function handleReceiptUpload(req, res) {
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

    if (invoice.status === 'draft') {
      return res.status(400).json({ message: 'Invoice ini masih dalam status draft dan belum diterbitkan secara resmi oleh pemilik usaha.' });
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
    console.error('[POST /api/public/invoices/:token/receipt]', err);
    return res.status(500).json({
      message: err.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.',
    });
  }
}

router.post('/invoices/:token/receipt', publicPaymentLimiter, uploadMemory.single('receipt'), handleReceiptUpload);
router.post('/invoices/:token/upload-receipt', publicPaymentLimiter, uploadMemory.single('receipt'), handleReceiptUpload);

module.exports = router;
