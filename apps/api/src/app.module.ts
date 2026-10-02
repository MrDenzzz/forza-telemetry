import { Global, Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { CLOCK, systemClock } from './clock.ts';
import { APP_CONFIG, type AppConfig } from './config/app-config.ts';
import { HealthModule } from './health/health.module.ts';
import { LiveModule } from './live/live.module.ts';
import { SessionsModule } from './sessions/sessions.module.ts';

@Global()
@Module({})
export class AppModule {
  /** The config is validated before the module is built, so every provider can rely on it. */
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.log.level,
            ...(config.log.pretty
              ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
              : {}),
            autoLogging: { ignore: (request) => request.url === '/health' },
          },
        }),
        LiveModule,
        SessionsModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: CLOCK, useValue: systemClock },
      ],
      exports: [APP_CONFIG, CLOCK],
    };
  }
}
