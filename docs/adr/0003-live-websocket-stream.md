# 0003. Live stream: server-push WebSocket, throttled by arrival time

**English** · [Русский](0003-live-websocket-stream.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

The game sends a packet per rendered frame: 72–86 per second in our recordings, and more with an uncapped frame rate. Gauges in a browser or on a phone gain nothing above about 30 updates per second, and a phone on Wi-Fi pays for every byte. The game also sends all-zero packets outside of driving, which the dashboards should show as a state rather than as zeros. Dashboards only listen; nothing flows from them to the server yet.

## Decision

- **Native WebSocket** through `@nestjs/platform-ws` (the `ws` library) on a single path, `/live`. Browsers and React Native ship a WebSocket client, so dashboards need no library.
- **Server push only, JSON messages described by Zod schemas** in `@ft/contracts`: `hello` (protocol version, frame rate, current state), `status` (`offline`, `idle`, `driving`) and `frame`. Every frame is a complete snapshot, so a lost or skipped frame never leaves a client inconsistent.
- **Throttle by arrival time, not by timers.** A frame is sent when a packet arrives in the next 33 ms slot. Slots are spaced from the previous slot, not from the previous send, so the average holds at 30 Hz even when packets arrive in bursts. We measured the alternatives first: RxJS `sampleTime(33)` delivered 21.8 frames per second on Windows, because OS timers there tick every 15.6 ms. A plain "at least 33 ms apart" filter gave the same 21 Hz with a replay, which sends packets in timer-sized bursts.
- **Frames only while driving.** The state comes from the packets themselves: `IsRaceOn = 1` means driving, the zero packets mean idle, and two seconds of silence mean offline.
- **Slow clients miss frames instead of queueing them.** A connection holding more than 64 KiB of unsent data (about two seconds) skips frames until it drains, so one bad connection cannot grow the server's memory or delay the others.
- **Heartbeat.** The server pings every 15 seconds and drops connections that did not answer the previous ping, such as a phone that lost Wi-Fi without closing the socket.
- **Fractional numbers rounded to thousandths** when serialising: about 1 KB per frame instead of 1.45 KB, roughly 30 KiB/s per client.

## Consequences

- Spikes shorter than a frame interval, like a one-frame jolt of g-force, can be missed on the live view. Analysis features work on the full-rate stream on the server, not on what dashboards receive.
- Clients implement reconnection and backoff themselves; the protocol carries a version so they can refuse a server they do not understand.
- JSON is about four times larger than a packed binary frame. At 30 KiB/s per client that is acceptable; a binary encoding would need a hand-maintained layout on three clients.

## Alternatives considered

- **Socket.IO.** Rooms, namespaces and acknowledgements are not needed for one broadcast stream, and every client would need the Socket.IO library.
- **Server-Sent Events.** A natural fit for push-only data, but React Native has no built-in `EventSource`, and WebSocket leaves room for clients to send subscriptions later.
- **Forwarding every packet and throttling on the client.** Moves 80+ messages per second over Wi-Fi to a phone that renders 30.
