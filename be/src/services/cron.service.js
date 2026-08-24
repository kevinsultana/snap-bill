const cron = require('node-cron');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { sendOverdueReminderEmail } = require('./email.service');

/**
 * Generate a unique invoice number per user: INV-YYYYMM-XXXX
 */
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

/**
 * Task 1: Automated Overdue Invoices Check & Email Reminders
 * - Finds invoices with status 'unpaid' / 'overdue' where due_date < today
 * - Updates status to 'overdue'
 * - Sends reminder email to client with a 3-day cooldown safeguard
 */
async function runOverdueRemindersCheck() {
  console.log('[cron.service] 🔍 [1/2] Memulai pengecekan invoice jatuh tempo (Overdue Reminders)...');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  try {
    // 1. Ambil invoice yang belum lunas dan telah melewati tanggal jatuh tempo
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['unpaid', 'overdue'] },
        due_date: {
          not: null,
          lt: todayStart,
        },
      },
      include: {
        client: true,
        user: true,
        items: true,
      },
    });

    console.log(`[cron.service] 📋 Ditemukan ${overdueInvoices.length} invoice yang telah melewati tanggal jatuh tempo.`);

    let reminderCount = 0;
    let updatedStatusCount = 0;

    for (const inv of overdueInvoices) {
      try {
        // Update status ke 'overdue' jika sebelumnya masih 'unpaid'
        if (inv.status === 'unpaid') {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { status: 'overdue' },
          });
          updatedStatusCount++;
        }

        // Cek safeguard anti-spam: Jangan kirim pengingat jika sudah dikirim dalam 3 hari terakhir
        const lastSent = inv.last_reminder_sent_at ? new Date(inv.last_reminder_sent_at) : null;
        const shouldSendReminder = !lastSent || (now.getTime() - lastSent.getTime()) >= THREE_DAYS_MS;

        if (shouldSendReminder && inv.client?.email) {
          console.log(`[cron.service] 📤 Mengirim pengingat overdue untuk #${inv.invoice_number} ke ${inv.client.email}...`);
          
          await sendOverdueReminderEmail({ invoice: inv });
          
          // Update timestamp last_reminder_sent_at
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { last_reminder_sent_at: now },
          });

          reminderCount++;
        } else if (!shouldSendReminder) {
          console.log(`[cron.service] ⏳ Skip email #${inv.invoice_number} (pengingat terakhir baru dikirim pada ${lastSent.toISOString()})`);
        }
      } catch (itemErr) {
        console.error(`[cron.service] ❌ Gagal memproses invoice #${inv.invoice_number}:`, itemErr.message);
      }
    }

    console.log(`[cron.service] ✅ Selesai pengecekan overdue: ${updatedStatusCount} status diperbarui ke overdue, ${reminderCount} email pengingat terkirim.`);
  } catch (err) {
    console.error('[cron.service] ❌ Terjadi error pada job overdue reminders:', err.message);
  }
}

/**
 * Task 2: Recurring Invoices (Subscription Auto-generation)
 * - Finds active subscriptions where next_billing_date <= today
 * - Generates a new invoice with line items
 * - Calculates next_billing_date (e.g. +1 month)
 * - Saves both inside a prisma.$transaction for data integrity
 */
async function runRecurringInvoicesCheck() {
  console.log('[cron.service] 🔄 [2/2] Memulai pembuatan invoice langganan berulang (Recurring Subscriptions)...');
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  try {
    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        next_billing_date: {
          lte: todayEnd,
        },
      },
      include: {
        user: true,
        client: true,
      },
    });

    console.log(`[cron.service] 📋 Ditemukan ${dueSubscriptions.length} langganan aktif yang jatuh tempo penagihan.`);

    let generatedCount = 0;

    for (const sub of dueSubscriptions) {
      try {
        const userId = sub.user_id;
        const clientId = sub.client_id;
        const invoiceNumber = await generateInvoiceNumber(userId);
        const publicLinkToken = crypto.randomBytes(24).toString('hex');

        // Parse subscription items or fallback to single subscription line
        let itemsList = [];
        if (Array.isArray(sub.items) && sub.items.length > 0) {
          itemsList = sub.items;
        } else {
          itemsList = [
            {
              item_name: sub.description || `Layanan Berlangganan (${sub.frequency || 'Bulanan'})`,
              quantity: 1,
              unit_price: parseFloat(sub.amount || 0),
            },
          ];
        }

        // Hitung subtotal, diskon, pajak, grand total
        const subtotal = itemsList.reduce(
          (s, it) => s + parseFloat(it.quantity || 1) * parseFloat(it.unit_price || 0),
          0
        );
        const discountAmt = parseFloat(sub.discount || 0);
        const taxRate = parseFloat(sub.tax_rate || 0);
        const afterDiscount = Math.max(0, subtotal - discountAmt);
        const taxAmt = (afterDiscount * taxRate) / 100;
        const total = afterDiscount + taxAmt;

        // Tanggal terbit hari ini, tanggal jatuh tempo default +14 hari
        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // Hitung next_billing_date berikutnya berdasarkan frequency
        const nextBillingDate = new Date(sub.next_billing_date);
        const freq = (sub.frequency || 'monthly').toLowerCase();
        if (freq === 'weekly') {
          nextBillingDate.setDate(nextBillingDate.getDate() + 7);
        } else if (freq === 'yearly') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          // Default: 1 month
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        // Eksekusi atomic transaction untuk membuat invoice dan update subscription
        const [createdInvoice] = await prisma.$transaction([
          prisma.invoice.create({
            data: {
              user_id: userId,
              client_id: clientId,
              invoice_number: invoiceNumber,
              status: 'unpaid',
              issue_date: issueDate,
              due_date: dueDate,
              subtotal: subtotal,
              discount: discountAmt,
              tax_rate: taxRate,
              total: total,
              public_link_token: publicLinkToken,
              items: {
                create: itemsList.map((it) => ({
                  item_name: it.item_name,
                  quantity: parseFloat(it.quantity || 1),
                  unit_price: parseFloat(it.unit_price || 0),
                  total_price: parseFloat(it.quantity || 1) * parseFloat(it.unit_price || 0),
                })),
              },
            },
            include: {
              client: true,
              user: true,
              items: true,
            },
          }),
          prisma.subscription.update({
            where: { id: sub.id },
            data: {
              next_billing_date: nextBillingDate,
              last_invoiced_at: now,
            },
          }),
        ]);

        console.log(`[cron.service] 📄 Berhasil membuat Invoice #${invoiceNumber} untuk langganan ${sub.id} (Klien: ${sub.client?.name}). Next billing: ${nextBillingDate.toISOString().split('T')[0]}`);
        generatedCount++;
      } catch (subErr) {
        console.error(`[cron.service] ❌ Gagal membuat invoice untuk langganan ${sub.id}:`, subErr.message);
      }
    }

    console.log(`[cron.service] ✅ Selesai pemrosesan recurring subscriptions: ${generatedCount} invoice baru berhasil digenerate.`);
  } catch (err) {
    console.error('[cron.service] ❌ Terjadi error pada job recurring invoices:', err.message);
  }
}

/**
 * Inisialisasi cron jobs otomatis saat backend server express berjalan
 * Jadwal: Setiap hari jam 08:00 WIB / Server Time ('0 8 * * *')
 */
function initCronJobs() {
  console.log('[cron.service] ⏰ Menginisialisasi Automation Cron Jobs (Jadwal: Harian 08:00 AM)...');

  // Jadwal harian jam 08:00: '0 8 * * *'
  cron.schedule('0 8 * * *', async () => {
    console.log(`[cron.service] ⏰ [${new Date().toISOString()}] Menjalankan tugas otomasi harian jam 08:00 AM...`);
    await runOverdueRemindersCheck();
    await runRecurringInvoicesCheck();
  });

  console.log('[cron.service] ✅ Cron jobs aktif: Overdue reminders & Recurring invoices terdaftar.');
}

module.exports = {
  initCronJobs,
  runOverdueRemindersCheck,
  runRecurringInvoicesCheck,
};
