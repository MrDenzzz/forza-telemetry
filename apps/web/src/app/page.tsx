import type { Metadata } from 'next';

import { loadWebConfig } from '@/config';
import { LiveDashboard } from '@/dashboard/live-dashboard';
import { historyApi } from '@/history/api';

export const metadata: Metadata = { title: 'Live' };

const config = loadWebConfig(process.env);

export default async function LivePage() {
  // The map draws the whole course when the API replays a recording. Without it, or without the
  // API, the dashboard works the same and maps the route as it is driven.
  const course = await historyApi.course().catch(() => null);
  return <LiveDashboard liveUrl={config.liveUrl} course={course} />;
}
