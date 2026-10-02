import type { HealthResponse } from '@ft/contracts';
import { Controller, Get } from '@nestjs/common';

import { TelemetryService } from '../telemetry/telemetry.service.ts';

@Controller('health')
export class HealthController {
  constructor(private readonly telemetry: TelemetryService) {}

  /** Liveness: the process serves requests. Telemetry being offline is not a failure. */
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      telemetry: this.telemetry.snapshot(),
    };
  }
}
