import { createSocket } from 'node:dgram';

import { readRecordedPackets, replay, type RecordedPacket, type ReplayStats } from '@ft/recording';

export interface Endpoint {
  readonly host: string;
  readonly port: number;
}

export interface ReplayerOptions {
  readonly file: string;
  readonly target: Endpoint;
  readonly speed?: number;
  readonly loop?: boolean;
  readonly signal?: AbortSignal;
  readonly onPacket?: (packet: RecordedPacket) => void;
}

export interface ReplayerStats extends ReplayStats {
  readonly sendErrors: number;
}

/** Sends a recording to `target` over UDP with its original timing. */
export async function runReplayer(options: ReplayerOptions): Promise<ReplayerStats> {
  const { file, target, speed, loop, signal, onPacket } = options;
  const socket = createSocket('udp4');
  let sendErrors = 0;
  // Sends complete asynchronously; closing the socket first silently drops the last packets.
  const inFlight = new Set<Promise<void>>();

  try {
    const stats = await replay(
      () => readRecordedPackets(file),
      (packet) => {
        const sent = new Promise<void>((resolve) => {
          socket.send(packet.payload, target.port, target.host, (error) => {
            if (error) {
              sendErrors += 1;
            }
            resolve();
          });
        });
        inFlight.add(sent);
        void sent.then(() => inFlight.delete(sent));
        onPacket?.(packet);
      },
      {
        ...(speed === undefined ? {} : { speed }),
        ...(loop === undefined ? {} : { loop }),
        ...(signal === undefined ? {} : { signal }),
      },
    );
    await Promise.all(inFlight);
    return { ...stats, sendErrors };
  } finally {
    await new Promise<void>((resolve) => {
      socket.close(() => {
        resolve();
      });
    });
  }
}
