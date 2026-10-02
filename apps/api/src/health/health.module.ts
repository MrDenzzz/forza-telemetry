import { Module } from '@nestjs/common';

import { TelemetryModule } from '../telemetry/telemetry.module.ts';

import { HealthController } from './health.controller.ts';

@Module({
  imports: [TelemetryModule],
  controllers: [HealthController],
})
export class HealthModule {}
