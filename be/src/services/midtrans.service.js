const midtransClient = require('midtrans-client');

/**
 * Membuat instance Midtrans Snap dengan model BYOK (Bring Your Own Key)
 *
 * @param {string} serverKey - Midtrans Server Key milik user
 * @param {string} [clientKey] - Midtrans Client Key milik user
 * @param {boolean} [isProduction=false] - Mode production atau sandbox
 * @returns {midtransClient.Snap}
 */
function getSnapInstance(serverKey, clientKey = '', isProduction = false) {
  if (!serverKey || serverKey.trim() === '') {
    throw new Error('Midtrans Server Key belum dikonfigurasi pada akun Anda. Harap atur di menu Pengaturan.');
  }

  let isProd = isProduction;
  if (process.env.MIDTRANS_IS_PRODUCTION !== undefined) {
    isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  } else if (process.env.PLATFORM_MIDTRANS_IS_PRODUCTION !== undefined) {
    isProd = process.env.PLATFORM_MIDTRANS_IS_PRODUCTION === 'true';
  } else if (process.env.USER_MIDTRANS_IS_PRODUCTION !== undefined) {
    isProd = process.env.USER_MIDTRANS_IS_PRODUCTION === 'true';
  } else {
    isProd = !serverKey.startsWith('SB-');
  }

  return new midtransClient.Snap({
    isProduction: isProd,
    serverKey: serverKey.trim(),
    clientKey: clientKey ? clientKey.trim() : '',
  });
}

/**
 * Membuat transaksi Midtrans Snap URL & Token untuk sebuah Invoice
 *
 * @param {Object} params
 * @param {string} params.serverKey - Midtrans Server Key dari profil user
 * @param {string} [params.clientKey] - Midtrans Client Key dari profil user
 * @param {Object} params.invoice - Objek Invoice dari database
 * @param {Object} [params.client] - Objek Klien terkait
 * @param {Array<Object>} [params.items] - Daftar item invoice
 * @param {boolean} [params.isProduction=false] - Status mode production
 * @returns {Promise<{ token: string, redirect_url: string }>}
 */
async function createSnapTransaction({
  serverKey,
  clientKey = '',
  invoice,
  client = {},
  items = [],
  isProduction = false,
}) {
  const snap = getSnapInstance(serverKey, clientKey, isProduction);

  const amountPaid = Math.round(Number(invoice.amount_paid || 0));
  const grossAmount = Math.max(0, Math.round(Number(invoice.total)) - amountPaid);
  if (grossAmount <= 0) {
    throw new Error('Sisa tagihan invoice adalah Rp 0 (sudah lunas), tidak memerlukan pembayaran via Midtrans.');
  }

  // Siapkan detail item untuk Midtrans
  const itemDetails = items.map((it, idx) => ({
    id: it.id || `item-${idx + 1}`,
    price: Math.round(Number(it.unit_price)),
    quantity: Math.max(1, Math.round(Number(it.quantity))),
    name: (it.item_name || 'Item').slice(0, 50),
  }));

  // Tambahkan diskon jika ada
  if (Number(invoice.discount) > 0) {
    itemDetails.push({
      id: 'discount',
      price: -Math.round(Number(invoice.discount)),
      quantity: 1,
      name: 'Diskon',
    });
  }

  // Tambahkan pajak jika ada
  if (Number(invoice.tax_rate) > 0) {
    const subtotal = Number(invoice.subtotal || 0);
    const discount = Number(invoice.discount || 0);
    const taxAmount = Math.round(((subtotal - discount) * Number(invoice.tax_rate)) / 100);
    if (taxAmount > 0) {
      itemDetails.push({
        id: 'tax',
        price: taxAmount,
        quantity: 1,
        name: `Pajak (${Number(invoice.tax_rate)}%)`,
      });
    }
  }

  // Tambahkan potongan uang muka / pembayaran sebelumnya jika ada
  if (amountPaid > 0) {
    itemDetails.push({
      id: 'paid-amount',
      price: -amountPaid,
      quantity: 1,
      name: 'Pembayaran Sebelumnya / DP',
    });
  }

  // Cek apakah total item_details persis sama dengan gross_amount (syarat Midtrans)
  const itemsSum = itemDetails.reduce((sum, it) => sum + it.price * it.quantity, 0);

  const parameter = {
    transaction_details: {
      order_id: `${invoice.invoice_number}-${Date.now()}`,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: client.name || 'Pelanggan',
      email: client.email || undefined,
      phone: client.phone || undefined,
    },
    callbacks: {
      finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${invoice.public_link_token || invoice.id}`,
    },
  };

  // Hanya kirim item_details jika jumlahnya pas untuk mencegah penolakan dari Midtrans API
  if (itemsSum === grossAmount) {
    parameter.item_details = itemDetails;
  }

  console.log(`[midtrans.service] Membuat transaksi Snap untuk Invoice #${invoice.invoice_number} (Rp ${grossAmount})...`);

  const transaction = await snap.createTransaction(parameter);

  return {
    token: transaction.token,
    redirect_url: transaction.redirect_url,
  };
}
/**
 * Verifikasi signature_key webhook Midtrans
 * Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.statusCode
 * @param {string} params.grossAmount
 * @param {string} params.serverKey
 * @param {string} params.signatureKey - signature_key dari payload webhook Midtrans
 * @returns {boolean}
 */
function verifyMidtransSignature({ orderId, statusCode, grossAmount, serverKey, signatureKey }) {
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false;
  }
  const crypto = require('crypto');
  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey.trim()}`;
  const calculatedSignature = crypto.createHash('sha512').update(rawString).digest('hex');

  if (calculatedSignature.length !== signatureKey.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'utf8'),
      Buffer.from(signatureKey, 'utf8')
    );
  } catch {
    return false;
  }
}

module.exports = {
  createSnapTransaction,
  verifyMidtransSignature,
};
