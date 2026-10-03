import { LIVE_COURSE_PATH, type LiveCourse } from '@ft/contracts';
import { Controller, Get, Header, NotFoundException } from '@nestjs/common';

import { TelemetryService } from '../telemetry/telemetry.service.ts';

@Controller()
export class CourseController {
  constructor(private readonly telemetry: TelemetryService) {}

  /** The route of the replayed drive, for the maps. While the game is the source there is none. */
  @Get(LIVE_COURSE_PATH)
  @Header('Cache-Control', 'public, max-age=300')
  course(): LiveCourse {
    const { course } = this.telemetry;
    if (!course) {
      throw new NotFoundException('The route is known only while a recording is replayed');
    }
    return course;
  }
}
