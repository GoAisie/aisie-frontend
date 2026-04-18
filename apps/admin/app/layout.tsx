import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Aisie Admin',
  description: 'Aisie yönetim paneli',
  applicationName: 'Aisie Admin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f8fafc',
          color: '#0b0b0f',
          minHeight: '100dvh',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
