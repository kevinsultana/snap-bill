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

module.exports = {
  sendEmail,
};
