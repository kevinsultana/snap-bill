const express = require('express');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');

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

// ─── GET /api/invoices ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { user_id: req.user.id },
      include: {
        client: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return res.json(invoices);
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

// ─── POST /api/invoices ── Buat draft baru ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { client_id, issue_date, due_date, tax_rate, discount, items } = req.body;

    if (!client_id) return res.status(400).json({ message: 'Klien wajib dipilih.' });
    if (!issue_date) return res.status(400).json({ message: 'Tanggal invoice wajib diisi.' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Minimal satu item harus ditambahkan.' });

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
    const { subtotal, total } = calcTotals(items, tax_rate, discount);

    // Gunakan transaksi Prisma untuk atomicity
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          user_id: req.user.id,
          client_id,
          invoice_number,
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

    return res.status(201).json({ message: 'Draft invoice berhasil dibuat.', invoice });
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
