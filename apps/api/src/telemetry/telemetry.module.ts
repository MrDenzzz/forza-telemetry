import { Module } from '@nestjs/common';

import { TELEMETRY_SOURCE } from './telemetry-source.ts';
import { TelemetryService } from './telemetry.service.ts';
import { UdpTelemetrySource } from './udp-telemetry-source.ts';

@Module({
  providers: [
    UdpTelemetrySource,
    { provide: TELEMETRY_SOURCE, useExisting: UdpTelemetrySource },
    TelemetryService,
  ],
  exports: [TelemetryService, UdpTelemetrySource],
})
export class TelemetryModule {}
