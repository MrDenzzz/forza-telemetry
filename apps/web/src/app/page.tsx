import type { Metadata } from 'next';

import { loadWebConfig } from '@/config';
import { LiveDashboard } from '@/dashboard/live-dashboard';

export const metadata: Metadata = { title: 'Live' };

const config = loadWebConfig(process.env);

export default function LivePage() {
  return <LiveDashboard liveUrl={config.liveUrl} />;
}
