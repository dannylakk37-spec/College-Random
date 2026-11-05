import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { BRAND } from '@/lib/constants';
import { publicEnv } from '@/lib/env';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl()),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    'Random live video chat exclusively for verified college and university students across the United States. Free to use.',
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: 'Meet verified college students from across America on live, random video chats.',
    siteName: BRAND.name,
    type: 'website',
    images: ['/logo.png'],
  },
  icons: { icon: '/favicon.png', apple: '/apple-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#030B1D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
