# @ft/recorder

**English** · [Русский](README.ru.md)

Records the game's "Data Out" UDP stream to a file, byte for byte, with arrival times. Every datagram is kept, including ones that are not Horizon packets.

```sh
# from the repository root
pnpm record --note "Goliath, 3 laps"
```

In the game: Settings → HUD and Gameplay → Data Out **On**, IP **127.0.0.1**, port **9876**. Microsoft Store builds need a [loopback exemption](../../docs/fh6-data-out.md#network-setup-on-windows).

| Option                  | Default                                | Meaning                                                             |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `--port <number>`       | `9876`                                 | UDP port to listen on; 5200–5300 are refused, the game uses them    |
| `--host <address>`      | `127.0.0.1`                            | `0.0.0.0` accepts packets from a console or another PC              |
| `--out <path>`          | `recordings/<game>-<timestamp>.ftr.gz` | Output file; `.gz` is compressed                                    |
| `--game <fh6\|fh5>`     | `fh6`                                  | Stored as metadata; the packet itself does not tell the games apart |
| `--note <text>`         |                                        | Stored as metadata                                                  |
| `--forward <host:port>` |                                        | Also forward every packet, e.g. to a running API                    |
| `--duration <seconds>`  |                                        | Stop automatically                                                  |

Once a second it prints packets received, the current rate, the share of packets with `IsRaceOn` and the data size. Ctrl+C flushes and closes the file; killing the process instead can truncate a `.gz` file.

`recordings/` is ignored by git. Recordings used as test fixtures are copied into the package that tests them.
