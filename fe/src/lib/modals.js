'use client';

import Swal from 'sweetalert2';

/**
 * Modal form generik — digunakan untuk dialog Tambah/Edit.
 * Props:
 *   title: string
 *   fields: Array<{ name, label, type?, placeholder?, required?, step? }>
 *   initialValues: object
 *   onSubmit: async (values) => void
 *   onClose: () => void
 */
export function openFormModal({ title, fields, initialValues = {}, onSubmit }) {
  // Bangun HTML form dari konfigurasi fields
  const formHtml = fields
    .map((f) => {
      const val = initialValues[f.name] ?? '';
      const type = f.type || 'text';
      const required = f.required !== false ? 'required' : '';
      const step = f.step ? `step="${f.step}"` : '';

      if (type === 'textarea') {
        return `
          <div class="swal-field">
            <label class="swal-label" for="swal-${f.name}">${f.label}${f.required !== false ? ' <span class="swal-req">*</span>' : ''}</label>
            <textarea id="swal-${f.name}" name="${f.name}" class="swal-input swal-textarea"
              placeholder="${f.placeholder || ''}" ${required}>${val}</textarea>
          </div>`;
      }

      return `
        <div class="swal-field">
          <label class="swal-label" for="swal-${f.name}">${f.label}${f.required !== false ? ' <span class="swal-req">*</span>' : ''}</label>
          <input id="swal-${f.name}" name="${f.name}" type="${type}" class="swal-input"
            placeholder="${f.placeholder || ''}" value="${val}" ${required} ${step} />
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
    preConfirm: () => {
      const values = {};
      let valid = true;
      fields.forEach((f) => {
        const el = document.getElementById(`swal-${f.name}`);
        if (!el) return;
        values[f.name] = el.value.trim();
        if (f.required !== false && !values[f.name]) {
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
  });
  return result.isConfirmed;
}
