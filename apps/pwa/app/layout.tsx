import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

// Inter — Latin + Latin-Extended subsets cover Turkish diacritics (ş, ğ, ü,
// ö, ç, ı, İ). `display: 'swap'` keeps fallback rendering instant while the
// woff2 streams; `--font-inter` is wired into globals.css's `--font-sans`.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aisie',
  description: 'Sesli CRM asistanı',
  manifest: '/manifest.webmanifest',
  applicationName: 'Aisie',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aisie',
  },
};

export const viewport: Viewport = {
  themeColor: [
    // Soft violet-tinted near-white — matches the new --color-background so
    // browser chrome and PWA splash screen blend with the in-app surface.
    { media: '(prefers-color-scheme: light)', color: '#f9f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
