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
  title: 'SnapBill — Smart Invoice Generator & SaaS Billing',
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
      <body className="min-h-screen relative overflow-x-hidden text-slate-900 bg-slate-50 antialiased font-sans">
        <LanguageProvider>
          {/* Dynamic Ambient Mesh Glow Background using inline Tailwind utility classes */}
          <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0" aria-hidden="true">
            <div
              className="absolute rounded-full blur-[90px] opacity-65 w-[650px] h-[650px] -top-[150px] -left-[100px] animate-[floatAmbient_18s_ease-in-out_infinite_alternate]"
              style={{ background: 'radial-gradient(circle, #e0e7ff 0%, rgba(224, 231, 255, 0) 70%)' }}
            />
            <div
              className="absolute rounded-full blur-[90px] opacity-65 w-[550px] h-[550px] top-[20%] -right-[100px] animate-[floatAmbient_22s_ease-in-out_infinite_alternate]"
              style={{ background: 'radial-gradient(circle, #f3e8ff 0%, rgba(243, 232, 255, 0) 70%)' }}
            />
            <div
              className="absolute rounded-full blur-[90px] opacity-65 w-[700px] h-[700px] -bottom-[200px] left-[25%] animate-[floatAmbient_26s_ease-in-out_infinite_alternate]"
              style={{ background: 'radial-gradient(circle, #ecfeff 0%, rgba(236, 254, 255, 0) 70%)' }}
            />
          </div>

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
