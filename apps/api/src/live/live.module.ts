import { Module } from '@nestjs/common';

import { TelemetryModule } from '../telemetry/telemetry.module.ts';

import { CourseController } from './course.controller.ts';
import { LiveGateway } from './live.gateway.ts';

@Module({
  imports: [TelemetryModule],
  controllers: [CourseController],
  providers: [LiveGateway],
})
export class LiveModule {}
