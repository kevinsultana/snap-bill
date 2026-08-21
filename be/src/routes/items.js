const express = require('express');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Semua route butuh autentikasi
router.use(verifyToken);

// Helper validasi harga
function parsePrice(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return null;
  return num;
}

// GET /api/items — list semua item milik user
router.get('/', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    return res.json(items);
  } catch (err) {
    console.error('[GET /items]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/items/:id — detail satu item
router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.item.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan.' });
    return res.json(item);
  } catch (err) {
    console.error('[GET /items/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/items — buat item baru
router.post('/', async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Nama item wajib diisi.' });
    }
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) {
      return res.status(400).json({ message: 'Harga harus berupa angka positif.' });
    }

    const item = await prisma.item.create({
      data: {
        user_id: req.user.id, // Multi-tenancy: kunci ke user yang login
        name: name.trim(),
        description: description?.trim() || null,
        price: parsedPrice,
      },
    });

    return res.status(201).json({ message: 'Item berhasil ditambahkan.', item });
  } catch (err) {
    console.error('[POST /items]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// PUT /api/items/:id — update item
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Nama item wajib diisi.' });
    }
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) {
      return res.status(400).json({ message: 'Harga harus berupa angka positif.' });
    }

    // Cek kepemilikan sebelum update (Multi-tenancy)
    const existing = await prisma.item.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!existing) return res.status(404).json({ message: 'Item tidak ditemukan.' });

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: parsedPrice,
      },
    });

    return res.json({ message: 'Item berhasil diperbarui.', item });
  } catch (err) {
    console.error('[PUT /items/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/items/:id — hapus item
router.delete('/:id', async (req, res) => {
  try {
    // Cek kepemilikan sebelum hapus (Multi-tenancy)
    const existing = await prisma.item.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!existing) return res.status(404).json({ message: 'Item tidak ditemukan.' });

    await prisma.item.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Item berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /items/:id]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
