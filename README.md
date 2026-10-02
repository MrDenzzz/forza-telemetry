# Forza Telemetry

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
| `pnpm check`     | Lint, typecheck, test and build every workspace |
| `pnpm lint`      | ESLint with type-aware rules                    |
| `pnpm typecheck` | TypeScript in every workspace                   |
| `pnpm test`      | Unit and integration tests                      |
| `pnpm build`     | Production builds                               |
| `pnpm format`    | Format the repository with Prettier             |

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); a git hook installed by `pnpm install` checks messages and formats staged files.

## Documentation

- [Forza Horizon 6 "Data Out" reference](docs/fh6-data-out.md): packet layout, sources, open questions, network setup
- [Architecture decision records](docs/adr/README.md)

## Roadmap

- [x] Monorepo foundation: workspaces, shared configs, CI
- [ ] Packet parser, recorder and replayer
- [ ] API: UDP ingest and live WebSocket stream
- [ ] Web: live dashboard
- [ ] Sessions, laps, history and lap comparison
- [ ] Mobile: live gauges
- [ ] Docker, deployment, demo mode

---

Not affiliated with or endorsed by Microsoft, Xbox Game Studios or Playground Games. Forza Horizon is a trademark of Microsoft Corporation.
