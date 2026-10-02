import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/ui/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Forza Telemetry', template: '%s · Forza Telemetry' },
  description: 'Live telemetry, session history and lap comparison for Forza Horizon 6',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
