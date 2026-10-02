import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.ts';
import type { AppConfig } from './config/app-config.ts';

/** Builds and starts the application the same way for production and end-to-end tests. */
export async function startApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  try {
    await app.listen(config.http.port, config.http.host);
  } catch (error) {
    // Release whatever started before the failure, such as timers and sockets;
    // their handles would otherwise keep the process alive after a failed start.
    await app.close();
    throw error;
  }
  return app;
}
