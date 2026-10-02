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
