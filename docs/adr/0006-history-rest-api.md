# 0006. History API: read-only REST resources typed by the shared contracts

**English** · [Русский](0006-history-rest-api.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

The web app shows a list of sessions, a session with its laps, and charts that compare two laps. The mobile app may show the same later. The screens are fixed and few; a lap trace is the only large response, about 50 KB of numbers. The brief allowed REST or GraphQL.

## Decision

- **REST with three read-only resources:**
  - `GET /sessions?cursor&limit&kind`: sessions, newest first, in pages;
  - `GET /sessions/:id`: one session with its lap summaries;
  - `GET /laps/:id`: one lap with the header of its session and its full trace.
- **Schemas live in `@ft/contracts`** (zod), like the live stream's. Query strings and path ids are validated with them by a Nest pipe; a malformed request gets 400 with the zod message. Handlers return the contract types, and the end-to-end tests parse every response with the schemas.
- **Cursor pagination.** The cursor is the id of the last session of the page; the order is `startedAt` descending, then `id`, backed by an index on both. New sessions are inserted at the top while the API records, and a cursor is not shifted by them the way an offset is.
- **A lap is cached for good** (`Cache-Control: public, max-age=31536000, immutable`), because a recorded lap never changes ([ADR 0005](0005-session-storage.md)). The header is set in the handler after the lap is found, not with `@Header`, which Nest applies before the handler runs and would put on a 404 too.
- **The same units as the live stream:** m/s, meters, seconds, g; timestamps in ISO 8601 UTC. A session in progress appears with `endedAt: null`.
- **No writes and no authentication.** The API serves one player's history; nothing is deleted or edited through it.

## Consequences

- Comparing two laps takes two requests, each cached on its own, and a lap fetched once never needs fetching again.
- Clients handle sessions in progress and interrupted sessions, whose statistics are null.
- The contracts are the documentation; there is no OpenAPI description. One could be generated from the zod schemas if a third-party client appeared.
- Adding a field is backwards compatible; renaming one changes the contract that the web app and the API compile against, so both fail to build until they agree.

## Alternatives considered

- **GraphQL.** Lets each screen choose its fields, but these screens are fixed, and it brings a schema, resolvers, a client library and per-query caching where a URL per lap gives HTTP caching for free.
- **tRPC.** Type safety with no schema of its own, but it ties every client to the server's TypeScript types and transport; zod contracts over plain HTTP give the same safety and stay usable from anything.
- **Offset pagination.** Simpler, but pages shift as new sessions are recorded.
- **One endpoint returning both laps of a comparison.** Saves a request but makes every pair of laps a separate cache entry.
