import { startApp } from './app.ts';
import { ConfigError, loadConfig } from './config/app-config.ts';

startApp(loadConfig(process.env)).catch((error: unknown) => {
  // The logger may not exist yet. A config error is meant for a human reading the terminal;
  // anything else keeps its stack trace.
  const message =
    error instanceof ConfigError
      ? error.message
      : error instanceof Error
        ? (error.stack ?? error.message)
        : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
