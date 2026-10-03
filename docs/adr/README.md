# Architecture Decision Records

**English** · [Русский](README.ru.md)

Short records of decisions that shape the code base: the context, the choice, and what it costs.

| ADR                                      | Decision                                                                | Status   |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------- |
| [0001](0001-monorepo-pnpm-turborepo.md)  | Monorepo on pnpm workspaces and Turborepo                               | Accepted |
| [0002](0002-recording-format.md)         | Raw binary recordings with arrival times                                | Accepted |
| [0003](0003-live-websocket-stream.md)    | Live stream: server-push WebSocket, throttled by arrival time           | Accepted |
| [0004](0004-live-dashboard-rendering.md) | Live dashboard rendering: external store, primitive selectors, canvas   | Accepted |
| [0005](0005-session-storage.md)          | Session storage: derived sessions and laps in PostgreSQL, no raw stream | Accepted |
| [0006](0006-history-rest-api.md)         | History API: read-only REST resources typed by the shared contracts     | Accepted |
| [0007](0007-mobile-app.md)               | Mobile app: Expo Go, gauges driven by shared values                     | Accepted |

New records copy the structure of an existing one: Context, Decision, Consequences, Alternatives considered. A superseded record stays in place with a link to its replacement.
