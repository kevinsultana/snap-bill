const express = require('express');
const prisma = require('../db/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Semua route dashboard memerlukan autentikasi
router.use(verifyToken);

/**
 * Helper function to compute comprehensive dashboard analytics using Prisma aggregations
 */
async function getDashboardAnalytics(userId) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Range bulan berjalan (Current Month)
  const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  // Range bulan lalu (Previous Month untuk perbandingan trend / MoM growth)
  const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  // Range 6 bulan terakhir untuk monthly trend chart
  const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1, 0, 0, 0, 0);

  // 1. Total outstanding (unpaid) invoice amount & breakdown
  // Invoices yang belum lunas: 'unpaid', 'overdue', 'pending_verification'
  const [
    outstandingAgg,
    unpaidAgg,
    overdueAgg,
    pendingVerifAgg,
    monthlyPaidAgg,
    prevMonthlyPaidAgg,
    totalPaidAgg,
    totalAllInvoicesCount,
    statusGroups,
    topClientsGroup,
    recentInvoices,
    totalClientsCount,
  ] = await Promise.all([
    // a) Total outstanding (unpaid + overdue + pending_verification)
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: { in: ['unpaid', 'overdue', 'pending_verification'] },
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // Breakdown: unpaid status
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'unpaid',
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // Breakdown: overdue status
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'overdue',
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // Breakdown: pending_verification status
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'pending_verification',
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // b) Total monthly revenue (paid invoices for the current month)
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'paid',
        created_at: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // Monthly revenue bulan lalu (untuk hitung pertumbuhan MoM)
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'paid',
        created_at: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // All-time total paid revenue
    prisma.invoice.aggregate({
      where: {
        user_id: userId,
        status: 'paid',
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    // Total semua invoice dibuat
    prisma.invoice.count({
      where: { user_id: userId },
    }),

    // Grouping by status (semua count & sum per status)
    prisma.invoice.groupBy({
      by: ['status'],
      where: { user_id: userId },
      _count: { id: true },
      _sum: { total: true },
    }),

    // c) Top 5 clients by revenue or transaction volume
    prisma.invoice.groupBy({
      by: ['client_id'],
      where: {
        user_id: userId,
        status: 'paid',
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: {
        _sum: { total: 'desc' },
      },
      take: 5,
    }),

    // 5 Invoice terbaru untuk quick preview
    prisma.invoice.findMany({
      where: { user_id: userId },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    }),

    // Total jumlah klien
    prisma.client.count({
      where: { user_id: userId },
    }),
  ]);

  // Jika belum ada invoice paid untuk top clients, ambil fallback top 5 clients by total volume (semua non-cancelled)
  let resolvedTopClients = topClientsGroup;
  if (!resolvedTopClients || resolvedTopClients.length === 0) {
    resolvedTopClients = await prisma.invoice.groupBy({
      by: ['client_id'],
      where: {
        user_id: userId,
        status: { notIn: ['cancelled'] },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: {
        _sum: { total: 'desc' },
      },
      take: 5,
    });
  }

  // Ambil detail nama, email, phone untuk client_id dari top clients
  const clientIds = resolvedTopClients.map((item) => item.client_id).filter(Boolean);
  let clientsMap = {};
  if (clientIds.length > 0) {
    const clientsList = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, email: true, phone: true, address: true },
    });
    clientsMap = clientsList.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
  }

  const topClients = resolvedTopClients.map((item, index) => {
    const client = clientsMap[item.client_id] || { name: 'Klien #' + (index + 1), email: null };
    return {
      client_id: item.client_id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      total_revenue: parseFloat(item._sum?.total || 0),
      total_invoices: item._count?.id || 0,
    };
  });

  // Format Status Counts & Amounts Map
  const statusStats = {
    draft: { count: 0, total: 0 },
    unpaid: { count: 0, total: 0 },
    pending_verification: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    overdue: { count: 0, total: 0 },
    cancelled: { count: 0, total: 0 },
  };

  statusGroups.forEach((g) => {
    if (g.status && statusStats[g.status]) {
      statusStats[g.status] = {
        count: g._count.id || 0,
        total: parseFloat(g._sum.total || 0),
      };
    }
  });

  // Monthly Revenue & MoM Growth calculation
  const currentMonthRevenue = parseFloat(monthlyPaidAgg._sum?.total || 0);
  const prevMonthRevenue = parseFloat(prevMonthlyPaidAgg._sum?.total || 0);
  let momGrowthPercentage = 0;
  if (prevMonthRevenue > 0) {
    momGrowthPercentage = parseFloat((((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1));
  } else if (currentMonthRevenue > 0) {
    momGrowthPercentage = 100;
  }

  // Monthly trend for last 6 months (untuk chart atau bar progress)
  const past6MonthsInvoices = await prisma.invoice.findMany({
    where: {
      user_id: userId,
      status: 'paid',
      created_at: { gte: sixMonthsAgo },
    },
    select: {
      total: true,
      created_at: true,
    },
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthlyTrends = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const mIndex = d.getMonth();
    const yNum = d.getFullYear();
    const label = `${monthNames[mIndex]} ${yNum.toString().slice(-2)}`;

    const sumTotal = past6MonthsInvoices
      .filter((inv) => {
        const invDate = new Date(inv.created_at);
        return invDate.getMonth() === mIndex && invDate.getFullYear() === yNum;
      })
      .reduce((s, inv) => s + parseFloat(inv.total || 0), 0);

    monthlyTrends.push({
      label,
      month: mIndex + 1,
      year: yNum,
      revenue: sumTotal,
    });
  }

  return {
    outstanding: {
      total_amount: parseFloat(outstandingAgg._sum?.total || 0),
      total_count: outstandingAgg._count?.id || 0,
      breakdown: {
        unpaid: {
          total_amount: parseFloat(unpaidAgg._sum?.total || 0),
          count: unpaidAgg._count?.id || 0,
        },
        overdue: {
          total_amount: parseFloat(overdueAgg._sum?.total || 0),
          count: overdueAgg._count?.id || 0,
        },
        pending_verification: {
          total_amount: parseFloat(pendingVerifAgg._sum?.total || 0),
          count: pendingVerifAgg._count?.id || 0,
        },
      },
    },
    monthly_revenue: {
      total_amount: currentMonthRevenue,
      paid_count: monthlyPaidAgg._count?.id || 0,
      prev_month_amount: prevMonthRevenue,
      mom_growth_percentage: momGrowthPercentage,
      current_month_name: monthNames[currentMonth],
      current_year: currentYear,
    },
    total_revenue: {
      total_amount: parseFloat(totalPaidAgg._sum?.total || 0),
      paid_count: totalPaidAgg._count?.id || 0,
    },
    top_clients: topClients,
    status_stats: statusStats,
    counts: {
      total_invoices: totalAllInvoicesCount,
      total_clients: totalClientsCount,
      paid_invoices: statusStats.paid.count,
      unpaid_invoices: statusStats.unpaid.count,
      pending_verification_invoices: statusStats.pending_verification.count,
      overdue_invoices: statusStats.overdue.count,
      draft_invoices: statusStats.draft.count,
    },
    monthly_trends: monthlyTrends,
    recent_invoices: recentInvoices,
  };
}

// ─── GET /api/dashboard/analytics ─────────────────────────────────────────────
// Mengambil seluruh metrik analitik agregasi Prisma
router.get('/analytics', async (req, res) => {
  try {
    const data = await getDashboardAnalytics(req.user.id);
    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[GET /api/dashboard/analytics]', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses data analitik dashboard.',
    });
  }
});

// ─── GET /api/dashboard/stats ── Alias endpoint ───────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const data = await getDashboardAnalytics(req.user.id);
    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[GET /api/dashboard/stats]', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses statistik.',
    });
  }
});

// ─── GET /api/dashboard ── Root dashboard endpoint ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await getDashboardAnalytics(req.user.id);
    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[GET /api/dashboard]', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server.',
    });
  }
});

module.exports = router;
module.exports.getDashboardAnalytics = getDashboardAnalytics;
