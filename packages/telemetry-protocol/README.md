# @ft/telemetry-protocol

**English** · [Русский](README.ru.md)

Decoder for the Forza Horizon 6 "Data Out" UDP packet: 324 bytes, the same layout as Forza Horizon 4 and 5. It uses no Node.js or DOM APIs, so the API, the browser and React Native can all use it.

```ts
import { decodePacket } from '@ft/telemetry-protocol';

const result = decodePacket(datagram);
if (result.ok) {
  render(result.packet.speed, result.packet.gear);
}
```

| Export                                                         | Purpose                                                                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decodePacket(bytes)`                                          | `{ ok: true, packet }` or `{ ok: false, error }`. Anything can arrive on a UDP port, so a malformed datagram is a value rather than an exception.                                             |
| `TelemetryPacket`                                              | One number per documented field, named as in the official documentation (camelCase), in wire units and encodings: speed in m/s, `isRaceOn` as 0 or 1. Interpreting values is up to consumers. |
| `PACKET_FIELDS`                                                | The field table in wire order. It mirrors the official list line by line; offsets (`FIELD_OFFSETS`, `PACKET_LAYOUT`) are derived from it.                                                     |
| `encodePacket(fields)`                                         | Builds a datagram; omitted fields are zero. For tests and simulators.                                                                                                                         |
| `carClassOf()`, `drivetrainOf()`, `gearOf()`                   | Meaning of coded fields: FH6 class letters, FWD/RWD/AWD, and gears as −1 for reverse, 0 for neutral, 1… forward.                                                                              |
| `DEFAULT_TELEMETRY_PORT`, `RESERVED_PORTS`, `isReservedPort()` | The project's default port and the range the game binds itself (5200–5300).                                                                                                                   |

## Tests

- Packets captured from the game ([`test/fixtures`](test/fixtures)) pin down behaviour the documentation leaves open: units, gear encoding, all-zero packets outside of driving, lap fields at a lap boundary.
- Offsets are checked against values written out by hand from the documentation, independently of the field table.
- Every field round-trips through `encodePacket` and `decodePacket` with a distinct non-zero value, so a field read from the wrong offset cannot pass.
- Views into larger buffers decode correctly; Node's `Buffer` is often such a view.

Field reference, sources and open questions: [docs/fh6-data-out.md](../../docs/fh6-data-out.md).
