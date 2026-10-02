# Forza Telemetry

**English** · [Русский](README.ru.md)

Real-time telemetry for Forza Horizon 6. A NestJS service ingests the game's UDP "Data Out" stream, detects sessions and laps, stores lap analytics in Postgres, and streams live data to a Next.js dashboard and a React Native gauge cluster.

> Work in progress: the project is built step by step, see the [roadmap](#roadmap).

## Repository layout

```
apps/        deployable applications (api, web, mobile)
packages/    shared libraries and configuration
tools/       developer CLIs (recorder, replayer)
docs/        architecture decision records and protocol reference
```

## Getting started

Requirements: Node.js 24 LTS and pnpm 12 (`npm install --global pnpm@12`).

```sh
pnpm install
pnpm check
```

| Script           | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Run the API in watch mode                       |
| `pnpm check`     | Lint, typecheck, test and build every workspace |
| `pnpm lint`      | ESLint with type-aware rules                    |
| `pnpm typecheck` | TypeScript in every workspace                   |
| `pnpm test`      | Unit and integration tests                      |
| `pnpm build`     | Production builds                               |
| `pnpm format`    | Format the repository with Prettier             |
| `pnpm record`    | Record the game's telemetry to a file           |
| `pnpm replay`    | Replay a recording over UDP                     |

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); a git hook installed by `pnpm install` checks messages and formats staged files.

## Connecting the game

In Forza Horizon 6 open Settings → HUD and Gameplay and set **Data Out** to On, **Data Out IP Address** to `127.0.0.1` and **Data Out IP Port** to `9876`. Microsoft Store and PC Game Pass builds also need a [loopback exemption](docs/fh6-data-out.md#network-setup-on-windows).

## Running the API

```sh
pnpm dev                                          # API on http://localhost:4000, telemetry on UDP 9876
pnpm replay recordings/<file>.ftr.gz --loop       # without the game: replay a recording into it
```

Live data streams over WebSocket at `ws://localhost:4000/live`; `GET /health` reports whether the game is sending. Configuration and endpoints: [apps/api](apps/api/README.md).

## Recording and replaying

The game streams only while you drive, so development, tests and the hosted demo run on recordings.

```sh
pnpm record --note "Goliath, 3 laps"
pnpm replay recordings/fh6-<timestamp>.ftr.gz --loop
```

See [recorder](tools/recorder/README.md), [replayer](tools/replayer/README.md) and [ADR 0002](docs/adr/0002-recording-format.md) on the file format.

## Documentation

Every document has a Russian translation (`*.ru.md`) linked at its top.

- [Forza Horizon 6 "Data Out" reference](docs/fh6-data-out.md): packet layout, sources, open questions, network setup
- [Architecture decision records](docs/adr/README.md)

## Roadmap

- [x] Monorepo foundation: workspaces, shared configs, CI
- [x] Packet parser, recorder and replayer
- [x] API: UDP ingest and live WebSocket stream
- [ ] Web: live dashboard
- [ ] Sessions, laps, history and lap comparison
- [ ] Mobile: live gauges
- [ ] Docker, deployment, demo mode

## License

[MIT](LICENSE)

---

Not affiliated with or endorsed by Microsoft, Xbox Game Studios or Playground Games. Forza Horizon is a trademark of Microsoft Corporation.
