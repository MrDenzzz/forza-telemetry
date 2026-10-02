import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.ts';
import { TelemetryModule } from '../telemetry/telemetry.module.ts';

import { SessionRecorder } from './session-recorder.ts';
import { SessionRepository } from './session-repository.ts';

@Module({
  imports: [TelemetryModule, DatabaseModule],
  providers: [SessionRepository, SessionRecorder],
})
export class SessionsModule {}
