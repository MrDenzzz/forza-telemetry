# @ft/api

**English** · [Русский](README.ru.md)

NestJS service that receives the game's UDP telemetry and streams it to dashboards over WebSocket.

```sh
pnpm --filter @ft/api dev     # watch mode, reads apps/api/.env if present
pnpm replay <recording> --loop  # in another terminal, if the game is not running
```

## Configuration

Environment variables are validated once at startup; an invalid value stops the process with a message naming the variable. All are optional, see [`.env.example`](.env.example).

| Variable               | Default        | Meaning                                                                      |
| ---------------------- | -------------- | ---------------------------------------------------------------------------- |
| `HTTP_HOST`            | `0.0.0.0`      | HTTP and WebSocket address; all interfaces so a phone on the LAN can connect |
| `HTTP_PORT`            | `4000`         | HTTP and WebSocket port                                                      |
| `UDP_HOST`             | `127.0.0.1`    | Telemetry address; `0.0.0.0` for a game on another machine or an Xbox        |
| `UDP_PORT`             | `9876`         | Telemetry port; 5200–5300 are refused, the game uses them                    |
| `LIVE_RATE_HZ`         | `30`           | Frames per second sent to live clients                                       |
| `TELEMETRY_TIMEOUT_MS` | `2000`         | Silence after which the game counts as offline                               |
| `LOG_LEVEL`            | `info`         | `fatal` … `trace`, or `silent`                                               |
| `LOG_PRETTY`           | in development | Human-readable logs instead of JSON                                          |

## Interface

| Endpoint      | Purpose                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health` | Liveness, plus the telemetry state and packet counters. A game that is offline does not make the service unhealthy.                 |
| `WS /live`    | Server-push stream: `hello` on connect, `status` on every state change, `frame` up to `LIVE_RATE_HZ` times per second while driving |

Message schemas live in [`@ft/contracts`](../../packages/contracts/README.md). Why the stream works this way: [ADR 0003](../../docs/adr/0003-live-websocket-stream.md).

## Structure

```
src/
  config/      environment schema and the typed config provider
  telemetry/   UDP source, decoding, connection state (offline / idle / driving)
  live/        WebSocket gateway, frame mapping, throttling, slow-client handling
  health/      health check
```

The telemetry source sits behind an interface, so the demo mode can feed a recording into the same pipeline.

## Tests

- Unit tests cover config validation, the state machine (RxJS marble tests), frame mapping, throttling and broadcasting.
- [`live.e2e.test.ts`](test/live.e2e.test.ts) starts the real application on free ports, plays an 8-second recording from the game into it over UDP and checks every WebSocket message against the contract, the frame rate, the state changes and the health check.

Vitest compiles the code with SWC, because Nest needs the decorator metadata that Vite's default transform omits.
