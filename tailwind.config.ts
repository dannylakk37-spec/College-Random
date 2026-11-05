import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#030B1D',
          900: '#0C1122',
          800: '#141B33',
          700: '#1E2747',
          600: '#2C3760',
        },
        brand: {
          50: '#EEF5FF',
          100: '#D9E9FF',
          300: '#8EC0FF',
          400: '#4F9BFE',
          500: '#2483FD',
          600: '#1268E0',
          700: '#0F53B4',
        },
        spark: {
          400: '#FF8A5C',
          500: '#FF6B3D',
        },
        mint: {
          400: '#3FE0A5',
          500: '#19C98A',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(36,131,253,.25), 0 20px 60px -15px rgba(36,131,253,.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ping2: {
          '0%': { transform: 'scale(.6)', opacity: '.7' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .6s ease-out both',
        ping2: 'ping2 2.2s cubic-bezier(0,0,.2,1) infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
