import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'SnapBill: Smart Invoice Generator & SaaS Billing',
  description:
    'Kelola penagihan klien, pembuatan invoice otomatis, bukti transfer, dan sistem pembayaran online terpadu dengan SnapBill.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${inter.variable}`}>
      <body className="min-h-screen relative text-slate-900 bg-slate-50 antialiased font-sans">
        <LanguageProvider>
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={10}
            toastOptions={{
              duration: 3200,
            }}
          />

          <div className="relative z-10 min-h-screen flex flex-col">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
