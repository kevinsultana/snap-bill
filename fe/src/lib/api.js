import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true, // Wajib untuk mengirim httpOnly cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
