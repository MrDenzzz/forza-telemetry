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

| Export                                     | Purpose                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `LIVE_PATH`, `LIVE_PROTOCOL_VERSION`       | WebSocket path and the version announced in `hello`; a breaking schema change increments it                   |
| `liveServerMessageSchema`                  | Union of `hello`, `status` and `frame` messages                                                               |
| `liveFrameSchema`, `LiveFrame`             | One telemetry snapshot in SI units: m/s, °C, g, inputs normalised to 0–1 (steering −1–1), gear −1 for reverse |
| `telemetryStateSchema`                     | `offline`, `idle` (game running, nobody driving) or `driving`                                                 |
| `parseLiveServerMessage(text)`             | JSON parsing and validation that never throws                                                                 |
| `healthResponseSchema`                     | Response of `GET /health`                                                                                     |
| `carSchema`, `CAR_CLASSES`, `DRIVETRAINS`  | The car as both the live frame and the history describe it                                                    |
| `listSessionsQuerySchema`                  | Query of `GET /sessions`: `cursor`, `limit` (1–100, 20 by default) and `kind`, coerced from the query string  |
| `sessionPageSchema`, `sessionDetailSchema` | Responses of `GET /sessions` and `GET /sessions/:id`; statistics are null until a session ends                |
| `lapDetailSchema`, `LAP_TRACE_CHANNELS`    | Response of `GET /laps/:id`: a lap with its trace, one array per channel sampled along the route              |

The API builds frames and responses that satisfy these schemas, validates queries with them, and its end-to-end tests parse every message and response it sends; clients validate what they receive.
