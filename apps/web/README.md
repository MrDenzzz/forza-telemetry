# @ft/web

**English** · [Русский](README.ru.md)

Next.js app with two parts:

- **Live** (`/`): speed and gear, revs, pedals and steering, g-force, tyre temperatures and grip, race position and lap times, and 30-second charts of speed, revs, throttle and brake.
- **History** (`/sessions`): recorded sessions with their statistics and laps, and a comparison of any two laps (`/compare?laps=a,b`): time gap, speed, throttle, brake and gear along the lap, with a track map that follows the cursor.

```sh
pnpm dev    # from the repository root: API on :4000 and dashboard on http://localhost:3000
```

| Variable              | Default                 | Meaning                                                                           |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL; the live stream is derived from it (`http` → `ws`, `https` → `wss`) |

The value is validated and inlined at build time, so an invalid URL fails the build. The history pages read the API from the server with the same URL.

## How it renders

Frames arrive up to 30 times per second, and the page avoids re-rendering on each of them: numbers are read through selectors that re-render a component only when its displayed value changes, and the g-force circle and the charts draw on canvas once per animation frame. Details and alternatives: [ADR 0004](../../docs/adr/0004-live-dashboard-rendering.md).

The connection, store and React hooks come from [`@ft/live-client`](../../packages/live-client/README.md), which the mobile app shares.

The history pages are server components: they fetch from the [REST API](../../apps/api/README.md#interface), validate every response with the shared contracts and render HTML. Sessions are fetched fresh, laps are cached for good because a recorded lap never changes. Only the interactive parts run in the browser: picking laps, and the comparison charts, whose cursors are synchronised and move the marker on the track map without re-rendering React.

Laps compare point by point because every trace is sampled at the same places along the route; distance on the charts is measured along the first lap.

## Tests

Vitest with Testing Library in happy-dom: formatting, config, g-force geometry, the widgets against a fake WebSocket, the chart with a mocked uPlot, and render counts that prove frames do not re-render status-only components. For the history: the API client against a fake `fetch` (contract validation, 404, errors), the comparison maths, the session and lap tables, lap selection, and the track map marker.
