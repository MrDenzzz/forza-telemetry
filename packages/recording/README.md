# @ft/recording

**English** · [Русский](README.ru.md)

File format for raw telemetry captures, and a scheduler that replays them with their original timing. The recorder and replayer CLIs and the API's demo mode build on it. Node.js only.

## Format

Little-endian, version 1. Paths ending in `.gz` are gzip-compressed transparently.

| Part   | Layout                                                                                 |
| ------ | -------------------------------------------------------------------------------------- |
| Header | `FZTR` magic, format version `U16`, metadata length `U32`, metadata as UTF-8 JSON      |
| Record | milliseconds since the recording started `F64`, payload length `U16`, raw UDP datagram |

Metadata holds the game (`fh5` or `fh6`), the wall-clock start time and an optional note. Why this format: [ADR 0002](../../docs/adr/0002-recording-format.md).

## API

| Export                                  | Purpose                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createRecordingWriter(path, metadata)` | Returns `write(packet)` and `close()`. Creates missing directories.                                  |
| `readRecordingMetadata(path)`           | Reads only the header.                                                                               |
| `readRecordedPackets(path)`             | Async iterable of packets. A partial record at the end, left by an interrupted recorder, is ignored. |
| `RecordingDecoder`                      | Incremental decoder that accepts the file in chunks of any size.                                     |
| `replay(openPackets, emit, options)`    | Emits packets with their original spacing; `speed`, `loop`, `signal` and an injectable `clock`.      |

`replay` measures every due time from the start of the pass instead of from the previous packet, so timer overshoot (up to about 16 ms on Windows) does not accumulate into drift. Tests drive it with a fake clock, without real waiting.
