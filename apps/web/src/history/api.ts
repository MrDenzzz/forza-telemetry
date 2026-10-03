import {
  LIVE_COURSE_PATH,
  lapDetailSchema,
  liveCourseSchema,
  sessionDetailSchema,
  sessionPageSchema,
  type LapDetail,
  type ListSessionsQuery,
  type LiveCourse,
  type SessionDetail,
  type SessionPage,
} from '@ft/contracts';
import { z } from 'zod';

import { loadWebConfig } from '@/config';

export class HistoryApiError extends Error {
  override readonly name = 'HistoryApiError';
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

/**
 * The REST resources of the API, read on the server: the history, and the route of a replayed
 * drive. Responses are validated against the shared contracts; a missing resource is null,
 * anything else unexpected throws.
 */
export function createHistoryApi(
  apiUrl: string,
  fetchJson: Fetch = (input, init) => fetch(input, init),
) {
  async function request<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init: RequestInit,
  ): Promise<z.output<Schema> | null> {
    let response: Response;
    try {
      response = await fetchJson(new URL(path, apiUrl), init);
    } catch (error) {
      throw new HistoryApiError(`The API at ${apiUrl} is unreachable`, { cause: error });
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new HistoryApiError(`The API answered ${String(response.status)} to ${path}`);
    }
    const result = schema.safeParse(await response.json());
    if (!result.success) {
      throw new HistoryApiError(
        `The API answered ${path} with an unexpected body:\n${z.prettifyError(result.error)}`,
      );
    }
    return result.data;
  }

  return {
    async sessions({ cursor, limit, kind }: Partial<ListSessionsQuery> = {}): Promise<SessionPage> {
      const query = new URLSearchParams();
      if (cursor !== undefined) query.set('cursor', cursor);
      if (limit !== undefined) query.set('limit', String(limit));
      if (kind !== undefined) query.set('kind', kind);
      const page = await request(`/sessions?${query.toString()}`, sessionPageSchema, {
        cache: 'no-store',
      });
      if (!page) {
        throw new HistoryApiError('The API has no session list');
      }
      return page;
    },

    /** Sessions change while they are in progress, so they are never cached. */
    session: (id: string): Promise<SessionDetail | null> =>
      request(`/sessions/${encodeURIComponent(id)}`, sessionDetailSchema, { cache: 'no-store' }),

    /** A recorded lap never changes, so it is cached for good, as the API allows. */
    lap: (id: string): Promise<LapDetail | null> =>
      request(`/laps/${encodeURIComponent(id)}`, lapDetailSchema, { cache: 'force-cache' }),

    /** The route of the drive the API replays; null while the game is its source. */
    course: (): Promise<LiveCourse | null> =>
      request(LIVE_COURSE_PATH, liveCourseSchema, { cache: 'no-store' }),
  };
}

export const historyApi = createHistoryApi(loadWebConfig(process.env).serverApiUrl);
