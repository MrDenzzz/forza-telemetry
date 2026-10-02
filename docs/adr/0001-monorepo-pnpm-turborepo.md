# 0001. Monorepo on pnpm workspaces and Turborepo

**English** · [Русский](0001-monorepo-pnpm-turborepo.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

The system has three applications (NestJS API, Next.js dashboard, Expo app), two CLIs (recorder, replayer) and code they all share: the binary packet parser, the recording file format, and the schemas of WebSocket and REST messages. A change to a shared contract has to reach every consumer in the same change set, and CI has to prove that the whole system still type-checks and passes its tests.

## Decision

One repository with **pnpm workspaces** for dependency management and **Turborepo** for task orchestration and caching.

- `apps/*` are deployable applications, `tools/*` are developer CLIs, `packages/*` are libraries and shared configuration.
- Versions of dependencies used by several workspaces live in the pnpm **catalog** (`pnpm-workspace.yaml`), so they cannot drift apart.
- Workspace libraries export TypeScript sources under the custom `@ft/source` condition and compiled `dist` as the default. Type checking, linting, tests and editor navigation read sources directly; only runtime artifacts need a build. Turborepo models this with a `transit` task, so `lint`, `typecheck` and `test` are invalidated by changes in dependencies without waiting for their builds.
- Shared TypeScript, ESLint and Vitest settings are workspace packages (`@ft/tsconfig`, `@ft/eslint-config`, `@ft/vitest-config`) rather than root files, so every package declares what it extends.
- pnpm's supply-chain defaults stay on: dependency install scripts require an explicit `allowBuilds` entry, and releases younger than one day are not installed.

## Consequences

- A contract change and all of its consumers land in one commit; the type checker finds every broken call site.
- `pnpm check` runs lint, typecheck, test and build for the whole graph, and Turborepo skips tasks whose inputs did not change, locally and in CI.
- Library `exports` maps carry two entry points, and every bundler or test runner that consumes sources must know the `@ft/source` condition. This is a one-line setting per tool and is covered by the build in CI.
- Contributors need pnpm 12 and Node.js 24.

## Alternatives considered

- **Separate repositories per app.** Shared code would need to be published and versioned, and a protocol change would span several pull requests. Too much ceremony for one team.
- **npm or Yarn workspaces.** Workable, but pnpm's strict `node_modules` layout catches undeclared dependencies, and catalogs keep versions aligned without extra tooling.
- **Nx.** More capable (generators, module boundary rules) but heavier and more opinionated than this repository needs; Turborepo covers caching and task ordering with a single config file.
- **Compiled-only internal packages.** Simpler `exports`, but every type check and test would first need a build of all dependencies, and editor navigation would land in `.d.ts` files.
