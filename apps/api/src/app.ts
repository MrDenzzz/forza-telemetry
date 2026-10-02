import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.ts';
import type { AppConfig } from './config/app-config.ts';

export async function startApp(config: AppConfig): Promise<INestApplication> {
  return listen(await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true }), config);
}

/**
 * Configures and starts an application built from AppModule, the same way for production and
 * for end-to-end tests that build it from a testing module with some providers replaced.
 */
export async function listen(app: INestApplication, config: AppConfig): Promise<INestApplication> {
  app.useLogger(app.get(Logger));
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  try {
    await app.listen(config.http.port, config.http.host);
  } catch (error) {
    // Release whatever started before the failure, such as timers and the WebSocket server;
    // their handles would otherwise keep the process alive after a failed start.
    await app.close();
    throw error;
  }
  return app;
}
