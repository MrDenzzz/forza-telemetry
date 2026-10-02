import { loadWebConfig } from '@/config';
import { LiveDashboard } from '@/dashboard/live-dashboard';

const config = loadWebConfig(process.env);

export default function LivePage() {
  return <LiveDashboard liveUrl={config.liveUrl} />;
}
