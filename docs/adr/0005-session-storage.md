# 0005. Session storage: derived sessions and laps in PostgreSQL, no raw stream

**English** · [Русский](0005-session-storage.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

The game sends a 324-byte packet per rendered frame, 72–86 per second: about 26 KB/s, 93 MB and 300,000 packets per hour of driving. History needs much less than that: which sessions took place, their laps and times, and enough of each lap to chart it and compare it with another lap of the same route. The raw stream is already kept losslessly, when wanted, by the recorder ([ADR 0002](0002-recording-format.md)).

Docker is not available on every development machine, while the tests should exercise real SQL rather than a mock.

## Decision

- **Store what the session tracker derives, never packets.** A pure domain module (`apps/api/src/sessions/domain`) turns packets into events: session started, lap completed, lap undone by a rewind, session ended or discarded. A recorder service writes these events one at a time, in order. Writes are rare, a few per minute, so they need neither batching nor a queue.
- **Three tables.** `sessions` with the car and the session statistics, `laps` with times and per-lap figures, and `lap_traces` with one row per lap. The trace is kept apart so that listing sessions and laps never reads it.
- **Traces as `REAL[]` columns, one per channel**, resampled every 5 units of the game's route progress (`DistanceTraveled`, which is not meters: see [the protocol notes](../fh6-data-out.md)). Index _i_ of every lap of a route is the same place on the track, which is what comparing laps needs. About 1,200 points × 11 channels × 4 bytes is roughly 50 KB per lap; 32-bit floats are precise enough for every channel, including world positions.
- **PostgreSQL through Prisma 7** with the `pg` driver adapter, a generated client, and SQL migrations committed to the repository and applied with `prisma migrate deploy`.
- **Statistics arrive when a session ends.** Sessions left open by a crash are closed as `interrupted` on the next start; lap count, best lap and end time are rebuilt from the laps that were saved, and the statistics stay empty.
- **Tests run on PGlite**, PostgreSQL compiled to WebAssembly, started inside the test process and served over TCP, so the API connects exactly as it does to a server. Each test file gets its own database built from the committed migration files, and a test replays the migrations on an empty PGlite to check that they produce exactly the Prisma schema. `pnpm --filter @ft/api db:local` serves the same embedded database for development without Docker.

## Consequences

- History cannot be recomputed with a better algorithm, except from recordings. A change to lap detection applies to new sessions only.
- Storage grows with laps, not with time: an hour of racing is about 50 laps and 2.5 MB, an hour of free roam a single row.
- A recorded lap never changes; a rewind that undoes a lap deletes it, and the lap driven again gets a new id. The API caches laps for good on that basis ([ADR 0006](0006-history-rest-api.md)).
- A failed write is logged and skipped. The next event of the same session can fail too, for example a lap of a session that was never inserted; the session tracker keeps running regardless.
- PGlite runs a single session at a time, so tests and `db:local` use a pool of one connection (`DATABASE_POOL_SIZE=1`). Production uses PostgreSQL 17 with the default pool of 10.
- `prisma generate` is not automatic in Prisma 7; it is a Turborepo task that build, typecheck, lint and test depend on. The generated client is not committed.

## Alternatives considered

- **Raw packets in PostgreSQL or TimescaleDB.** Exact replay of any session, but 300,000 rows per hour, a retention policy, and every history query would have to re-derive laps.
- **Trace as JSONB or one row per point.** JSONB keeps every number as a variable-length `numeric`, several times the 4 bytes of a `REAL`, and decodes it on every read; a row per point means 1,200 rows per lap and an aggregation to read a lap back.
- **Trace resampled by time.** Two laps of different pace would not line up: the same index would be different places on the track.
- **PostgreSQL in Docker or Testcontainers for tests.** The most faithful option, but it requires Docker wherever the tests run. PGlite runs the same SQL engine in-process.
- **SQLite.** Simpler to embed, but a different SQL dialect from the production database.
