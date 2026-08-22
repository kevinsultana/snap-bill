const express = require('express');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/pdf.service');
const { sendEmail, sendPaymentSuccessEmail } = require('../services/email.service');
const { createSnapTransaction } = require('../services/midtrans.service');

const router = express.Router();
router.use(verifyToken);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Hitung subtotal, discount, tax, total dari array items */
function calcTotals(items, taxRate = 0, discount = 0) {
  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.unit_price) * parseFloat(it.quantity),
    0
  );
  const discountAmt = parseFloat(discount) || 0;
  const taxAmt = ((subtotal - discountAmt) * (parseFloat(taxRate) || 0)) / 100;
  const total = subtotal - discountAmt + taxAmt;
  return { subtotal, total };
}

/** Generate nomor invoice unik per user: INV-YYYYMM-XXXX */
async function generateInvoiceNumber(userId) {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const last = await prisma.invoice.findFirst({
    where: { user_id: userId, invoice_number: { startsWith: prefix } },
    orderBy: { invoice_number: 'desc' },
  });
  const lastNum = last ? parseInt(last.invoice_number.split('-')[2] || '0', 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

// ─── GET /api/invoices (Pagination, Server Search & DB Counts) ────────────────
router.get('/', async (req, res) => {
  try {
    const { page, limit = 10, search, status, channel, all } = req.query;

    // Jika 'all=true' atau tanpa pagination/search parameter, kembalikan array penuh untuk dashboard/compatibility
    if (all === 'true' || (!page && !search && !status && !channel && req.query.paginate !== 'true')) {
      const invoices = await prisma.invoice.findMany({
        where: { user_id: req.user.id },
        include: {
          client: { select: { id: true, name: true, email: true } },
          items: true,
        },
        orderBy: { created_at: 'desc' },
      });
      if (req.query.paginate !== 'true' && !page) {
        return res.json(invoices);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * take;

    const where = { user_id: req.user.id };
    const andConditions = [];

    if (status && status !== 'all') {
      andConditions.push({ status });
    }

    if (channel === 'manual') {
      andConditions.push({
        OR: [{ receipt_url: { not: null } }, { status: 'pending_verification' }],
      });
    } else if (channel === 'midtrans') {
      andConditions.push({
        payment_url: { not: null },
        receipt_url: null,
        status: { not: 'pending_verification' },
      });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { invoice_number: { contains: q, mode: 'insensitive' } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Ambil total data & rincian count dari DB secara paralel
    const [statusGroups, allInvoicesCount, midtransCount, manualCount, totalFiltered, data] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['status'],
        where: { user_id: req.user.id },
        _count: { id: true },
      }),
      prisma.invoice.count({ where: { user_id: req.user.id } }),
      prisma.invoice.count({
        where: {
          user_id: req.user.id,
          payment_url: { not: null },
          receipt_url: null,
          status: { not: 'pending_verification' },
        },
      }),
      prisma.invoice.count({
        where: {
          user_id: req.user.id,
          OR: [{ receipt_url: { not: null } }, { status: 'pending_verification' }],
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          items: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);

    const statusCounts = {
      draft: 0,
      unpaid: 0,
      pending_verification: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };
    statusGroups.forEach((g) => {
      if (g.status) statusCounts[g.status] = g._count.id;
    });

    return res.json({
      data,
      total: totalFiltered,
      totalAll: allInvoicesCount,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(totalFiltered / take) || 1,
      counts: statusCounts,
      channelCounts: {
        all: allInvoicesCount,
        midtrans: midtransCount,
        manual: manualCount,
      },
    });
  } catch (err) {
    console.error('[GET /invoices]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
      include: {
        client: true,
        items: true,
      },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    return res.json(invoice);
  } catch (err) {
    console.error('[GET /invoices/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ─── GET /api/invoices/:id/pdf ── Download / Stream PDF Invoice ───────────────
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
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
    console.error('[GET /invoices/:id/pdf]', err);
    return res.status(500).json({ message: 'Gagal membuat file PDF invoice.' });
  }
});

// ─── POST /api/invoices ── Buat draft baru ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { client_id, issue_date, due_date, tax_rate, discount, items } = req.body;

    if (!client_id) return res.status(400).json({ message: 'Klien wajib dipilih.' });
    if (!issue_date) return res.status(400).json({ message: 'Tanggal invoice wajib diisi.' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Minimal satu item harus ditambahkan.' });

    // Cek batas kuota Free Tier (Maksimal 10 invoice per bulan kalender)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isPro = user?.tier === 'pro' && (!user.subscription_ends_at || new Date(user.subscription_ends_at) > new Date());

    if (!isPro) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const countThisMonth = await prisma.invoice.count({
        where: {
          user_id: req.user.id,
          created_at: { gte: startOfMonth },
        },
      });

      if (countThisMonth >= 10) {
        return res.status(403).json({
          message: 'Batas kuota 10 invoice per bulan untuk akun Free telah tercapai. Upgrade ke paket Pro untuk invoice tak terbatas!',
          code: 'TIER_LIMIT_REACHED',
          limit: 10,
          current: countThisMonth,
        });
      }
    }

    // Validasi kepemilikan klien (multi-tenancy)
    const client = await prisma.client.findFirst({
      where: { id: client_id, user_id: req.user.id },
    });
    if (!client) return res.status(404).json({ message: 'Klien tidak ditemukan.' });

    // Validasi setiap baris item
    for (const it of items) {
      if (!it.item_name?.trim()) return res.status(400).json({ message: 'Nama item wajib diisi.' });
      if (parseFloat(it.unit_price) < 0 || isNaN(parseFloat(it.unit_price)))
        return res.status(400).json({ message: 'Harga satuan tidak valid.' });
      if (parseFloat(it.quantity) <= 0 || isNaN(parseFloat(it.quantity)))
        return res.status(400).json({ message: 'Jumlah harus lebih dari 0.' });
    }

    const invoice_number = await generateInvoiceNumber(req.user.id);
    const public_link_token = crypto.randomBytes(16).toString('hex');
    const { subtotal, total } = calcTotals(items, tax_rate, discount);

    // Gunakan transaksi Prisma untuk atomicity
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          user_id: req.user.id,
          client_id,
          invoice_number,
          public_link_token,
          status: 'draft',
          issue_date: new Date(issue_date),
          due_date: due_date ? new Date(due_date) : null,
          tax_rate: parseFloat(tax_rate) || 0,
          discount: parseFloat(discount) || 0,
          subtotal,
          total,
        },
      });

      await tx.invoiceItem.createMany({
        data: items.map((it) => ({
          invoice_id: inv.id,
          item_name: it.item_name.trim(),
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.unit_price),
          total_price: parseFloat(it.quantity) * parseFloat(it.unit_price),
        })),
      });

      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { client: true, items: true },
      });
    });

    return res.status(201).json({
      ...invoice,
      message: 'Draft invoice berhasil dibuat.',
      invoice,
    });
  } catch (err) {
    console.error('[POST /invoices]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ─── PUT /api/invoices/:id ── Update draft (Prisma Transaction) ───────────────
router.put('/:id', async (req, res) => {
  try {
    const { client_id, issue_date, due_date, tax_rate, discount, items } = req.body;

    // Hanya draft yang bisa diedit
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!existing) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    if (existing.status !== 'draft')
      return res.status(409).json({ message: 'Hanya invoice berstatus draft yang dapat diedit.' });

    if (!client_id) return res.status(400).json({ message: 'Klien wajib dipilih.' });
    if (!issue_date) return res.status(400).json({ message: 'Tanggal invoice wajib diisi.' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Minimal satu item harus ditambahkan.' });

    // Validasi kepemilikan klien
    const client = await prisma.client.findFirst({
      where: { id: client_id, user_id: req.user.id },
    });
    if (!client) return res.status(404).json({ message: 'Klien tidak ditemukan.' });

    const { subtotal, total } = calcTotals(items, tax_rate, discount);

    const invoice = await prisma.$transaction(async (tx) => {
      // Hapus semua item lama lalu buat ulang (replace strategy)
      await tx.invoiceItem.deleteMany({ where: { invoice_id: req.params.id } });

      const inv = await tx.invoice.update({
        where: { id: req.params.id },
        data: {
          client_id,
          issue_date: new Date(issue_date),
          due_date: due_date ? new Date(due_date) : null,
          tax_rate: parseFloat(tax_rate) || 0,
          discount: parseFloat(discount) || 0,
          subtotal,
          total,
        },
      });

      await tx.invoiceItem.createMany({
        data: items.map((it) => ({
          invoice_id: inv.id,
          item_name: it.item_name.trim(),
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.unit_price),
          total_price: parseFloat(it.quantity) * parseFloat(it.unit_price),
        })),
      });

      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { client: true, items: true },
      });
    });

    return res.json({ message: 'Invoice berhasil diperbarui.', invoice });
  } catch (err) {
    console.error('[PUT /invoices/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ─── POST /api/invoices/:id/submit ── Submit invoice (ubah status -> unpaid, Midtrans, PDF, Email) ───
router.post('/:id/submit', async (req, res) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!existing) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });

    // Pastikan token link publik tersedia
    let publicToken = existing.public_link_token;
    if (!publicToken) {
      publicToken = crypto.randomBytes(16).toString('hex');
    }

    let paymentUrl = existing.payment_url;

    // 1. Generate Midtrans Snap URL jika user sudah konfigurasi Midtrans Server Key
    if (existing.user?.midtrans_server_key) {
      try {
        const snapRes = await createSnapTransaction({
          serverKey: existing.user.midtrans_server_key,
          clientKey: existing.user.midtrans_client_key || '',
          invoice: { ...existing, public_link_token: publicToken },
          client: existing.client,
          items: existing.items,
        });
        paymentUrl = snapRes.redirect_url;
      } catch (midtransErr) {
        console.warn('[submit] ⚠️ Gagal membuat transaksi Midtrans:', midtransErr.message);
        // Tetap lanjutkan submit meskipun Midtrans opsional
      }
    }

    // 2. Update status invoice ke 'unpaid', simpan token & payment_url
    const updatedInvoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        status: 'unpaid',
        public_link_token: publicToken,
        payment_url: paymentUrl,
      },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    // 3. Generate PDF Invoice menggunakan Puppeteer
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF(updatedInvoice);
    } catch (pdfErr) {
      console.warn('[submit] ⚠️ Gagal generate PDF invoice:', pdfErr.message);
    }

    // 4. Kirim Email ke Klien jika email klien terdaftar
    const clientEmail = updatedInvoice.client?.email;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const payUrl = `${frontendUrl}/pay/${publicToken}`;

    if (clientEmail) {
      try {
        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 28px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Tagihan Baru dari ${updatedInvoice.user?.business_name || 'SnapBill'}</h1>
              <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Invoice #${updatedInvoice.invoice_number}</p>
            </div>
            
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Halo <b>${updatedInvoice.client?.name}</b>,</p>
              <p>Terima kasih atas kerja sama Anda. Tagihan Anda dengan nomor <b>#${updatedInvoice.invoice_number}</b> sejumlah <b>Rp ${Number(updatedInvoice.total).toLocaleString('id-ID')}</b> telah diterbitkan.</p>
              
              <div style="margin: 28px 0; text-align: center;">
                <a href="${payUrl}" style="background: #6366f1; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  💳 Bayar Tagihan Sekarang
                </a>
              </div>
              
              <p style="font-size: 13px; color: #64748b;">
                Atau salin tautan berikut ke browser Anda:<br/>
                <a href="${payUrl}" style="color: #6366f1; word-break: break-all;">${payUrl}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh SnapBill. File invoice PDF terlampir pada email ini.
              </p>
            </div>
          </div>
        `;

        const attachments = pdfBuffer
          ? [
              {
                filename: `Invoice-${updatedInvoice.invoice_number}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ]
          : [];

        await sendEmail({
          to: clientEmail,
          subject: `Tagihan Invoice #${updatedInvoice.invoice_number} dari ${updatedInvoice.user?.business_name || 'SnapBill'}`,
          html: emailHtml,
          attachments,
        });
      } catch (emailErr) {
        console.warn('[submit] ⚠️ Gagal mengirim email ke klien:', emailErr.message);
      }
    }

    return res.json({
      message: 'Invoice berhasil disubmit dan diterbitkan ke klien.',
      invoice: updatedInvoice,
      public_link: payUrl,
    });
  } catch (err) {
    console.error('[POST /invoices/:id/submit]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat submit invoice.' });
  }
});

// ─── POST /api/invoices/:id/resend-email ── Kirim ulang email invoice ke klien ───
router.post('/:id/resend-email', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    const clientEmail = invoice.client?.email;
    if (!clientEmail) {
      return res.status(400).json({
        message: 'Klien ini tidak memiliki alamat email yang terdaftar. Harap lengkapi email klien terlebih dahulu.',
      });
    }

    // Pastikan token public link sudah ada
    let publicToken = invoice.public_link_token;
    if (!publicToken) {
      publicToken = crypto.randomBytes(16).toString('hex');
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { public_link_token: publicToken },
      });
    }

    // Generate PDF Invoice
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF({ ...invoice, public_link_token: publicToken });
    } catch (pdfErr) {
      console.warn('[resend-email] ⚠️ Gagal generate PDF invoice:', pdfErr.message);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const payUrl = `${frontendUrl}/pay/${publicToken}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 28px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Pengingat Tagihan Invoice</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Invoice #${invoice.invoice_number} dari ${invoice.user?.business_name || 'SnapBill'}</p>
        </div>
        
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Halo <b>${invoice.client?.name}</b>,</p>
          <p>Ini adalah pengingat/salinan tagihan Anda untuk Invoice <b>#${invoice.invoice_number}</b> dengan total <b>Rp ${Number(invoice.total).toLocaleString('id-ID')}</b>.</p>
          
          <div style="margin: 28px 0; text-align: center;">
            <a href="${payUrl}" style="background: #6366f1; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);">
              💳 Bayar / Buka Portal Tagihan
            </a>
          </div>
          
          <p style="font-size: 13px; color: #64748b;">
            Atau salin tautan berikut ke browser Anda:<br/>
            <a href="${payUrl}" style="color: #6366f1; word-break: break-all;">${payUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            Email ini dikirim secara otomatis oleh SnapBill. File invoice PDF terlampir pada email ini.
          </p>
        </div>
      </div>
    `;

    const attachments = pdfBuffer
      ? [
          {
            filename: `Invoice-${invoice.invoice_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [];

    const sendRes = await sendEmail({
      to: clientEmail,
      subject: `[Pengingat] Tagihan Invoice #${invoice.invoice_number} dari ${invoice.user?.business_name || 'SnapBill'}`,
      html: emailHtml,
      attachments,
    });

    return res.json({
      success: true,
      message: `Email invoice #${invoice.invoice_number} berhasil dikirimkan ulang ke ${clientEmail}.`,
      provider: sendRes?.provider,
    });
  } catch (err) {
    console.error('[POST /invoices/:id/resend-email]', err);
    return res.status(500).json({
      message: err.message || 'Gagal mengirim ulang email invoice. Periksa konfigurasi email SMTP di backend.',
    });
  }
});

// ─── POST /api/invoices/:id/verify ── Verifikasi bukti transfer (Approve / Reject) ───
router.post('/:id/verify', async (req, res) => {
  try {
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action harus berupa 'approve' atau 'reject'." });
    }

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    let updateData = {};

    if (action === 'approve') {
      updateData = {
        status: 'paid',
      };
    } else if (action === 'reject') {
      updateData = {
        status: 'unpaid',
        receipt_url: null, // Hapus bukti yang ditolak agar klien dapat mengunggah ulang
      };
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    const actionText = action === 'approve' ? 'disetujui (LUNAS)' : 'ditolak (kembali ke Belum Dibayar)';
    console.log(`[invoices.verify] ✅ Pembayaran Invoice #${existing.invoice_number} ${actionText}.`);

    // Kirim email terima kasih & kuitansi jika disetujui (LUNAS)
    if (action === 'approve') {
      sendPaymentSuccessEmail({
        invoice: updatedInvoice,
        paymentMethod: 'Transfer Bank (Verifikasi Manual)',
      }).catch((emailErr) => {
        console.warn('[invoices.verify] ⚠️ Gagal mengirim email terima kasih:', emailErr.message);
      });
    }

    return res.json({
      message: `Pembayaran invoice berhasil ${actionText}.`,
      invoice: updatedInvoice,
    });
  } catch (err) {
    console.error('[POST /invoices/:id/verify]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat memverifikasi pembayaran.' });
  }
});

// ─── POST /api/invoices/:id/cancel ── Batalkan Invoice (status -> cancelled) ───
router.post('/:id/cancel', async (req, res) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    if (existing.status === 'paid') {
      return res.status(400).json({ message: 'Invoice yang sudah lunas tidak dapat dibatalkan.' });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'cancelled',
        payment_url: null,
      },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    console.log(`[invoices.cancel] 🚫 Invoice #${existing.invoice_number} berhasil dibatalkan.`);

    return res.json({
      message: `Invoice #${existing.invoice_number} berhasil dibatalkan.`,
      invoice: updatedInvoice,
    });
  } catch (err) {
    console.error('[POST /invoices/:id/cancel]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat membatalkan invoice.' });
  }
});

// ─── POST /api/invoices/:id/refresh-midtrans ── Ajukan ulang / Buat ulang sesi Midtrans ───
router.post('/:id/refresh-midtrans', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
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

    // Pastikan token public link sudah ada
    let publicToken = invoice.public_link_token;
    if (!publicToken) {
      publicToken = crypto.randomBytes(16).toString('hex');
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { public_link_token: publicToken },
      });
    }

    let newPaymentUrl = null;
    const isPro =
      invoice.user?.tier === 'pro' &&
      (!invoice.user.subscription_ends_at || new Date(invoice.user.subscription_ends_at) > new Date());

    if (isPro && invoice.user?.midtrans_server_key) {
      try {
        const snapRes = await createSnapTransaction({
          serverKey: invoice.user.midtrans_server_key,
          clientKey: invoice.user.midtrans_client_key || '',
          invoice: { ...invoice, public_link_token: publicToken },
          client: invoice.client,
          items: invoice.items,
        });
        newPaymentUrl = snapRes.redirect_url;
      } catch (midtransErr) {
        console.warn('[refresh-midtrans] ⚠️ Gagal membuat sesi Midtrans baru:', midtransErr.message);
        return res.status(500).json({
          message: `Gagal membuat transaksi baru ke Midtrans: ${midtransErr.message}`,
        });
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'unpaid',
        payment_url: newPaymentUrl,
        public_link_token: publicToken,
      },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    console.log(`[invoices.refresh-midtrans] 🔄 Sesi Midtrans baru berhasil dibuat untuk Invoice #${invoice.invoice_number}`);

    return res.json({
      message: `Invoice #${invoice.invoice_number} aktif kembali dan sesi pembayaran Midtrans berhasil dibuat ulang!`,
      invoice: updatedInvoice,
      payment_url: newPaymentUrl,
    });
  } catch (err) {
    console.error('[POST /invoices/:id/refresh-midtrans]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui sesi Midtrans.' });
  }
});

// ─── DELETE /api/invoices/:id ── Hanya boleh hapus draft ─────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!existing) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    if (existing.status !== 'draft')
      return res.status(409).json({ message: 'Hanya invoice draft yang dapat dihapus.' });

    // InvoiceItems terhapus otomatis (onDelete: Cascade di schema)
    await prisma.invoice.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Invoice berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /invoices/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
