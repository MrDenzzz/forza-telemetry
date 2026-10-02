# Forza Horizon 6 "Data Out" reference

**English** · [Русский](fh6-data-out.ru.md)

Everything the project assumes about the game's telemetry stream, where each fact comes from, and what is still unverified.

## Transport

| Property         | Value                                                                                             | Source                                                |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Protocol         | One-way UDP, the game never reads from the socket                                                 | Official [1]                                          |
| Packet size      | 324 bytes, single fixed format (no Sled/Dash choice as in Forza Motorsport)                       | Official [1]                                          |
| Rate             | "Equal to the game's frame rate", not a fixed 60 Hz                                               | Official [1]                                          |
| When it is sent  | Only while the player is driving: not in menus, pauses, replays, rewinds or after a race finishes | Official [1]                                          |
| Target           | Any IPv4 address including `127.0.0.1`                                                            | Official [1]                                          |
| Ports to avoid   | 5200–5300: the game binds its own outgoing socket in that range                                   | Official [1]                                          |
| Byte order       | Little-endian                                                                                     | Not documented; every known parser reads LE [3][4][5] |
| In-game settings | Settings → HUD and Gameplay → Data Out, Data Out IP Address, Data Out IP Port                     | Official [1]                                          |

Consequences for the code base:

- Rate depends on FPS (30 to 144+ Hz, with jitter), so downsampling, aggregation and replay timing are time-based, never packet-count-based.
- Gaps in the stream are normal (pause, menu, rewind). Silence alone cannot distinguish "in a menu" from "game closed".
- `TimestampMS` is a `U32` that wraps after about 49.7 days, so deltas are computed modulo 2^32.

## Packet layout

Offsets are derived from the ordered field list in the official documentation [1]. Wheel fields come in groups of four in the order front-left, front-right, rear-left, rear-right.

| Offset  | Group         | Fields                                                                                                                                                                                                     |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–19    | State, engine | `IsRaceOn` S32, `TimestampMS` U32, `EngineMaxRpm`, `EngineIdleRpm`, `CurrentEngineRpm` F32                                                                                                                 |
| 20–67   | Dynamics      | `Acceleration` XYZ, `Velocity` XYZ (car-local: X right, Y up, Z forward), `AngularVelocity` XYZ (rad/s), `Yaw`, `Pitch`, `Roll` (rad)                                                                      |
| 68–211  | Wheels ×4     | `NormalizedSuspensionTravel`, `TireSlipRatio`, `WheelRotationSpeed` (rad/s), `WheelOnRumbleStrip` S32, `WheelInPuddle` S32, `SurfaceRumble`, `TireSlipAngle`, `TireCombinedSlip`, `SuspensionTravelMeters` |
| 212–231 | Car           | `CarOrdinal`, `CarClass` (0 = D … 7 = X), `CarPerformanceIndex` (100–999), `DrivetrainType` (0 FWD, 1 RWD, 2 AWD), `NumCylinders`                                                                          |
| 232–243 | Horizon only  | `CarGroup` U32, `SmashableVelDiff` F32 (m/s), `SmashableMass` F32 (kg)                                                                                                                                     |
| 244–311 | Dash          | `Position` XYZ (m), `Speed` (m/s), `Power` (W), `Torque` (N·m), `TireTemp` ×4, `Boost` (psi), `Fuel` (0–1), `DistanceTraveled` (m), `BestLap`, `LastLap`, `CurrentLap`, `CurrentRaceTime` (s)              |
| 312–322 | Race, inputs  | `LapNumber` U16, `RacePosition` U8, `Accel`, `Brake`, `Clutch`, `HandBrake` U8 (0–255), `Gear` U8, `Steer` S8 (−127…127), `NormalizedDrivingLine` S8, `NormalizedAIBrakeDifference` S8                     |
| 323     | —             | One trailing byte, not documented                                                                                                                                                                          |

All fields without an explicit type are F32. The 88 documented fields occupy 323 bytes.

### Compared with other titles

- **Forza Horizon 4 and 5** use the same 324-byte layout. Community parsers treated bytes 232–243 as unknown and skipped them (`data[:232] + data[244:323]` in [3]); FH6 is the first title to document them. The two games cannot be told apart by packet size, so the game is recorded as metadata rather than detected.
- **Forza Motorsport (2023)** "Dash" is 331 bytes [2]: no Horizon block at 232, plus `TireWear` ×4 and `TrackOrdinal` at the end. **FH6 has no tire wear data.**

## Unverified behaviour

Each item is checked against real recordings before the code relies on it.

| Question             | Working hypothesis                                                                             | How to verify                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `TireTemp` unit      | Fahrenheit. Community parsers convert from °F [4][5]; the official page states no unit         | Cold tyres at the start of a session read 70–90      |
| `Acceleration` unit  | m/s²; unknown whether gravity is included                                                      | `AccelerationY` of a stationary car is ≈ 0 or ≈ 9.81 |
| `Gear` encoding      | 0 = reverse, 1…N forward; neutral unknown                                                      | Record reverse and neutral with a manual gearbox     |
| `WheelInPuddle` type | FH6 documents an S32 flag, Forza Motorsport an F32 depth (0–1) at the same offset              | Drive through water: `1` versus `0x3F800000`         |
| Lap completion       | `LastLap` is reportedly not updated for the final lap; a lap ends when `CurrentLap` resets [4] | Three-lap circuit race                               |
| Rewind               | Race time moves backwards after a rewind [4]                                                   | Rewind in the middle of a lap                        |
| Trailing byte        | Always zero                                                                                    | Scan recordings                                      |
| Effective rate       | Equals the rendered FPS                                                                        | Recorder statistics                                  |

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

The help-center pages return HTTP 403 to non-browser clients; their text is available through the public Zendesk API, for example `https://support.forza.net/api/v2/help_center/en-us/articles/51744149102611.json`.
