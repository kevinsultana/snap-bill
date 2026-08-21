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
  if (process.env.USER_MIDTRANS_IS_PRODUCTION !== undefined) {
    isProd = process.env.USER_MIDTRANS_IS_PRODUCTION === 'true';
  } else if (process.env.MIDTRANS_IS_PRODUCTION !== undefined) {
    isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
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

  const grossAmount = Math.round(Number(invoice.total));
  if (grossAmount <= 0) {
    throw new Error('Total tagihan invoice harus lebih dari Rp 0 untuk memproses pembayaran via Midtrans.');
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
      finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/public/invoices/${invoice.public_link_token || invoice.id}`,
    },
  };

  // Hanya kirim item_details jika jumlahnya pas untuk mencegah penolakan dari Midtrans API
  if (itemsSum === grossAmount) {
    parameter.item_details = itemDetails;
  }

  console.log(`[midtrans.service] Membuat transaksi Snap untuk Invoice #${invoice.invoice_number} (Rp ${grossAmount})...`);

  const transaction = await snap.createTransaction(parameter);

  console.log(`[midtrans.service] ✅ Transaksi Snap berhasil dibuat: ${transaction.redirect_url}`);

  return {
    token: transaction.token,
    redirect_url: transaction.redirect_url,
  };
}

module.exports = {
  createSnapTransaction,
};
