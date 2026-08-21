const puppeteer = require('puppeteer');

/**
 * Format angka ke mata uang Rupiah
 */
function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(num || 0));
}

/**
 * Format tanggal ke bahasa Indonesia
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Template HTML untuk PDF Invoice
 */
function buildInvoiceHTML(invoice) {
  const user = invoice.user || {};
  const client = invoice.client || {};
  const items = invoice.items || [];
  const bankAccounts = Array.isArray(user.bank_accounts) ? user.bank_accounts : [];

  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount || 0);
  const taxRate = Number(invoice.tax_rate || 0);
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const total = Number(invoice.total || 0);

  const itemsHTML = items
    .map(
      (it, idx) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${it.item_name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${Number(it.quantity)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatRupiah(it.unit_price)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${formatRupiah(it.total_price)}</td>
      </tr>
    `
    )
    .join('');

  const banksHTML = bankAccounts.length > 0
    ? `
      <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Informasi Pembayaran Transfer:</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
          ${bankAccounts
            .map(
              (b) => `
            <div style="font-size: 12px; color: #334155;">
              <b>${b.bank_name}</b>: ${b.account_number} <br/>
              <span style="color: #64748b;">a.n. ${b.account_holder || user.business_name || 'Pemilik Rekening'}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${invoice.invoice_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 32px 40px;
      font-size: 13px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <!-- Header: Business & Invoice Info -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #6366f1; padding-bottom: 20px;">
    <div>
      ${
        user.logo_url
          ? `<img src="${user.logo_url}" alt="Logo" style="max-height: 48px; margin-bottom: 8px;" />`
          : ''
      }
      <h1 style="margin: 0; font-size: 22px; color: #4338ca; font-weight: 700;">${user.business_name || 'SnapBill'}</h1>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">${user.email || ''}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; font-size: 24px; color: #0f172a; font-weight: 700; letter-spacing: -0.5px;">INVOICE</h2>
      <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 14px; font-weight: 600; color: #4f46e5;">#${invoice.invoice_number}</p>
      <div style="margin-top: 6px; display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; ${
        invoice.status === 'paid'
          ? 'background: #dcfce7; color: #15803d;'
          : invoice.status === 'unpaid'
          ? 'background: #fef3c7; color: #b45309;'
          : 'background: #f1f5f9; color: #475569;'
      }">
        ${invoice.status || 'DRAFT'}
      </div>
    </div>
  </div>

  <!-- Client & Meta Details Grid -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
    <div>
      <h3 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Ditujukan Kepada:</h3>
      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">${client.name || '—'}</p>
      ${client.email ? `<p style="margin: 2px 0 0 0; color: #475569;">${client.email}</p>` : ''}
      ${client.phone ? `<p style="margin: 2px 0 0 0; color: #475569;">${client.phone}</p>` : ''}
      ${client.address ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">${client.address}</p>` : ''}
    </div>
    <div style="text-align: right;">
      <table style="margin-left: auto; font-size: 12px;">
        <tr>
          <td style="padding: 3px 12px; color: #64748b;">Tanggal Invoice:</td>
          <td style="padding: 3px 0; font-weight: 600; color: #1e293b;">${formatDate(invoice.issue_date)}</td>
        </tr>
        <tr>
          <td style="padding: 3px 12px; color: #64748b;">Jatuh Tempo:</td>
          <td style="padding: 3px 0; font-weight: 600; color: #1e293b;">${formatDate(invoice.due_date)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background-color: #f1f5f9;">
        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center; width: 40px;">#</th>
        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: left;">Item / Deskripsi</th>
        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right; width: 60px;">Qty</th>
        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right; width: 120px;">Harga</th>
        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right; width: 130px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- Totals Summary -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
    <table style="width: 280px; font-size: 13px;">
      <tr>
        <td style="padding: 6px 0; color: #64748b;">Subtotal</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1e293b;">${formatRupiah(subtotal)}</td>
      </tr>
      ${
        discount > 0
          ? `
        <tr>
          <td style="padding: 6px 0; color: #dc2626;">Diskon</td>
          <td style="padding: 6px 0; text-align: right; color: #dc2626;">- ${formatRupiah(discount)}</td>
        </tr>
      `
          : ''
      }
      ${
        taxRate > 0
          ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Pajak (${taxRate}%)</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1e293b;">+ ${formatRupiah(taxAmount)}</td>
        </tr>
      `
          : ''
      }
      <tr style="border-top: 2px solid #0f172a;">
        <td style="padding: 10px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Total Tagihan</td>
        <td style="padding: 10px 0; font-size: 16px; font-weight: 700; text-align: right; color: #4338ca;">${formatRupiah(total)}</td>
      </tr>
    </table>
  </div>

  <!-- Bank accounts info -->
  ${banksHTML}

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
    <p style="margin: 0;">Terima kasih atas kerja sama Anda!</p>
    <p style="margin: 4px 0 0 0;">Dibuat secara otomatis menggunakan SnapBill.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate file PDF dari data Invoice menggunakan Puppeteer
 *
 * @param {Object} invoice - Data invoice lengkap dengan client, items, dan user
 * @returns {Promise<Buffer>} - Buffer file PDF
 */
async function generateInvoicePDF(invoice) {
  let browser = null;
  try {
    console.log(`[pdf.service] Men-generate PDF untuk Invoice #${invoice.invoice_number}...`);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    const htmlContent = buildInvoiceHTML(invoice);

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm',
      },
    });

    console.log(`[pdf.service] ✅ PDF Invoice #${invoice.invoice_number} berhasil dibuat (${pdfBuffer.length} bytes).`);
    return pdfBuffer;
  } catch (err) {
    console.error('[pdf.service] ❌ Gagal membuat PDF invoice:', err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generateInvoicePDF,
  buildInvoiceHTML,
};
