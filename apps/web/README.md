# @ft/web

**English** · [Русский](README.ru.md)

Next.js dashboard for live telemetry: speed and gear, revs, pedals and steering, g-force, tyre temperatures and grip, race position and lap times, and 30-second charts of speed, revs, throttle and brake.

```sh
pnpm dev    # from the repository root: API on :4000 and dashboard on http://localhost:3000
```

| Variable              | Default                 | Meaning                                                                           |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL; the live stream is derived from it (`http` → `ws`, `https` → `wss`) |

The value is validated and inlined at build time, so an invalid URL fails the build.

## How it renders

Frames arrive up to 30 times per second, and the page avoids re-rendering on each of them: numbers are read through selectors that re-render a component only when its displayed value changes, and the g-force circle and the charts draw on canvas once per animation frame. Details and alternatives: [ADR 0004](../../docs/adr/0004-live-dashboard-rendering.md).

The connection, store and React hooks come from [`@ft/live-client`](../../packages/live-client/README.md), which the mobile app shares.

## Tests

Vitest with Testing Library in happy-dom: formatting, config, g-force geometry, the widgets against a fake WebSocket, the chart with a mocked uPlot, and render counts that prove frames do not re-render status-only components.
