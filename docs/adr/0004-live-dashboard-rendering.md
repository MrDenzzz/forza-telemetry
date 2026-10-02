# 0004. Live dashboard rendering: external store, primitive selectors, canvas

**English** · [Русский](0004-live-dashboard-rendering.ru.md)

- Status: Accepted
- Date: 2026-10-02

## Context

Dashboards receive a complete frame up to 30 times per second. If every frame became React state near the top of the tree, the whole dashboard would reconcile 30 times per second, and on a phone browser that is visible as dropped frames and battery drain. The charts make it worse: 30 seconds of history is about 900 points per series. The same connection and state logic is needed again in the React Native app.

## Decision

- **A framework-agnostic store** in `@ft/live-client`, shared with the mobile app. It keeps two separate listener sets: one for the connection status, which changes a few times per session, and one for frames.
- **React reads it through `useSyncExternalStore`.** Components that depend only on the status never re-render because of frames. Frame values are read with `useFrameValue(select)`, where `select` returns a primitive that is already rounded for display: whole km/h, revs in 25 rpm steps, tyre temperature in whole degrees. A component re-renders only when the number it shows changes, not when a frame arrives.
- **Canvas for high-frequency graphics.** The g-force circle is drawn imperatively at most once per animation frame. The charts use uPlot, fed from the store's ring buffer with `setData` in `requestAnimationFrame`. React renders these components once.
- **A fixed-size ring buffer** holds the chart history: the window times the maximum frame rate, evicted by time, so appending a frame never allocates.
- **Reconnection** with exponential backoff and jitter; a hello with another protocol version stops retrying and says so.

## Consequences

- Two tests guard the design: status-only components do not re-render when 30 frames arrive (a mutation that wakes status listeners on every frame makes this test fail), and a frame value does not re-render when the shown number does not change.
- Selectors must return primitives or references that are stable between frames; returning a new object would re-render on every frame.
- Canvas content is invisible to assistive technology, so each canvas carries a role and a label, and numeric readouts use labelled groups rather than `<output>`, whose implicit live region would announce every frame.
- uPlot is imported only in the browser, inside an effect, because it touches the DOM at import time.

## Alternatives considered

- **Frames as React state or context.** Simple, but the whole subtree reconciles on every frame.
- **Zustand or Redux with selectors.** Gives the same selective re-rendering, but adds a dependency for about sixty lines of store, which must also work unchanged in React Native.
- **SVG or DOM charts** (Recharts and similar). Every point is a DOM node reconciled by React, which does not hold up at 30 updates per second over hundreds of points.
- **WebGL.** More capability than two line charts and a dot need.
