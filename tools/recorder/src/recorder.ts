import { createSocket, type Socket } from 'node:dgram';
import type { AddressInfo } from 'node:net';

import { createRecordingWriter, type RecordingMetadata } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';

export interface Endpoint {
  readonly host: string;
  readonly port: number;
}

export interface RecorderOptions {
  readonly listen: Endpoint;
  readonly outputPath: string;
  readonly metadata: RecordingMetadata;
  /** Also send every datagram here: only one process can bind the port the game sends to. */
  readonly forwardTo?: Endpoint;
  /** Called once if recording fails after start, e.g. on a full disk. The recorder keeps the socket open until stopped. */
  readonly onError?: (error: Error) => void;
}

export interface RecorderStats {
  readonly packets: number;
  readonly bytes: number;
  /** Datagrams that are not 324-byte Horizon packets; recorded anyway. */
  readonly invalidPackets: number;
  readonly raceOnPackets: number;
  readonly forwardErrors: number;
  readonly elapsedMs: number;
}

export interface Recorder {
  readonly address: AddressInfo;
  stats(): RecorderStats;
  /** Closes the socket and flushes the file. */
  stop(): Promise<RecorderStats>;
}

export async function startRecorder(options: RecorderOptions): Promise<Recorder> {
  const { listen, outputPath, metadata, forwardTo, onError } = options;

  // Bind first so a busy port fails before an empty recording file is created.
  const socket = createSocket('udp4');
  await bind(socket, listen);
  const writer = await createRecordingWriter(outputPath, metadata).catch(async (error: unknown) => {
    await close(socket);
    throw error;
  });

  const startedAt = performance.now();
  let packets = 0;
  let bytes = 0;
  let invalidPackets = 0;
  let raceOnPackets = 0;
  let forwardErrors = 0;
  let failed = false;
  let stopping = false;
  // Sends complete asynchronously; closing the socket first silently drops the last forwarded packets.
  const forwarding = new Set<Promise<void>>();

  const fail = (error: unknown): void => {
    if (!failed) {
      failed = true;
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  socket.on('error', fail);
  socket.on('message', (message) => {
    if (failed || stopping) {
      return;
    }
    try {
      writer.write({ elapsedMs: performance.now() - startedAt, payload: message });
    } catch (error) {
      fail(error);
      return;
    }

    packets += 1;
    bytes += message.byteLength;
    const decoded = decodePacket(message);
    if (!decoded.ok) {
      invalidPackets += 1;
    } else if (decoded.packet.isRaceOn === 1) {
      raceOnPackets += 1;
    }

    if (forwardTo) {
      const sent = new Promise<void>((resolve) => {
        socket.send(message, forwardTo.port, forwardTo.host, (error) => {
          if (error) {
            forwardErrors += 1;
          }
          resolve();
        });
      });
      forwarding.add(sent);
      void sent.then(() => forwarding.delete(sent));
    }
  });

  const stats = (): RecorderStats => ({
    packets,
    bytes,
    invalidPackets,
    raceOnPackets,
    forwardErrors,
    elapsedMs: performance.now() - startedAt,
  });

  return {
    address: socket.address(),
    stats,
    async stop() {
      stopping = true;
      await Promise.all(forwarding);
      await close(socket);
      await writer.close();
      return stats();
    },
  };
}

function bind(socket: Socket, { host, port }: Endpoint): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, host, () => {
      socket.off('error', reject);
      resolve();
    });
  });
}

function close(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    socket.close(() => {
      resolve();
    });
  });
}
