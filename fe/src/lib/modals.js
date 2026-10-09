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
 * Format string/angka ke format ribuan bertitik (misal: 500000 => "500.000")
 */
function formatThousand(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * SweetAlert2 modal form - styling via clean utility classes and attributes
 * using CSS values (SweetAlert2 renders into its own DOM, Tailwind
 * classes cannot apply there).
 *
 * Props:
 *   title: string
 *   fields: Array<{ name, label, type?, placeholder?, required?, step?, isCurrency? }>
 *   initialValues: object
 *   onSubmit: async (values) => void
 */
export function openFormModal({ title, fields, initialValues = {}, onSubmit }) {
  // Build HTML form markup from field config
  const formHtml = fields
    .map((f) => {
      const rawVal = initialValues[f.name] ?? '';
      const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
      const type = isPrice ? 'text' : f.type || 'text';
      const required = f.required !== false ? 'required' : '';
      const step = f.step ? `step="${f.step}"` : '';

      if (f.type === 'textarea') {
        return `
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;text-align:left;">
            <label style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;" for="swal-${f.name}">
              ${f.label}${f.required !== false ? ' <span style="color:#ef4444;">*</span>' : ''}
            </label>
            <textarea
              id="swal-${f.name}"
              name="${f.name}"
              placeholder="${f.placeholder || ''}"
              ${required}
              rows="3"
              style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e2e8f0;background:#ffffff;font-size:13px;color:#0f172a;outline:none;resize:vertical;font-family:inherit;transition:border-color 0.15s;"
            >${rawVal}</textarea>
          </div>`;
      }

      if (isPrice) {
        const formattedVal = formatThousand(rawVal);
        return `
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;text-align:left;">
            <label style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;" for="swal-${f.name}">
              ${f.label}${f.required !== false ? ' <span style="color:#ef4444;">*</span>' : ''}
            </label>
            <div style="display:flex;align-items:center;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#ffffff;">
              <span style="padding:10px 12px;font-weight:800;font-size:13px;color:#64748b;background:#f8fafc;border-right:1.5px solid #e2e8f0;user-select:none;">Rp</span>
              <input
                id="swal-${f.name}"
                name="${f.name}"
                type="text"
                inputmode="numeric"
                placeholder="${f.placeholder || '0'}"
                value="${formattedVal}"
                ${required}
                style="flex:1;padding:10px 12px;border:none;outline:none;font-size:13px;font-weight:600;color:#0f172a;background:transparent;font-family:'ui-monospace','SFMono-Regular','Menlo',monospace;"
              />
            </div>
          </div>`;
      }

      return `
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;text-align:left;">
          <label style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;" for="swal-${f.name}">
            ${f.label}${f.required !== false ? ' <span style="color:#ef4444;">*</span>' : ''}
          </label>
          <input
            id="swal-${f.name}"
            name="${f.name}"
            type="${type}"
            placeholder="${f.placeholder || ''}"
            value="${rawVal}"
            ${required}
            ${step}
            style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e2e8f0;background:#ffffff;font-size:13px;color:#0f172a;outline:none;font-family:inherit;transition:border-color 0.15s;"
          />
        </div>`;
    })
    .join('');

  return Swal.fire({
    title,
    html: `<div style="padding:4px 0;">${formHtml}</div>`,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
    focusConfirm: false,
    customClass: { popup: 'swal-custom-popup' },
    didOpen: () => {
      // Attach live auto-formatting for currency fields
      fields.forEach((f) => {
        const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
        if (!isPrice) return;

        const inputEl = document.getElementById(`swal-${f.name}`);
        if (!inputEl) return;

        inputEl.addEventListener('input', () => {
          const rawNumbers = inputEl.value.replace(/[^0-9]/g, '');
          if (!rawNumbers) {
            inputEl.value = '';
            return;
          }
          const num = parseInt(rawNumbers, 10);
          inputEl.value = new Intl.NumberFormat('id-ID').format(num);
        });

        // Highlight border on focus
        inputEl.addEventListener('focus', () => {
          if (inputEl.parentElement?.tagName === 'DIV') {
            inputEl.parentElement.style.borderColor = '#6366f1';
          } else {
            inputEl.style.borderColor = '#6366f1';
          }
        });
        inputEl.addEventListener('blur', () => {
          if (inputEl.parentElement?.tagName === 'DIV') {
            inputEl.parentElement.style.borderColor = '#e2e8f0';
          } else {
            inputEl.style.borderColor = '#e2e8f0';
          }
        });
      });

      // Focus highlight for all text inputs
      fields.forEach((f) => {
        const isPrice = f.name === 'price' || f.isCurrency || f.type === 'currency';
        if (isPrice) return;
        const inputEl = document.getElementById(`swal-${f.name}`);
        if (!inputEl) return;
        inputEl.addEventListener('focus', () => {
          inputEl.style.borderColor = '#6366f1';
          inputEl.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
        });
        inputEl.addEventListener('blur', () => {
          inputEl.style.borderColor = '#e2e8f0';
          inputEl.style.boxShadow = 'none';
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
          const rawNum = el.value.replace(/[^0-9]/g, '');
          values[f.name] = rawNum ? parseFloat(rawNum) : '';
        } else {
          values[f.name] = el.value.trim();
        }

        if (
          f.required !== false &&
          (values[f.name] === '' || values[f.name] === null || values[f.name] === undefined)
        ) {
          // Highlight error state inline
          el.style.borderColor = '#ef4444';
          el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.1)';
          valid = false;
        } else {
          el.style.borderColor = '#e2e8f0';
          el.style.boxShadow = 'none';
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
 * Konfirmasi hapus - mengembalikan true jika user konfirmasi.
 */
export async function confirmDelete(itemName) {
  const result = await Swal.fire({
    title: 'Hapus data ini?',
    html: `<span style="color:#94a3b8">Data <b style="color:#1e293b">${itemName}</b> akan dihapus secara permanen.</span>`,
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
