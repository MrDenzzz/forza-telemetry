# @ft/contracts

**English** · [Русский](README.ru.md)

The single source of truth for what the API sends: Zod schemas and the TypeScript types inferred from them, shared by the API, the web dashboard and the mobile app. Platform-agnostic.

```ts
import { parseLiveServerMessage } from '@ft/contracts';

socket.onmessage = (event) => {
  const result = parseLiveServerMessage(event.data);
  if (result.ok && result.value.type === 'frame') {
    render(result.value.frame);
  }
};
```

| Export                               | Purpose                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `LIVE_PATH`, `LIVE_PROTOCOL_VERSION` | WebSocket path and the version announced in `hello`; a breaking schema change increments it                   |
| `liveServerMessageSchema`            | Union of `hello`, `status` and `frame` messages                                                               |
| `liveFrameSchema`, `LiveFrame`       | One telemetry snapshot in SI units: m/s, °C, g, inputs normalised to 0–1 (steering −1–1), gear −1 for reverse |
| `telemetryStateSchema`               | `offline`, `idle` (game running, nobody driving) or `driving`                                                 |
| `parseLiveServerMessage(text)`       | JSON parsing and validation that never throws                                                                 |
| `healthResponseSchema`               | Response of `GET /health`                                                                                     |

The API builds frames that satisfy these schemas and its end-to-end test validates every message it sends; clients validate what they receive.
