const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
};

// Helper: buat JWT dan set cookie
function issueToken(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  res.cookie('token', token, COOKIE_OPTIONS);
  return token;
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, phone, business_name } = req.body;

    // 1. Validasi Keberadaan Field Wajib
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Alamat email wajib diisi.' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Format alamat email tidak valid.' });
    }

    // 3. Validasi Format Nomor Telepon (jika diisi)
    let cleanPhone = null;
    if (phone && phone.trim() !== '') {
      cleanPhone = phone.trim().replace(/[\s-]/g, '');
      // Format Indonesia (+62 / 62 / 08xx) atau format internasional 9-15 digit
      const phoneRegex = /^(?:\+?62|0)8[1-9][0-9]{6,11}$/;
      const generalPhoneRegex = /^\+?[0-9]{9,15}$/;
      if (!phoneRegex.test(cleanPhone) && !generalPhoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          message: 'Nomor telepon tidak valid. Gunakan format seperti 08123456789 atau +628123456789.',
        });
      }
    }

    // 4. Validasi Kekuatan Password
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password minimal terdiri dari 8 karakter.' });
    }

    // 5. Cek Duplikasi Email
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ message: 'Alamat email sudah terdaftar. Silakan gunakan email lain atau masuk.' });
    }

    // 6. Buat Akun Baru (Default Free Tier)
    const password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password_hash,
        phone: cleanPhone,
        business_name: business_name?.trim() || null,
        tier: 'free',
      },
    });

    issueToken(res, user);
    return res.status(201).json({
      message: 'Registrasi berhasil! Selamat datang di SnapBill.',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        business_name: user.business_name,
        tier: user.tier,
      },
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat registrasi.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    issueToken(res, user);
    return res.json({
      message: 'Login berhasil.',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        business_name: user.business_name,
        tier: user.tier,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  return res.json({ message: 'Logout berhasil.' });
});

module.exports = router;
