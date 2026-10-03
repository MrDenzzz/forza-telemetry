# @ft/live-client

**English** · [Русский](README.ru.md)

Client for the API's live WebSocket stream, shared by the web dashboard and the mobile app. The core has no framework dependency; React bindings live in `@ft/live-client/react`.

```tsx
import { LiveStore } from '@ft/live-client';
import { LiveStoreProvider, useFrameValue } from '@ft/live-client/react';

const store = new LiveStore({ url: 'ws://localhost:4000/live', historySeconds: 30 });

function Speed() {
  const kmh = useFrameValue((frame) => Math.round(frame.speed * 3.6), 0);
  return <span>{kmh} km/h</span>;
}

<LiveStoreProvider store={store}>
  <Speed />
</LiveStoreProvider>;
```

| Export                                                                        | Purpose                                                                                                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `LiveConnection`                                                              | Keeps the socket open: exponential backoff with jitter, validation of every message, stops for good on a protocol mismatch    |
| `LiveStore`                                                                   | Status, latest frame and history, with separate listeners for status and frames                                               |
| `FrameHistory`                                                                | Fixed-size ring buffer of recent frames; `columns()` for charts, `recent()` for trails                                        |
| `LiveStoreProvider`, `useConnectionStatus`                                    | Provide a store and read its status; status-only components ignore frames                                                     |
| `useFrameValue(select, fallback)`                                             | One value from the latest frame; re-renders only when that value changes, so `select` returns a primitive                     |
| `parseApiUrl`, `liveUrlFor`                                                   | Read an API address as typed (`192.168.1.20:4000` becomes `http://…`) and derive the stream's `ws://` or `wss://` URL from it |
| `describeStatus`                                                              | The status line both dashboards show, with its tone                                                                           |
| `toCanvasPoint`, `MAX_G`, `G_FORCE_RINGS`                                     | Geometry of the g-g diagram: lateral to the right, acceleration upwards, spikes clamped to the rim                            |
| `toKmh`, `gearLabel`, `lapTime`, `rpmFraction`, `temperatureTone`, `gripTone` | Display rules both dashboards share: units, labels and the bands for tyre temperature and grip                                |

Tests of either dashboard import `createScriptedStore()` and `SAMPLE_FRAME` from `@ft/live-client/testing`: a store on a fake socket that the test plays message by message.

Statuses: `connecting`, `connected` (with the game's state and the frame rate), `waiting` (next attempt and its delay) and `incompatible`. Why it is built this way: [ADR 0004](../../docs/adr/0004-live-dashboard-rendering.md).
