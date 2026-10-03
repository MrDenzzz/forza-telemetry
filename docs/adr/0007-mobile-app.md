# 0007. Mobile app: Expo Go, gauges driven by shared values

**English** · [Русский](0007-mobile-app.ru.md)

- Status: Accepted
- Date: 2026-10-03

## Context

The phone is meant to sit next to the screen as a dashboard, in landscape. It should show the same live data as the web dashboard and reconnect on its own. Frames arrive up to 30 times per second, while phone screens refresh at 60 or 120 Hz, so a needle that jumps once per frame looks rough. Anyone trying the project should be able to run the app without building native code. The connection and store logic already exists in `@ft/live-client`.

## Decision

- **Expo SDK 57, run in Expo Go.** Reanimated 4 and Skia 2 ship inside Expo Go, so no native build is needed: `expo start` and a QR code are enough. Native builds remain possible later with `expo prebuild` or EAS.
- **Shared code first.** The app uses `@ft/live-client` for:
  - the connection and its reconnection;
  - the store;
  - status texts, display rules and the g-force geometry, moved there from the web dashboard.

  Metro reads the package's TypeScript sources through the `@ft/source` export condition, like the rest of the monorepo.

- **Two update paths, as on the web** ([ADR 0004](0004-live-dashboard-rendering.md)):
  - **Numbers** come from `useFrameValue` and re-render only when the figure shown changes.
  - **Graphics never re-render.** A frame listener writes Reanimated shared values on the JavaScript thread. The UI thread reads them:
    - Skia draws the rev counter arc (a trimmed path) and the g-force trail (a path rebuilt in a derived value);
    - Reanimated styles scale the pedal and grip bars.
- **Readings glide.** The rev needle and the pedals animate to each new value over about one frame of the stream, so they move continuously at any refresh rate.
- **Landscape on either side.** `app.json` locks landscape, and `expo-screen-orientation` lets the phone turn either way.
- **Battery and resources.**
  - The socket closes in the background and reopens on return.
  - The screen stays on only while the game is being driven.
- **The connection screen guesses the API.** In development `Constants.expoConfig.hostUri` is the computer serving the bundle, and the API usually runs on that same computer. The address is parsed without `URL`, whose React Native implementation has long been partial.
- **Jest for this package.** Expo supports Jest (`jest-expo`) and React Native Testing Library; the rest of the repository uses Vitest. Tests play a scripted stream shared with the web tests (`@ft/live-client/testing`), stub Skia's native module and run Reanimated on the JavaScript thread. CI bundles the app with `expo export` for both platforms.

## Consequences

- The app is pinned to what Expo Go ships for SDK 57: React 19.2 while the web app uses 19.3. pnpm installs both versions side by side.
  - **Metro** gives every package the app's React, since Expo turns on its module resolution in a workspace.
  - **Jest** needs the same done through `moduleNameMapper`.
  - SDK 58, due shortly, moves to React 19.3.
- **Gauge drawing is not covered by tests.** It is checked on a device; the geometry behind it is tested as numbers.
- **Cleartext `ws://` on the local network.** It works in Expo Go. A release build will need `usesCleartextTraffic` on Android and a local network description on iOS, which `app.json` already carries.
- **ESLint uses the shared React preset** rather than `eslint-config-expo`, whose `eslint-plugin-react` does not support ESLint 10.

## Alternatives considered

- **A development build with native code.** It allows any native module, but every reviewer would have to build or install a binary. Nothing here needs more than Expo Go offers.
- **Re-rendering gauges through React state.** This is simpler, but it reconciles the gauge tree 30 times per second on the JavaScript thread, which is the one the WebSocket shares.
- **SVG gauges (react-native-svg).** These are declarative but redrawn through React; animating them takes `createAnimatedComponent` on every shape, and long paths are slower than Skia.
- **Setting shared values without gliding.** This is correct, but the needle visibly steps at 30 Hz on a 120 Hz screen.
