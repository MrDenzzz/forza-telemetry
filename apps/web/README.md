# @ft/web

**English** · [Русский](README.ru.md)

Next.js app with two parts:

- **Live** (`/`): speed and gear, revs, pedals and steering, g-force, tyre temperatures and grip, race position and lap times, and 30-second charts of speed, revs, throttle and brake.
- **History** (`/sessions`): recorded sessions with their statistics and laps, and a comparison of any two laps (`/compare?laps=a,b`): time gap, speed, throttle, brake and gear along the lap, with a track map that follows the cursor.

```sh
pnpm dev    # from the repository root: API on :4000 and dashboard on http://localhost:3000
```

| Variable                     | Default                 | Meaning                                                                                                                                             |
| ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`        | `http://localhost:4000` | API base URL; the live stream is derived from it (`http` → `ws`, `https` → `wss`)                                                                   |
| `API_URL`                    | `NEXT_PUBLIC_API_URL`   | The API as the server reaches it, for the history and the replayed course, when that differs from the public address (in Docker: `http://api:4000`) |
| `NEXT_PUBLIC_DEMO_MEDIA_URL` | `/media/demo`           | Where the demo page finds its video, poster and telemetry track ([docs/deploy.md](../../docs/deploy.md#3-the-demo-media))                           |

The API addresses are read and validated on the server as pages render, so one image serves any domain; a malformed URL makes the pages that use it fail with a validation error. The browser only ever opens the live stream; everything else is fetched by the server. The demo page is static, so its media address is fixed at build time: the default, a path on the same site, fits any domain.

## How it renders

Frames arrive up to 30 times per second, and the page avoids re-rendering on each of them: numbers are read through selectors that re-render a component only when its displayed value changes, and the g-force circle and the charts draw on canvas once per animation frame. Details and alternatives: [ADR 0004](../../docs/adr/0004-live-dashboard-rendering.md).

The connection, store and React hooks come from [`@ft/live-client`](../../packages/live-client/README.md), which the mobile app shares.

The history pages are server components: they fetch from the [REST API](../../apps/api/README.md#interface), validate every response with the shared contracts and render HTML. Sessions are fetched fresh, laps are cached for good because a recorded lap never changes. Only the interactive parts run in the browser: picking laps, and the comparison charts, whose cursors are synchronised and move the marker on the track map without re-rendering React.

Laps compare point by point because every trace is sampled at the same places along the route; distance on the charts is measured along the first lap.

## Tests

Vitest with Testing Library in happy-dom: formatting, config, g-force geometry, the widgets against a fake WebSocket, the chart with a mocked uPlot, and render counts that prove frames do not re-render status-only components. For the history: the API client against a fake `fetch` (contract validation, 404, errors), the comparison maths, the session and lap tables, lap selection, and the track map marker.
