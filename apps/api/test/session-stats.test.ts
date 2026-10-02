import { describe, expect, it } from 'vitest';

import { GForceFilter, SessionStats } from '../src/sessions/domain/session-stats.ts';

const FRAME_MS = 16;

describe('SessionStats', () => {
  it('integrates driving time and distance from speed', () => {
    const stats = new SessionStats();
    stats.add({ receivedAt: 0, speed: 10, lateralG: 0, longitudinalG: 0 });
    stats.add({ receivedAt: 100, speed: 30, lateralG: 0, longitudinalG: 0 });
    stats.add({ receivedAt: 200, speed: 30, lateralG: 0, longitudinalG: 0 });

    const { drivingSeconds, distanceMeters, maxSpeed } = stats.snapshot();
    expect(drivingSeconds).toBeCloseTo(0.2, 9);
    expect(distanceMeters).toBeCloseTo(5, 9);
    expect(maxSpeed).toBe(30);
  });

  it('leaves pauses and rewinds out of the totals', () => {
    const stats = new SessionStats();
    stats.add({ receivedAt: 0, speed: 20, lateralG: 0, longitudinalG: 0 });
    stats.add({ receivedAt: 4_000, speed: 20, lateralG: 0, longitudinalG: 0 });

    expect(stats.snapshot()).toMatchObject({ drivingSeconds: 0, distanceMeters: 0 });
  });

  it('keeps the peaks of cornering, acceleration and braking separately', () => {
    const stats = new SessionStats();
    stats.add({ receivedAt: 0, speed: 0, lateralG: -1.2, longitudinalG: 0.6 });
    stats.add({ receivedAt: 16, speed: 0, lateralG: 0.9, longitudinalG: -1.4 });

    expect(stats.snapshot()).toMatchObject({
      maxLateralG: 1.2,
      maxAccelerationG: 0.6,
      maxBrakingG: 1.4,
    });
  });
});

describe('GForceFilter', () => {
  it('suppresses a single-frame impact spike', () => {
    const filter = new GForceFilter();
    filter.update(0, 0, 0);

    const { lateral } = filter.update(FRAME_MS, 15, 0);

    expect(lateral).toBeLessThan(1);
  });

  it('follows sustained cornering within a second', () => {
    const filter = new GForceFilter();
    let smoothed = filter.update(0, 0, 0);
    for (let at = FRAME_MS; at <= 1_000; at += FRAME_MS) {
      smoothed = filter.update(at, 1.1, -0.8);
    }

    expect(smoothed.lateral).toBeCloseTo(1.1, 1);
    expect(smoothed.longitudinal).toBeCloseTo(-0.8, 1);
  });

  it('starts over from the current reading after a pause', () => {
    const filter = new GForceFilter();
    filter.update(0, 0, 0);

    expect(filter.update(2_000, 0.7, 0.3)).toEqual({ lateral: 0.7, longitudinal: 0.3 });
  });
});
