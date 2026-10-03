import type { Metadata } from 'next';

import { loadWebConfig } from '@/config';
import { DemoPlayer } from '@/demo/demo-player';

export const metadata: Metadata = { title: 'Demo' };

const config = loadWebConfig(process.env);

/** A recorded race on video, with the dashboard driven by the telemetry captured alongside it. */
export default function DemoPage() {
  return (
    <main>
      <DemoPlayer mediaUrl={config.demoMediaUrl} />
    </main>
  );
}
