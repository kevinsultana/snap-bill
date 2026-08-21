'use client';

import Swal from 'sweetalert2';

/**
 * Format angka ke format mata uang Rupiah
 */
function formatRupiah(num) {
  if (num === null || num === undefined || num === '' || isNaN(Number(num))) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(num));
}

/**
 * Format string/angka ke format ribuan bertitik (misal: 500000 -> "500.000")
 */
function formatThousand(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Modal form generik — digunakan untuk dialog Tambah/Edit.
 * Props:
 *   title: string
 *   fields: Array<{ name, label, type?, placeholder?, required?, step?, isCurrency? }>
 *   initialValues: object
 *   onSubmit: async (values) => void
 */
export function openFormModal({ title, fields, initialValues = {}, onSubmit }) {
  // Bangun HTML form dari konfigurasi fields
  const formHtml = fields
    .map((f) => {
      const rawVal = initialValues[f.name] ?? '';
      const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
      const type = isPrice ? 'text' : f.type || 'text';
      const required = f.required !== false ? 'required' : '';
      const step = f.step ? `step="${f.step}"` : '';

      if (f.type === 'textarea') {
        return `
          <div class="swal-field">
            <label class="swal-label" for="swal-${f.name}">${f.label}${f.required !== false ? ' <span class="swal-req">*</span>' : ''}</label>
            <textarea id="swal-${f.name}" name="${f.name}" class="swal-input swal-textarea"
              placeholder="${f.placeholder || ''}" ${required}>${rawVal}</textarea>
          </div>`;
      }

      if (isPrice) {
        const formattedVal = formatThousand(rawVal);

        return `
          <div class="swal-field">
            <label class="swal-label" for="swal-${f.name}">${f.label}${f.required !== false ? ' <span class="swal-req">*</span>' : ''}</label>
            <div class="swal-currency-input-wrap">
              <span class="swal-currency-prefix">Rp</span>
              <input
                id="swal-${f.name}"
                name="${f.name}"
                type="text"
                inputmode="numeric"
                class="swal-input swal-currency-input"
                placeholder="${f.placeholder || '0'}"
                value="${formattedVal}"
                ${required}
              />
            </div>
            
          </div>`;
      }

      return `
        <div class="swal-field">
          <label class="swal-label" for="swal-${f.name}">${f.label}${f.required !== false ? ' <span class="swal-req">*</span>' : ''}</label>
          <input id="swal-${f.name}" name="${f.name}" type="${type}" class="swal-input"
            placeholder="${f.placeholder || ''}" value="${rawVal}" ${required} ${step} />
        </div>`;
    })
    .join('');

  return Swal.fire({
    title,
    html: `<div class="swal-form">${formHtml}</div>`,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
    focusConfirm: false,
    customClass: { popup: 'swal-custom-popup' },
    didOpen: () => {
      // Pasang event listener untuk formatting angka otomatis pada field mata uang (Rupiah)
      fields.forEach((f) => {
        const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
        if (!isPrice) return;

        const inputEl = document.getElementById(`swal-${f.name}`);
        const previewEl = document.getElementById(`swal-${f.name}-preview`);
        if (!inputEl) return;

        inputEl.addEventListener('input', () => {
          const rawNumbers = inputEl.value.replace(/[^0-9]/g, '');
          if (!rawNumbers) {
            inputEl.value = '';
            if (previewEl) previewEl.innerHTML = '<span style="color: #64748b;">Rp 0</span>';
            return;
          }
          const num = parseInt(rawNumbers, 10);
          inputEl.value = new Intl.NumberFormat('id-ID').format(num);
          if (previewEl) {
            previewEl.innerHTML = `Format: <b style="color: #10b981;">${formatRupiah(num)}</b>`;
          }
        });
      });
    },
    preConfirm: () => {
      const values = {};
      let valid = true;

      fields.forEach((f) => {
        const el = document.getElementById(`swal-${f.name}`);
        if (!el) return;

        const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
        if (isPrice) {
          // Bersihkan titik ribuan dan ambil nilai angka murni
          const rawNum = el.value.replace(/[^0-9]/g, '');
          values[f.name] = rawNum ? parseFloat(rawNum) : '';
        } else {
          values[f.name] = el.value.trim();
        }

        if (f.required !== false && (values[f.name] === '' || values[f.name] === null || values[f.name] === undefined)) {
          el.classList.add('swal-input-error');
          valid = false;
        } else {
          el.classList.remove('swal-input-error');
        }
      });

      if (!valid) {
        Swal.showValidationMessage('Harap isi semua field yang wajib.');
        return false;
      }
      return values;
    },
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      await onSubmit(result.value);
    }
  });
}

/**
 * Konfirmasi hapus — mengembalikan true jika user konfirmasi.
 */
export async function confirmDelete(itemName) {
  const result = await Swal.fire({
    title: 'Hapus data ini?',
    html: `<span style="color:#94a3b8">Data <b style="color:#f1f5f9">${itemName}</b> akan dihapus secara permanen.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#374151',
    customClass: { popup: 'swal-custom-popup' },
  });
  return result.isConfirmed;
}
