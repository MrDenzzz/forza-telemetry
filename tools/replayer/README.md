# @ft/replayer

**English** · [Русский](README.ru.md)

Sends a recording over UDP with its original timing, so everything downstream behaves as if the game were running.

```sh
# from the repository root
pnpm replay recordings/fh6-2026-10-02T14-44-40.ftr.gz --loop
```

| Option             | Default     | Meaning                                  |
| ------------------ | ----------- | ---------------------------------------- |
| `--host <address>` | `127.0.0.1` | Destination address                      |
| `--port <number>`  | `9876`      | Destination port                         |
| `--speed <number>` | `1`         | Playback rate, e.g. `2` for double speed |
| `--loop`           |             | Start over at the end until Ctrl+C       |

Timing comes from `replay()` in [`@ft/recording`](../../packages/recording/README.md): due times are measured from the start of each pass, so Windows timer granularity does not accumulate into drift.

## Trimming a recording

`pnpm trim` copies a stretch of a recording into a new file, timed from zero, with its start time moved to match. The hosted demo's drive was cut this way, from the recording made with the demo video:

```sh
pnpm trim recordings/fh6-2026-10-03T09-58-24.ftr.gz deploy/demo/hokubu-race.ftr.gz \
  --from 18 --to 214 --note "Demo: Hokubu circuit, 3 laps, Dodge Viper ACR"
```

`--from` and `--to` are seconds into the recording; `--note` replaces its note. The work is done by `trimRecording()` in [`@ft/recording`](../../packages/recording/README.md).
