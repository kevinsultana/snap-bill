/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-jakarta)',
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['Geist Mono', 'SFMono-Regular', 'Consolas', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: '#f8fafc',
        surface: 'rgba(255, 255, 255, 0.72)',
        'surface-elevated': 'rgba(255, 255, 255, 0.88)',
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      boxShadow: {
        glass: '0 10px 30px -5px rgba(99, 102, 241, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        'glass-hover': '0 18px 40px -8px rgba(99, 102, 241, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        '2xl': '24px',
        '3xl': '30px',
      },
      keyframes: {
        skeletonPulse: {
          '0%': { backgroundPosition: '200% 0', opacity: '0.85' },
          '50%': { opacity: '0.55' },
          '100%': { backgroundPosition: '-200% 0', opacity: '0.85' },
        },
        floatAmbient: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(40px, 30px) scale(1.08)' },
          '100%': { transform: 'translate(-30px, 50px) scale(0.95)' },
        },
      },
      animation: {
        skeleton: 'skeletonPulse 1.5s ease-in-out infinite',
        float: 'floatAmbient 18s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
