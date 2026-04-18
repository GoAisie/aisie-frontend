import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

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
  themeColor: '#0b0b0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
