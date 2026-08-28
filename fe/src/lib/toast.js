'use client';

import hotToast from 'react-hot-toast';

/**
 * Shared style for react-hot-toast notifications.
 * Uses inline object styles (react-hot-toast API requires this, not Tailwind classes).
 */
const DEFAULT_STYLE = {
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow:
    '0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)',
  borderRadius: '14px',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: '600',
  maxWidth: '420px',
};

/**
 * Toast notifikasi modern berbasis react-hot-toast.
 * Mendukung pemanggilan fleksibel:
 * - toast('success', 'Pesan sukses')
 * - toast('error', 'Pesan error')
 * - toast('info', 'Pesan info')
 * - toast('warning', 'Pesan warning')
 * - toast.success('Pesan')
 * - toast.error('Pesan')
 */
export function toast(typeOrMessage, maybeMessage) {
  if (maybeMessage !== undefined) {
    const type = typeOrMessage;
    const message = maybeMessage;

    switch (type) {
      case 'success':
        return hotToast.success(message, {
          style: DEFAULT_STYLE,
          iconTheme: { primary: '#10b981', secondary: '#ffffff' },
        });
      case 'error':
        return hotToast.error(message, {
          style: DEFAULT_STYLE,
          iconTheme: { primary: '#f43f5e', secondary: '#ffffff' },
        });
      case 'warning':
        return hotToast(message, {
          style: {
            ...DEFAULT_STYLE,
            borderLeft: '4px solid #f59e0b',
          },
        });
      case 'info':
        return hotToast(message, {
          style: {
            ...DEFAULT_STYLE,
            borderLeft: '4px solid #6366f1',
          },
        });
      default:
        return hotToast(message, { style: DEFAULT_STYLE });
    }
  }

  // Called with a single string message: toast('Pesan')
  return hotToast(typeOrMessage, { style: DEFAULT_STYLE });
}

// Static method helpers
toast.success = (msg, opts = {}) =>
  hotToast.success(msg, {
    style: DEFAULT_STYLE,
    iconTheme: { primary: '#10b981', secondary: '#ffffff' },
    ...opts,
  });

toast.error = (msg, opts = {}) =>
  hotToast.error(msg, {
    style: DEFAULT_STYLE,
    iconTheme: { primary: '#f43f5e', secondary: '#ffffff' },
    ...opts,
  });

toast.info = (msg, opts = {}) =>
  hotToast(msg, {
    style: {
      ...DEFAULT_STYLE,
      borderLeft: '4px solid #6366f1',
    },
    ...opts,
  });

toast.warning = (msg, opts = {}) =>
  hotToast(msg, {
    style: {
      ...DEFAULT_STYLE,
      borderLeft: '4px solid #f59e0b',
    },
    ...opts,
  });

toast.loading = (msg, opts = {}) =>
  hotToast.loading(msg, {
    style: DEFAULT_STYLE,
    ...opts,
  });

toast.dismiss = (toastId) => hotToast.dismiss(toastId);

export default toast;
