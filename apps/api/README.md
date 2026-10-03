# @ft/api

**English** · [Русский](README.ru.md)

NestJS service that receives the game's UDP telemetry, streams it to dashboards over WebSocket, detects sessions and laps, stores them in PostgreSQL and serves the history over REST.

```sh
pnpm --filter @ft/api db:local    # PostgreSQL without Docker, see Database below
pnpm --filter @ft/api db:migrate  # apply migrations to DATABASE_URL
pnpm --filter @ft/api dev         # watch mode, reads apps/api/.env if present
pnpm replay <recording> --loop    # in another terminal, if the game is not running
```

## Configuration

Environment variables are validated once at startup; an invalid value stops the process with a message naming the variable. Only `DATABASE_URL` is required, see [`.env.example`](.env.example).

| Variable               | Default        | Meaning                                                                                       |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `HTTP_HOST`            | `0.0.0.0`      | HTTP and WebSocket address; all interfaces so a phone on the LAN can connect                  |
| `HTTP_PORT`            | `4000`         | HTTP and WebSocket port                                                                       |
| `UDP_HOST`             | `127.0.0.1`    | Telemetry address; `0.0.0.0` for a game on another machine or an Xbox                         |
| `UDP_PORT`             | `9876`         | Telemetry port; 5200–5300 are refused, the game uses them                                     |
| `TELEMETRY_SOURCE`     | `udp`          | `udp` listens for the game; `replay` plays `REPLAY_FILE` in a loop instead, for a hosted demo |
| `REPLAY_FILE`          | —              | Recording to replay (`pnpm record` makes them)                                                |
| `RECORD_SESSIONS`      | `true`         | Store sessions and laps; off for a replay, which would repeat one forever                     |
| `LIVE_RATE_HZ`         | `30`           | Frames per second sent to live clients                                                        |
| `TELEMETRY_TIMEOUT_MS` | `2000`         | Silence after which the game counts as offline                                                |
| `DATABASE_URL`         | required       | `postgresql://` URL of the history database                                                   |
| `DATABASE_POOL_SIZE`   | `10`           | Database connections; 1 for PGlite, which runs one session at a time                          |
| `LOG_LEVEL`            | `info`         | `fatal` … `trace`, or `silent`                                                                |
| `LOG_PRETTY`           | in development | Human-readable logs instead of JSON                                                           |

### Where the game runs

- **Same PC, Steam:** the defaults work; point Data Out at `127.0.0.1:9876`.
- **Same PC, Microsoft Store or PC Game Pass:** Windows blocks the game from sending to loopback until it is exempted, see [network setup](../../docs/fh6-data-out.md#network-setup-on-windows).
- **Another PC or an Xbox:** set `UDP_HOST=0.0.0.0`, allow the UDP port in the firewall and point Data Out at this machine's LAN address.

## Interface

| Endpoint                          | Purpose                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                     | Liveness, plus the telemetry state and packet counters. A game that is offline does not make the service unhealthy.                 |
| `WS /live`                        | Server-push stream: `hello` on connect, `status` on every state change, `frame` up to `LIVE_RATE_HZ` times per second while driving |
| `GET /sessions?cursor&limit&kind` | Sessions, newest first, in pages of `limit` (20 by default, at most 100); `nextCursor` fetches the next page                        |
| `GET /sessions/:id`               | A session with its laps                                                                                                             |
| `GET /laps/:id`                   | A lap with its trace: speed, inputs, gear, g-forces and position along the route. Cached for good: a recorded lap never changes     |

Message and response schemas live in [`@ft/contracts`](../../packages/contracts/README.md). Why the stream works this way: [ADR 0003](../../docs/adr/0003-live-websocket-stream.md); the history API: [ADR 0006](../../docs/adr/0006-history-rest-api.md).

## Sessions and laps

A pure tracker in [`src/sessions/domain`](src/sessions/domain) turns the packet stream into sessions and laps, following what the game actually sends ([race lifecycle](../../docs/fh6-data-out.md#race-lifecycle)):

- A session is continuous driving in one car. A race and the free roam around it are separate sessions; a new car, a new race or two minutes without driving start a new one.
- A lap completes when the game's lap counter increments, with the game's own lap time. The final lap of a race is never reported by the game, so it is taken from the lap clock once driving has not resumed for 30 s.
- A rewind cuts the lap back to where driving resumes, and undoes a lap if it crosses back over the line.
- Sessions with no complete lap and less than 10 s or 100 m of driving, such as the car showcase before a race, are discarded.
- Every lap keeps a trace resampled along the route, so two laps of the same route line up point by point.

Only these derived records are stored, never the packet stream: [ADR 0005](../../docs/adr/0005-session-storage.md).

## Database

PostgreSQL through Prisma 7. The schema is [`prisma/schema.prisma`](prisma/schema.prisma) and the migrations in [`prisma/migrations`](prisma/migrations) are applied with `pnpm --filter @ft/api db:migrate`. The client is generated into `src/generated` by the `generate` task, which Turborepo runs before build, typecheck, lint and test.

`pnpm --filter @ft/api db:local` serves an embedded PostgreSQL (PGlite) at the URL in `.env.example`, with its data in `apps/api/.pglite`, so no Docker is needed for development. A new migration is written with `prisma migrate dev --create-only`, which needs a second empty database as `SHADOW_DATABASE_URL`.

## Structure

```
src/
  config/      environment schema and the typed config provider
  telemetry/   UDP source, decoding, connection state (offline / idle / driving)
  live/        WebSocket gateway, frame mapping, throttling, slow-client handling
  sessions/    session and lap tracking (domain/), recording to the database, REST controller
  database/    Prisma client lifecycle
  health/      health check
prisma/        schema and migrations
scripts/       local embedded database
```

The telemetry source sits behind an interface, so the demo mode can feed a recording into the same pipeline.

## Tests

- Unit tests cover config validation, the state machine (RxJS marble tests), frame mapping, throttling and broadcasting.
- [`live.e2e.test.ts`](test/live.e2e.test.ts) starts the real application on free ports, plays an 8-second recording from the game into it over UDP and checks every WebSocket message against the contract, the frame rate, the state changes and the health check.
- The session tracker is tested on a simulated game (laps, the final lap, rewinds across the line, restarts, car changes) and on a recorded two-lap circuit race, whose lap times must match what the game showed.
- Database tests run on PGlite in process, with the schema built from the committed migrations; one test checks that the migrations produce exactly the Prisma schema. No database server or Docker is needed.
- [`sessions.e2e.test.ts`](test/sessions.e2e.test.ts) feeds the recorded race into the application with its original timestamps and reads the session, its laps and a trace back over HTTP.

Vitest compiles the code with SWC, because Nest needs the decorator metadata that Vite's default transform omits.
