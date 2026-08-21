const express = require('express');
const prisma = require('../db/prisma');
const { uploadMemory, uploadReceipt } = require('../services/minio.service');
const { generateInvoicePDF } = require('../services/pdf.service');

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
        user: {
          select: {
            id: true,
            business_name: true,
            email: true,
            phone: true,
            address: true,
            logo_url: true,
            bank_accounts: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan atau link pembayaran tidak valid.' });
    }

    return res.json(invoice);
  } catch (err) {
    console.error('[GET /api/public/invoices/:token]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat memuat tagihan.' });
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
