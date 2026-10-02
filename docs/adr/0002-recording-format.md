# 0002. Raw binary recordings with arrival times

**English** · [Русский](0002-recording-format.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

The game streams telemetry only while someone is driving. Development, automated tests and the hosted demo must work without it, which needs captures of real sessions that can be played back faithfully. Faithful means the same bytes and the same arrival pattern: the rate follows the game's frame rate and has gaps during pauses, menus and rewinds, and session detection depends on exactly that.

## Decision

- **Capture raw datagrams, not decoded packets.** Each record stores the bytes as received, including datagrams that fail to decode. A recording made today can be re-read by tomorrow's parser, and a parser bug never corrupts the archive.
- **Timestamp on arrival with a monotonic clock** (`performance.now()`), stored as milliseconds since the start of the recording. The game's own `TimestampMS` describes game time; it wraps and says nothing about when packets arrived.
- **A small versioned binary format**: a header with magic bytes, a format version and JSON metadata (game, start time, note), followed by records of `F64` elapsed time, `U16` length and payload. Gzip is applied to the whole file when the name ends in `.gz`.
- **Replay schedules against the start of each pass.** Each packet is due at `passStart + elapsed / speed`; a late timer is caught up on the next packet instead of shifting all later ones. The clock is injectable, so the scheduler is tested deterministically.

## Consequences

- About 334 bytes per packet: roughly 20 KB/s at 60 FPS before compression.
- The same `replay()` drives the replayer CLI and, later, the API's demo mode, which feeds packets into the pipeline in-process instead of over UDP.
- The format is ours: tools like Wireshark cannot open it, and a format change needs a version bump and a reader for older versions.

## Alternatives considered

- **pcap / pcapng.** Standard and readable in Wireshark, but each packet needs link-layer framing or a user-defined link type, and pcap has nowhere to put metadata. Wireshark would not decode the Forza payload anyway.
- **NDJSON with base64 payloads.** Human-readable, but a third larger, slower to parse, and the readable part is only the envelope.
- **Storing decoded packets.** Loses datagrams that fail to decode and ties every recording to the parser version that produced it.
