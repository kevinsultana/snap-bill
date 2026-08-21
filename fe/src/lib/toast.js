'use client';

import Swal from 'sweetalert2';

/**
 * Toast notifikasi sukses / error / info.
 */
export function toast(icon, title) {
  Swal.fire({
    icon,
    title,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    customClass: { popup: 'swal-toast' },
  });
}
