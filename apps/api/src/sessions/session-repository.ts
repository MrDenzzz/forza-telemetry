import type { LapDetail, ListSessionsQuery, SessionDetail, SessionPage } from '@ft/contracts';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.ts';

import type {
  CompletedLap,
  EndedSession,
  SessionEvent,
  StartedSession,
} from './domain/session-tracker.ts';
import {
  toDbEndReason,
  toDbKind,
  toLapDetail,
  toLapSummary,
  toSessionSummary,
  traceColumns,
} from './history-mapper.ts';

/** Sessions and laps in Postgres: written from tracker events, read for the REST API. */
@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async apply(event: SessionEvent): Promise<void> {
    switch (event.type) {
      case 'session-started':
        await this.#start(event.session);
        return;
      case 'lap-completed':
        await this.#addLap(event.sessionId, event.lap);
        return;
      case 'lap-discarded':
        await this.prisma.lap.deleteMany({
          where: { sessionId: event.sessionId, number: event.lapNumber },
        });
        return;
      case 'session-ended':
        await this.#end(event.session);
        return;
      case 'session-discarded':
        await this.prisma.session.deleteMany({ where: { id: event.sessionId } });
        return;
    }
  }

  /**
   * Ends the sessions an earlier run left open, for example after a crash. Their statistics are
   * lost; lap count, best lap and the end time come from the laps that were saved.
   */
  async closeInterrupted(): Promise<number> {
    const open = await this.prisma.session.findMany({
      where: { endedAt: null },
      select: {
        id: true,
        startedAt: true,
        laps: { select: { startedAt: true, timeSeconds: true, isComplete: true } },
      },
    });
    for (const { id, startedAt, laps } of open) {
      const lapEnds = laps.map((lap) => lap.startedAt.getTime() + lap.timeSeconds * 1000);
      const completeTimes = laps.filter((lap) => lap.isComplete).map((lap) => lap.timeSeconds);
      await this.prisma.session.update({
        where: { id },
        data: {
          endedAt: new Date(Math.max(startedAt.getTime(), ...lapEnds)),
          endReason: 'interrupted',
          lapCount: laps.length,
          bestLapSeconds: completeTimes.length > 0 ? Math.min(...completeTimes) : null,
        },
      });
    }
    return open.length;
  }

  async listSessions({ cursor, limit, kind }: ListSessionsQuery): Promise<SessionPage> {
    // One row beyond the page tells whether another page follows.
    const rows = await this.prisma.session.findMany({
      where: kind === undefined ? {} : { kind: toDbKind(kind) },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    const items = rows.slice(0, limit);
    return {
      items: items.map(toSessionSummary),
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async findSession(id: string): Promise<SessionDetail | null> {
    const row = await this.prisma.session.findUnique({
      where: { id },
      include: { laps: { orderBy: { number: 'asc' } } },
    });
    return row && { ...toSessionSummary(row), laps: row.laps.map(toLapSummary) };
  }

  async findLap(id: string): Promise<LapDetail | null> {
    const row = await this.prisma.lap.findUnique({
      where: { id },
      include: { session: true, trace: true },
    });
    return row?.trace ? toLapDetail({ ...row, trace: row.trace }) : null;
  }

  async #start({ id, kind, car, startedAt }: StartedSession): Promise<void> {
    await this.prisma.session.create({
      data: {
        id,
        kind: toDbKind(kind),
        carOrdinal: car.ordinal,
        carClass: car.class,
        carPerformanceIndex: car.performanceIndex,
        carDrivetrain: car.drivetrain,
        carCylinders: car.cylinders,
        startedAt: new Date(startedAt),
      },
    });
  }

  async #addLap(sessionId: string, { trace, startedAt, ...lap }: CompletedLap): Promise<void> {
    await this.prisma.lap.create({
      data: {
        ...lap,
        sessionId,
        startedAt: new Date(startedAt),
        trace: { create: { step: trace.step, ...traceColumns(trace) } },
      },
    });
  }

  async #end({
    id,
    endedAt,
    reason,
    stats,
    lapCount,
    bestLapSeconds,
  }: EndedSession): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        endedAt: new Date(endedAt),
        endReason: toDbEndReason(reason),
        ...stats,
        lapCount,
        bestLapSeconds,
      },
    });
  }
}
