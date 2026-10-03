'use client';

import { demoTrackSchema, type DemoTrack } from '@ft/contracts';
import { LiveStore, lapTime } from '@ft/live-client';
import { LiveStoreProvider } from '@ft/live-client/react';
import { useEffect, useRef, useState } from 'react';

import { CHART_WINDOW_SECONDS } from '@/dashboard/charts';
import { GForce } from '@/dashboard/g-force';
import { Inputs } from '@/dashboard/inputs';
import { Race } from '@/dashboard/race';
import { RouteMap } from '@/dashboard/route-map';
import { RouteTrace } from '@/dashboard/route-trace';
import { Speedometer } from '@/dashboard/speedometer';
import { StatusBar } from '@/dashboard/status-bar';

import styles from './demo-player.module.css';
import { VideoTelemetry } from './video-telemetry';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path
        d={muted ? 'M16 9l5 6M21 9l-5 6' : 'M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** `m:ss` for the scrubber. */
const clock = (seconds: number): string => lapTime(Math.max(0.001, seconds)).slice(0, -4);

function DemoStage({ track, mediaUrl }: { track: DemoTrack; mediaUrl: string }) {
  const [telemetry] = useState(() => new VideoTelemetry(track));
  const [course] = useState(() => RouteTrace.of(track.frames.map(([, frame]) => frame)));
  const [store] = useState(
    () =>
      new LiveStore({
        url: 'demo:track',
        createSocket: telemetry.createSocket,
        historySeconds: CHART_WINDOW_SECONDS,
      }),
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(true);
  // Browsers start a video by themselves only while it is muted; the sound is the viewer's choice.
  const [muted, setMuted] = useState(true);

  // The video is the clock: each animation frame hands the telemetry its current time. The
  // scrubber and the time follow through the DOM, so playback re-renders nothing.
  useEffect(() => {
    let request = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        telemetry.sync(video.currentTime, () => {
          store.history.clear();
        });
        if (scrubberRef.current && document.activeElement !== scrubberRef.current) {
          scrubberRef.current.value = String(video.currentTime);
        }
        if (timeRef.current) {
          timeRef.current.textContent = clock(video.currentTime);
        }
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
    };
  }, [telemetry, store]);

  return (
    <LiveStoreProvider store={store}>
      <div className={styles.theater}>
        <div className={styles.stage}>
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={`${mediaUrl}/demo-poster.jpg`}
            aria-label="Gameplay captured together with the telemetry"
            onPlay={() => {
              setPlaying(true);
            }}
            onPause={() => {
              setPlaying(false);
            }}
            onVolumeChange={(event) => {
              setMuted(event.currentTarget.muted);
            }}
          >
            {/* The full codec string (Main profile, level 4.1, 10-bit), as browsers turn down a bare
              "av01" and would fall back to the H.264 copy. It must match how the file is encoded. */}
            <source
              src={`${mediaUrl}/demo-1080p60.av1.webm`}
              type='video/webm; codecs="av01.0.09M.10"'
            />
            <source src={`${mediaUrl}/demo-720p60.h264.mp4`} type="video/mp4" />
          </video>
          <div className={styles.overlay}>
            <div className={styles.top}>
              <StatusBar title="Demo" />
            </div>
            <div className={styles.left}>
              <Speedometer />
              <Inputs />
              <Race />
            </div>
            <div className={styles.right}>
              <GForce />
              <RouteMap outline={course} />
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  const video = videoRef.current;
                  if (video?.paused) {
                    void video.play();
                  } else {
                    video?.pause();
                  }
                }}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <input
                ref={scrubberRef}
                className={styles.scrubber}
                type="range"
                min={0}
                max={track.durationSeconds}
                step={0.1}
                defaultValue={0}
                aria-label="Position in the recording"
                onInput={(event) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Number(event.currentTarget.value);
                  }
                }}
              />
              <span ref={timeRef} className={styles.time}>
                0:00
              </span>
              <span className={styles.duration}>/ {clock(track.durationSeconds)}</span>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !videoRef.current.muted;
                  }
                }}
                aria-label="Sound"
                aria-pressed={!muted}
              >
                <SpeakerIcon muted={muted} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </LiveStoreProvider>
  );
}

/** Loads the telemetry track, then plays it over the video it was recorded with. */
export function DemoPlayer({ mediaUrl }: { mediaUrl: string }) {
  const [track, setTrack] = useState<DemoTrack | 'loading' | 'unavailable'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${mediaUrl}/track.json`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((json: unknown) => {
        setTrack(demoTrackSchema.parse(json));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTrack('unavailable');
        }
      });
    return () => {
      controller.abort();
    };
  }, [mediaUrl]);

  if (track === 'loading') {
    return <p className={styles.message}>Loading the recorded race…</p>;
  }
  if (track === 'unavailable') {
    return (
      <p className={styles.message}>
        The demo recording is not available here. Live and History work with the game or a replayed
        recording.
      </p>
    );
  }
  return <DemoStage track={track} mediaUrl={mediaUrl} />;
}
