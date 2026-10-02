import {
  listSessionsQuerySchema,
  type LapDetail,
  type ListSessionsQuery,
  type SessionDetail,
  type SessionPage,
} from '@ft/contracts';
import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';

import { SessionRepository } from './session-repository.ts';

const idPipe = new ZodValidationPipe(z.uuid());

/** Only what the handler needs from the Express response. */
interface ResponseHeaders {
  setHeader(name: string, value: string): void;
}

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionRepository) {}

  /** Newest first, in pages. */
  @Get('sessions')
  list(
    @Query(new ZodValidationPipe(listSessionsQuerySchema)) query: ListSessionsQuery,
  ): Promise<SessionPage> {
    return this.sessions.listSessions(query);
  }

  @Get('sessions/:id')
  async get(@Param('id', idPipe) id: string): Promise<SessionDetail> {
    const session = await this.sessions.findSession(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} does not exist`);
    }
    return session;
  }

  /** A lap with its trace, for charts and comparison. */
  @Get('laps/:id')
  async getLap(
    @Param('id', idPipe) id: string,
    @Res({ passthrough: true }) response: ResponseHeaders,
  ): Promise<LapDetail> {
    const lap = await this.sessions.findLap(id);
    if (!lap) {
      throw new NotFoundException(`Lap ${id} does not exist`);
    }
    // A recorded lap never changes: a rewind that undoes it deletes it, and the lap driven
    // again gets a new id. Set here rather than with @Header so that a 404 is not cached.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return lap;
  }
}
