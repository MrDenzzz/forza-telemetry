# Architecture Decision Records

**English** · [Русский](README.ru.md)

Short records of decisions that shape the code base: the context, the choice, and what it costs.

| ADR                                      | Decision                                                              | Status   |
| ---------------------------------------- | --------------------------------------------------------------------- | -------- |
| [0001](0001-monorepo-pnpm-turborepo.md)  | Monorepo on pnpm workspaces and Turborepo                             | Accepted |
| [0002](0002-recording-format.md)         | Raw binary recordings with arrival times                              | Accepted |
| [0003](0003-live-websocket-stream.md)    | Live stream: server-push WebSocket, throttled by arrival time         | Accepted |
| [0004](0004-live-dashboard-rendering.md) | Live dashboard rendering: external store, primitive selectors, canvas | Accepted |

New records copy the structure of an existing one: Context, Decision, Consequences, Alternatives considered. A superseded record stays in place with a link to its replacement.
