'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

// Top-level error boundary required by the Next.js App Router for the root
// segment. React rendering errors that escape every nested error boundary land
// here. Without explicit captureException, Sentry's automatic instrumentation
// can miss errors that crash the root-layout render itself.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
