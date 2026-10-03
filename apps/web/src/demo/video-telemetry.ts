import {
  LIVE_PROTOCOL_VERSION,
  type DemoTrack,
  type LiveServerMessage,
  type TelemetryState,
} from '@ft/contracts';
import type { WebSocketLike } from '@ft/live-client';

/** Without a frame for this long, the car is not being driven at that point of the video. */
const IDLE_AFTER_SECONDS = 0.5;
/** A step in video time larger than this is a seek, or the loop starting over. */
const SEEK_SECONDS = 1;
/** After a seek, this much of the track is delivered at once, so trails and charts have history. */
const CONTEXT_SECONDS = 2;

/** Index of the last frame at or before `seconds`, or -1. */
function lastFrameAt(frames: DemoTrack['frames'], seconds: number): number {
  let low = 0;
  let high = frames.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((frames[middle]?.[0] ?? Infinity) <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/**
 * Plays a demo track as if it were the live stream, driven by the video's clock instead of the
 * network. A LiveStore connects to it through `createSocket`, so the page uses the dashboard's own
 * widgets and store unchanged, and pausing, seeking and looping the video move the telemetry along.
 */
export class VideoTelemetry {
  readonly #track: DemoTrack;
  #socket: WebSocketLike | undefined;
  #delivered = -1;
  #seconds = 0;
  #state: TelemetryState = 'idle';

  constructor(track: DemoTrack) {
    this.#track = track;
  }

  readonly createSocket = (): WebSocketLike => {
    const socket: WebSocketLike = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: () => {
        if (this.#socket === socket) {
          this.#socket = undefined;
        }
      },
    };
    this.#socket = socket;
    this.#delivered = -1;
    this.#state = 'idle';
    // The store sets its handlers once this returns.
    queueMicrotask(() => {
      this.#send({
        type: 'hello',
        protocolVersion: LIVE_PROTOCOL_VERSION,
        rateHz: this.#track.rateHz,
        state: this.#state,
        source: 'recording',
      });
    });
    return socket;
  };

  /**
   * Delivers what the video has reached at `seconds`. On a seek, `onSeek` runs first, so that
   * the caller can start histories over before the new frames arrive.
   */
  sync(seconds: number, onSeek?: () => void): void {
    const { frames, rateHz } = this.#track;
    const target = lastFrameAt(frames, seconds);
    if (seconds < this.#seconds || seconds - this.#seconds > SEEK_SECONDS) {
      onSeek?.();
      this.#delivered = Math.max(-1, target - Math.round(rateHz * CONTEXT_SECONDS) - 1);
    }
    this.#seconds = seconds;

    for (let index = this.#delivered + 1; index <= target; index += 1) {
      const frame = frames[index]?.[1];
      if (frame) {
        this.#send({ type: 'frame', frame });
      }
    }
    this.#delivered = Math.max(this.#delivered, target);

    const lastFrameSeconds = frames[target]?.[0];
    const state: TelemetryState =
      lastFrameSeconds !== undefined && seconds - lastFrameSeconds < IDLE_AFTER_SECONDS
        ? 'driving'
        : 'idle';
    if (state !== this.#state) {
      this.#state = state;
      this.#send({ type: 'status', state });
    }
  }

  #send(message: LiveServerMessage): void {
    this.#socket?.onmessage?.({ data: JSON.stringify(message) });
  }
}
