import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';

import { ReplayTelemetrySource } from './replay-telemetry-source.ts';
import { TELEMETRY_SOURCE, type TelemetrySource } from './telemetry-source.ts';
import { TelemetryService } from './telemetry.service.ts';
import { UdpTelemetrySource } from './udp-telemetry-source.ts';

@Module({
  providers: [
    UdpTelemetrySource,
    ReplayTelemetrySource,
    {
      // Both sources exist; only the configured one is started, by TelemetryService.
      provide: TELEMETRY_SOURCE,
      inject: [APP_CONFIG, UdpTelemetrySource, ReplayTelemetrySource],
      useFactory: (
        config: AppConfig,
        udp: UdpTelemetrySource,
        recording: ReplayTelemetrySource,
      ): TelemetrySource => (config.telemetry.source.kind === 'recording' ? recording : udp),
    },
    TelemetryService,
  ],
  exports: [TelemetryService, UdpTelemetrySource],
})
export class TelemetryModule {}
