import { Module } from '@nestjs/common';

import { TelemetryModule } from '../telemetry/telemetry.module.ts';

import { LiveGateway } from './live.gateway.ts';

@Module({
  imports: [TelemetryModule],
  providers: [LiveGateway],
})
export class LiveModule {}
