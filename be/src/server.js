const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const clientRoutes = require('./routes/clients');
const itemRoutes = require('./routes/items');
const invoiceRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');
const publicRoutes = require('./routes/public');
const subscriptionRoutes = require('./routes/subscriptions');

const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Wajib untuk httpOnly cookie
}));
app.use(express.json());
app.use(cookieParser());

// Global API rate limit
app.use('/api', globalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

const { initCronJobs } = require('./services/cron.service');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  // Inisialisasi otomatis cron jobs saat server start
  initCronJobs();
});

module.exports = app;
