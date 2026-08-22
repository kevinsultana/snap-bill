const nodemailer = require('nodemailer');

/**
 * Service Email dengan sistem fallback 3-tingkat:
 * 1. Resend (SMTP)
 * 2. Brevo / Sendinblue (SMTP)
 * 3. Gmail App Password (SMTP)
 */

/**
 * Membuat transporter Nodemailer untuk Resend SMTP
 */
function createResendTransporter() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY tidak dikonfigurasi.');

  return {
    name: 'Resend',
    transporter: nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: apiKey,
      },
    }),
    from: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'SnapBill <onboarding@resend.dev>',
  };
}

/**
 * Membuat transporter Nodemailer untuk Brevo SMTP
 */
function createBrevoTransporter() {
  const user = process.env.BREVO_SMTP_USER || process.env.BREVO_USER;
  const pass = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
  if (!user || !pass) throw new Error('BREVO_SMTP_USER atau BREVO_SMTP_KEY tidak dikonfigurasi.');

  return {
    name: 'Brevo',
    transporter: nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user, pass },
    }),
    from: process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || user,
  };
}

/**
 * Membuat transporter Nodemailer untuk Gmail SMTP
 */
function createGmailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER atau GMAIL_APP_PASSWORD tidak dikonfigurasi.');

  return {
    name: 'Gmail',
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    }),
    from: `SnapBill <${user}>`,
  };
}

/**
 * Kirim email dengan fallback otomatis: Resend -> Brevo -> Gmail
 *
 * @param {Object} options
 * @param {string} options.to - Alamat email penerima
 * @param {string} options.subject - Subjek email
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array<Object>} [options.attachments] - Lampiran file (misal: PDF invoice)
 * @returns {Promise<{ success: boolean, provider: string, messageId: string }>}
 */
async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const providers = [
    { name: 'Resend', factory: createResendTransporter },
    { name: 'Brevo',  factory: createBrevoTransporter },
    { name: 'Gmail',  factory: createGmailTransporter },
  ];

  const errors = [];

  for (const provider of providers) {
    try {
      console.log(`[email.service] Mencoba mengirim email via ${provider.name}...`);
      const { transporter, from, name } = provider.factory();

      const mailOptions = {
        from,
        to,
        subject,
        text,
        html,
        attachments,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[email.service] ✅ Email berhasil terkirim via ${name}! MessageId: ${info.messageId}`);
      return {
        success: true,
        provider: name,
        messageId: info.messageId,
      };
    } catch (err) {
      console.warn(`[email.service] ⚠️ Gagal mengirim via ${provider.name}: ${err.message}`);
      errors.push({ provider: provider.name, error: err.message });
      // Lanjut ke provider berikutnya (fallback)
    }
  }

  // Jika semua provider gagal
  const errorDetails = errors.map((e) => `${e.provider}: ${e.error}`).join(' | ');
  throw new Error(`Semua provider email gagal. Detail: [${errorDetails}]`);
}

/**
 * Mengirim email konfirmasi terima kasih & kuitansi lunas kepada klien
 * saat invoice telah dibayarkan (baik via Midtrans otomatis maupun verifikasi transfer manual).
 *
 * @param {Object} params
 * @param {Object} [params.invoice] - Objek invoice lengkap
 * @param {string} [params.invoiceId] - ID invoice jika objek belum lengkap
 * @param {string} [params.paymentMethod] - Metode pembayaran (misal: Midtrans Online Payment / Transfer Bank)
 */
async function sendPaymentSuccessEmail({ invoice, invoiceId, paymentMethod = 'Pembayaran Online' }) {
  try {
    const prisma = require('../db/prisma');
    const { generateInvoicePDF } = require('./pdf.service');

    let fullInvoice = invoice;
    if (!fullInvoice || !fullInvoice.client || !fullInvoice.user || !fullInvoice.items) {
      const idToFind = invoiceId || invoice?.id;
      if (!idToFind) return;
      fullInvoice = await prisma.invoice.findUnique({
        where: { id: idToFind },
        include: {
          client: true,
          user: true,
          items: true,
        },
      });
    }

    if (!fullInvoice || !fullInvoice.client?.email) {
      console.log(`[email.service] ℹ️ Klien untuk Invoice #${fullInvoice?.invoice_number} tidak memiliki email, skip pengiriman email terima kasih.`);
      return;
    }

    const clientEmail = fullInvoice.client.email;
    const businessName = fullInvoice.user?.business_name || 'SnapBill';
    const invoiceNumber = fullInvoice.invoice_number;
    const totalFormatted = `Rp ${Number(fullInvoice.total).toLocaleString('id-ID')}`;
    const paymentDateFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Generate PDF kuitansi/invoice lunas
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF(fullInvoice);
    } catch (pdfErr) {
      console.warn(`[email.service] ⚠️ Gagal membuat lampiran PDF untuk Invoice #${invoiceNumber}:`, pdfErr.message);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const payUrl = fullInvoice.public_link_token ? `${frontendUrl}/pay/${fullInvoice.public_link_token}` : null;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <!-- Header Green Gradient -->
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
          <div style="font-size: 42px; line-height: 1; margin-bottom: 8px;">🎉</div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Pembayaran Berhasil Diterima!</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.92; font-size: 14px;">Kuitansi Pembayaran Invoice #${invoiceNumber}</p>
        </div>
        
        <!-- Body -->
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px; margin-top: 0;">Halo <b>${fullInvoice.client.name}</b>,</p>
          <p style="font-size: 14px; color: #334155;">
            Terima kasih banyak! Pembayaran untuk tagihan Anda kepada <b>${businessName}</b> telah kami terima dan diverifikasi secara resmi.
          </p>

          <!-- Payment Summary Card -->
          <div style="margin: 24px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">No. Invoice:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Tanggal Pembayaran:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${paymentDateFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Metode Pembayaran:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${paymentMethod}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 10px 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Total Lunas:</td>
                <td style="padding: 10px 0 4px 0; text-align: right; font-size: 16px; font-weight: 800; color: #10b981;">${totalFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Status:</td>
                <td style="padding: 4px 0; text-align: right;">
                  <span style="background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                    ✓ LUNAS (PAID)
                  </span>
                </td>
              </tr>
            </table>
          </div>

          ${
            payUrl
              ? `
          <div style="margin: 28px 0; text-align: center;">
            <a href="${payUrl}" style="background: #10b981; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              📄 Buka Portal & Kuitansi Online
            </a>
          </div>
          `
              : ''
          }

          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Salinan faktur PDF resmi terlampir pada email ini sebagai bukti transaksi yang sah.
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            Email ini dikirim secara otomatis oleh <b>SnapBill</b> untuk <b>${businessName}</b>.
          </p>
        </div>
      </div>
    `;

    const attachments = pdfBuffer
      ? [
          {
            filename: `Kuitansi-Invoice-${invoiceNumber}-LUNAS.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [];

    const sendRes = await sendEmail({
      to: clientEmail,
      subject: `[LUNAS] Terima Kasih Atas Pembayaran Invoice #${invoiceNumber} - ${businessName}`,
      html: emailHtml,
      attachments,
    });

    console.log(`[email.service] 💌 Email terima kasih pembayaran Invoice #${invoiceNumber} berhasil dikirim ke ${clientEmail} via ${sendRes.provider}`);
    return sendRes;
  } catch (err) {
    console.error(`[email.service] ⚠️ Gagal mengirim email terima kasih pembayaran:`, err.message);
  }
}

module.exports = {
  sendEmail,
  sendPaymentSuccessEmail,
};
