# Forza Horizon 6 "Data Out" reference

**English** · [Русский](fh6-data-out.ru.md)

Everything the project knows about the game's telemetry stream: what the official documentation says, what our recordings confirmed or contradicted, and what is still open.

## Transport

| Property         | Value                                                                                                                                                  | Source                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Protocol         | One-way UDP, the game never reads from the socket                                                                                                      | Official [1]                   |
| Packet size      | 324 bytes, single fixed format (no Sled/Dash choice as in Forza Motorsport)                                                                            | Official [1], recordings [8]   |
| Rate             | Equal to the game's frame rate: 72–86 packets/s were recorded at 75–85 FPS                                                                             | Official [1], recordings [8]   |
| When it is sent  | **Continuously.** The documentation says only while driving; in practice menus, loading, rewinds and results send all-zero packets with `IsRaceOn = 0` | Contradicted by recordings [8] |
| Target           | Any IPv4 address including `127.0.0.1`                                                                                                                 | Official [1], recordings [8]   |
| Ports to avoid   | 5200–5300: the game binds its own outgoing socket in that range                                                                                        | Official [1]                   |
| Byte order       | Little-endian                                                                                                                                          | Recordings [8], parsers [3–5]  |
| In-game settings | Settings → HUD and Gameplay → Data Out, Data Out IP Address, Data Out IP Port                                                                          | Official [1]                   |

Consequences for the code base:

- Rate depends on FPS and jitters (inter-arrival median 11.5–13.5 ms, 95th percentile up to 16.5 ms), so downsampling, aggregation and replay timing are time-based, never packet-count-based.
- A packet with `IsRaceOn = 0` means "game running, not driving". Silence means the game is closed, Data Out is off, or a loading screen is up: gaps of up to 1.1 s were observed while loading.
- `TimestampMS` advances in steps of 15–16 ms (consecutive deltas of 0, 15 or 16) and wraps after about 49.7 days, so it is too coarse for timing. Arrival time is used instead.

## Packet layout

Offsets are derived from the ordered field list in the official documentation [1]. Wheel fields come in groups of four in the order front-left, front-right, rear-left, rear-right.

| Offset  | Group         | Fields                                                                                                                                                                                                     |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–19    | State, engine | `IsRaceOn` S32, `TimestampMS` U32, `EngineMaxRpm`, `EngineIdleRpm`, `CurrentEngineRpm` F32                                                                                                                 |
| 20–67   | Dynamics      | `Acceleration` XYZ, `Velocity` XYZ (car-local: X right, Y up, Z forward), `AngularVelocity` XYZ (rad/s), `Yaw`, `Pitch`, `Roll` (rad)                                                                      |
| 68–211  | Wheels ×4     | `NormalizedSuspensionTravel`, `TireSlipRatio`, `WheelRotationSpeed` (rad/s), `WheelOnRumbleStrip` S32, `WheelInPuddle` S32, `SurfaceRumble`, `TireSlipAngle`, `TireCombinedSlip`, `SuspensionTravelMeters` |
| 212–231 | Car           | `CarOrdinal`, `CarClass` (0 = D … 7 = X, see [car classes](#car-classes)), `CarPerformanceIndex` (100–999), `DrivetrainType` (0 FWD, 1 RWD, 2 AWD), `NumCylinders`                                         |
| 232–243 | Horizon only  | `CarGroup` U32, `SmashableVelDiff` F32 (m/s), `SmashableMass` F32 (kg)                                                                                                                                     |
| 244–311 | Dash          | `Position` XYZ (m), `Speed` (m/s), `Power` (W), `Torque` (N·m), `TireTemp` ×4, `Boost` (psi), `Fuel` (0–1), `DistanceTraveled` (m), `BestLap`, `LastLap`, `CurrentLap`, `CurrentRaceTime` (s)              |
| 312–322 | Race, inputs  | `LapNumber` U16, `RacePosition` U8, `Accel`, `Brake`, `Clutch`, `HandBrake` U8 (0–255), `Gear` U8, `Steer` S8 (−127…127), `NormalizedDrivingLine` S8, `NormalizedAIBrakeDifference` S8                     |
| 323     | —             | One trailing byte, not documented                                                                                                                                                                          |

All fields without an explicit type are F32. The 88 documented fields occupy 323 bytes.

### Compared with other titles

- **Forza Horizon 4 and 5** use the same 324-byte layout. Community parsers treated bytes 232–243 as unknown and skipped them (`data[:232] + data[244:323]` in [3]); FH6 is the first title to document them. The two games cannot be told apart by packet size, so the game is recorded as metadata rather than detected.
- **Forza Motorsport (2023)** "Dash" is 331 bytes [2]: no Horizon block at 232, plus `TireWear` ×4 and `TrackOrdinal` at the end. **FH6 has no tire wear data.**

## Confirmed on recordings

Four sessions recorded on 2026-10-02 (FH6 on Steam, all driving assists on): free roam, a two-lap circuit race with a rewind, a sprint and a car change. 49,811 packets, 37,605 of them while driving [8].

| Question                  | Finding                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TireTemp` unit           | Fahrenheit. Readings span 50–347 and sit at 96–106 when a session starts; 347 °C would be impossible for a road tyre, while 347 °F (175 °C) after drifting is plausible. Not stated officially |
| Rear tyre temperatures    | `TireTempRearLeft` equals `TireTempRearRight` in every driving packet, for all four cars, while front temperatures differ. Most likely a game bug: treat the rear as one axle value            |
| `Acceleration`            | m/s² in car-local axes, gravity excluded: exactly 0 at a standstill, and the change in speed over time matches `AccelerationZ` (ratio 0.91–0.97)                                               |
| `Gear`                    | 0 = reverse (seen while reversing), 1–7 = forward gears, 11 = neutral (single frames during automatic shifts and at a standstill)                                                              |
| `WheelInPuddle`           | Integer flag 0 or 1, as the FH6 documentation says (Forza Motorsport sends a float depth at this offset)                                                                                       |
| `Speed`, `Gear` on screen | Match the in-game HUD: the dashboard showed 162 km/h in 4th gear alongside the game showing the same (S1 711 car, free roam)                                                                   |
| Trailing byte             | Always 0                                                                                                                                                                                       |
| `Fuel`                    | Always 1: Horizon has no fuel consumption                                                                                                                                                      |
| Pause menu in free roam   | Does not interrupt the stream; `IsRaceOn` stays 1                                                                                                                                              |

### Car classes

`CarClass` is an index into the eight Forza Horizon 6 classes. Ranges come from the game's car menus; every car in the recordings falls into the expected class.

| `CarClass` | Class | Performance index |
| ---------- | ----- | ----------------- |
| 0          | D     | 100–400           |
| 1          | C     | 401–500           |
| 2          | B     | 501–600           |
| 3          | A     | 601–700           |
| 4          | S1    | 701–800           |
| 5          | S2    | 801–900           |
| 6          | R     | 901–998           |
| 7          | X     | 999               |

Forza Horizon 5 used different class boundaries, so the label for an index depends on the game the data came from.

### Race lifecycle

Observed in the circuit race and the sprint:

1. **Free roam:** `RacePosition`, `LapNumber`, `CurrentLap` and `DistanceTraveled` are 0. `CurrentRaceTime` counts driving time and keeps counting across menu visits and car changes.
2. **Start:** `IsRaceOn` turns 1 with `CurrentRaceTime` 0 and `RacePosition` set to the grid slot. `DistanceTraveled` starts negative (−112 m, −41 m): the car begins behind the start line.
3. **Crossing the start line** in a circuit race resets `CurrentLap` about 4 s in while `LapNumber` stays 0. Lap timing starts here; this is not a completed lap. In a sprint `CurrentLap` equals `CurrentRaceTime` throughout.
4. **Lap completed:** `LapNumber` increments, and `LastLap` and `BestLap` update on the same packet while `CurrentLap` resets.
5. **Finish:** `LastLap` is not updated for the final lap. `IsRaceOn` drops to 0 and every field is zeroed. The final lap time is the `CurrentLap` of the last driving packet (71.51 s), and the final `DistanceTraveled` (11,902 m) is two lap lengths (5,950 m).
6. **Rewind:** starts exactly like a finish, with zeroed packets for the length of the rewind (3.8 s). Then `IsRaceOn` returns with `CurrentRaceTime` about 2 s earlier (74.61 → 72.66) and the same lap.

Consequences for session and lap detection:

- `RacePosition > 0` tells a race from free roam; a change of `CarOrdinal` starts a new session.
- A lap is complete when `LapNumber` increments. A `CurrentLap` reset without that is the start line.
- The end of a race is only certain when driving does not resume within a timeout, because a rewind looks the same at first. The final lap is then taken from the last `CurrentLap`.

## Still open

| Question                              | What we know                                                                           | How to settle it                              |
| ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| Race abandoned mid-lap                | Should look like a finish with a short final lap                                       | Record a race quit halfway                    |
| Manual gearbox, clutch, rumble strips | All recordings used an automatic gearbox and assists; `WheelOnRumbleStrip` never fired | Record with assists off on a track with kerbs |

## Network setup on Windows

- **Steam:** works with `127.0.0.1` out of the box. No firewall rule is needed for loopback traffic.
- **Microsoft Store / PC Game Pass:** the game is an AppContainer app, and Windows blocks its traffic to loopback by default [6]. Exempt it once from an elevated prompt:

  ```powershell
  # Find the package family name (package names do not contain "Forza")
  Get-AppxPackage | Where-Object Name -match '624F8B84B80|ForteBaseGame' | Select-Object Name, PackageFamilyName

  CheckNetIsolation.exe LoopbackExempt -a -n=<PackageFamilyName>   # add
  CheckNetIsolation.exe LoopbackExempt -s                          # list
  CheckNetIsolation.exe LoopbackExempt -d -n=<PackageFamilyName>   # remove
  ```

  Known names: FH5 `Microsoft.624F8B84B80_8wekyb3d8bbwe` (several independent sources), FH6 `Microsoft.ForteBaseGame_8wekyb3d8bbwe` (community reports only [7]). This path has not been tested by this project.

- **Another machine or an Xbox:** send to the receiver's LAN address and allow the UDP port in the receiver's firewall.

## Sources

1. [Forza Horizon 6 "Data Out" Documentation](https://support.forza.net/hc/en-us/articles/51744149102611-Forza-Horizon-6-Data-Out-Documentation), Playground Games, 2026-05-15
2. [Forza Motorsport "Data Out" Documentation](https://support.forza.net/hc/en-us/articles/21742934024211-Forza-Motorsport-Data-Out-Documentation), Turn 10 Studios, 2023
3. [nettrom/forza_motorsport `fdp.py`](https://github.com/nettrom/forza_motorsport/blob/master/fdp.py), FH4/FH5 handling
4. [TheBanHammer/fh6-tel](https://github.com/TheBanHammer/fh6-tel), `parser.rs` and `session.rs`
5. [Jacobobber/fh6-tuner `telemetry/parser.py`](https://github.com/Jacobobber/fh6-tuner/blob/master/telemetry/parser.py)
6. [Microsoft: how to enable loopback for packaged apps](<https://learn.microsoft.com/en-us/previous-versions/windows/apps/hh780593(v=win.10)>)
7. [SimHub issue #2267](https://github.com/SHWotever/SimHub/issues/2267)
8. Recordings made for this project with `pnpm record` on 2026-10-02; representative packets are kept as test fixtures in [`packages/telemetry-protocol/test/fixtures`](../packages/telemetry-protocol/test/fixtures)

The help-center pages return HTTP 403 to non-browser clients; their text is available through the public Zendesk API, for example `https://support.forza.net/api/v2/help_center/en-us/articles/51744149102611.json`.
