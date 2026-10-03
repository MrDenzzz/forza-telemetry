# @ft/mobile

**English** · [Русский](README.ru.md)

Expo app that turns a phone into a landscape dashboard for the game: rev counter with speed and gear, throttle and brake, a g-force diagram with a 1.5-second trail, tyre temperatures and grip, and lap times in races. It connects to the API over the local network and keeps reconnecting on its own.

## Running it

You need [Expo Go](https://expo.dev/go) for **SDK 57** on the phone (on iOS, Expo Go asks you to sign in to an Expo account), and the phone on the same Wi-Fi as the computer.

```sh
pnpm --filter @ft/api db:local      # once per session, see the root README
pnpm dev                            # the API on :4000, listening on the LAN by default
pnpm --filter @ft/mobile start      # in another terminal: scan the QR code with Expo Go
pnpm replay <recording> --loop      # without the game
```

The first screen asks for the API address and suggests the computer that serves the app, which usually runs the API too. The address is remembered. **Change** in the status line goes back to it.

If the phone cannot connect:

- **Windows firewall.** Windows asks whether to allow Node.js the first time the API listens; allow it on private networks, or allow TCP port 4000 inbound.
- **Guest or office Wi-Fi.** Some networks isolate their clients, so the phone cannot reach the computer at all.

## How it renders

Frames arrive up to 30 times per second. As on the web ([ADR 0004](../../docs/adr/0004-live-dashboard-rendering.md)), numbers come from `useFrameValue` and re-render only when the figure shown changes. Graphics never re-render: frames are written to Reanimated shared values, which the rev counter and g-force diagram (Skia) and the pedal and grip bars (Reanimated styles) read on the UI thread. The rev needle glides between readings, so it moves smoothly on 60 and 120 Hz screens. Details and alternatives: [ADR 0007](../../docs/adr/0007-mobile-app.md).

Connection, store, status texts, display rules and the g-force geometry come from [`@ft/live-client`](../../packages/live-client/README.md), shared with the web dashboard.

Other behaviour:

- The socket closes when the app goes to the background and reopens when it returns.
- The screen stays on while the game is being driven.
- The gauges dim whenever they show the last frame rather than a live one.
- Either landscape side works.

## Structure

```
src/
  app.tsx            screens: loading the saved address, connecting, the dashboard
  connect/           API address entry, suggestion and storage
  live/              dashboard, gauges, shared-value hooks, rev counter geometry
  theme.ts           the web dashboard's palette
```

Metro reads workspace packages from their TypeScript sources through the `@ft/source` export condition ([metro.config.js](metro.config.js)), as the API's tests and the tools do.

## Tests

Jest with `jest-expo` and React Native Testing Library, the setup Expo supports; the rest of the repository uses Vitest. Tests play a scripted stream from `@ft/live-client/testing`:

- **Behaviour:** connection states, readouts, tyres, lap times, and closing the stream in the background.
- **Address handling:** entry, the suggestion, and storage.
- **Rev counter geometry,** as plain numbers.

Skia's native module is replaced by a stub, and Reanimated runs on the JavaScript thread.

`pnpm --filter @ft/mobile build` bundles the app for Android and iOS with `expo export`. CI runs it, so a module that Metro cannot resolve fails the build.
