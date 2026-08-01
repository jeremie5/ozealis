# Motor Calibration

Ozealis includes an experimental motor/blower calibration sweep for bench characterization. It is not a safety validation, acoustic validation, hygiene validation, or proof that a motor is appropriate for any use.

Rev 3 motor-driver planning is tracked in [Rev 3 Motor Driver](rev3-motor-driver.md). The active firmware motor abstraction now targets `MCF8316DVRGFR` sensorless FOC control while keeping pressure calibration and independent bench instrumentation requirements.

## What It Does

The firmware steps motor command from a bounded minimum to a bounded maximum, waits at each step, samples mask-side gauge pressure, and stores a simple pressure-to-command profile in ESP32 NVS.

AutoPAP uses the stored profile as feed-forward when available. A bounded pressure feedback controller then applies a small PI correction and slew-limits motor command changes. If no profile is stored, firmware falls back to an uncalibrated linear estimate as feed-forward and still applies the bounded feedback layer. If the running pressure-control loop cannot obtain a fresh two-sensor pressure read, it drops motor command to zero and resets the pressure controller rather than continuing on stale command state.

## Before Running

- Use a bench test load, not a person.
- Use independent pressure and current instrumentation.
- Keep power, wiring, motor driver temperature, and airflow path visible.
- Stop immediately for unexpected noise, heat, smell, vibration, current draw, pressure, or driver fault behavior.

## Default Sweep

```json
{
  "command": "start",
  "minAmp": 30,
  "maxAmp": 180,
  "stepAmp": 10,
  "dwellMs": 5000,
  "maxPressureCm": 18
}
```

The mobile app sends these defaults from the Calibration tab. Firmware clamps incoming values before use, including out-of-range values sent by external BLE clients.

Firmware accepts calibration start-like commands only while the system is idle, the reported fault code is `0`, no calibration sweep is already active, the speed-command transport is enabled, and the MCF8316D driver reports I2C present with no latched fault. The calibration module also checks command readiness before entering automatic or water-column calibration and re-checks command readiness when servicing an active sweep, so future firmware entry points cannot bypass the motor-driver and speed-command precondition. Calibration entry requires a fresh complete pressure read from both LPS22 sensors rather than the debounced runtime `sensorsOK()` grace path, so a stale or one-sided cached pressure sample cannot start setup. Automatic sweep service also stops the motor and marks calibration `sensor-error` if a pressure sample or ambient estimate cannot be read for the dwell window instead of continuing to raise command with no pressure evidence. `capture` is only meaningful during an active water-column sweep, and `abort` is only meaningful during an active calibration sweep. A stop command, driver or command-transport readiness failure, pressure-acquisition failure, or any firmware fault aborts an active calibration sweep.

During an active sweep, firmware appends a retained session CSV row once per second with exact `sample_kind=calibration` so the mobile app can export the pressure response, controller command, driver command, driver fault latch, driver I2C probe trace, and `motorFgHz` FG tach trace without treating it as an airflow-run sample. Because the PAP controller is inactive during calibration, the row uses the current water-column target or automatic-sweep stop target as its setpoint, the fresh blower-minus-mask differential as flow proxy, target minus measured pressure as both error fields, and the active calibration motor command as `controller_amp`. The app preserves these rows as Builder bench evidence but excludes them from airflow graphs, summaries, day filtering, and heuristic airflow windows. This keeps the required evidence finite instead of silently dropping every calibration row because idle PAP getters are unavailable or misclassifying it as a running trace. The in-RAM session buffer keeps 30 minutes of 1 Hz rows before older rows roll off.

## Water-Column Map

The second calibration mode is a manual water-column map for builders who have a literal water column and no calibrated pressure rig. Start it with the mobile app Water column action or BLE `{"command":"waterStart"}` while idle and bench-instrumented.

Minimum viable setup:

- Make a U with clear CPAP tubing and tape it securely to a vertical surface.
- Add water to the tube while keeping the machine at least 5 cm above the water level.
- Use a 20 cm or longer ruler.
- Put the ruler zero mark at the resting waterline on the vertical tube leg opposite the machine.
- Glue, tape, or clamp the ruler so it cannot move during the procedure.
- Keep the tube, ruler, machine, wiring, and power supply stable before starting.

Firmware starts at the 4 cmH2O target with zero driver command, then increases command slowly. The mobile app shows a 4-20 cmH2O capture ladder using `targetCm` and `capturedPoints` so the operator can see captured, current, and pending ruler marks. When the physical water column reaches the requested target, press the device button or send BLE `{"command":"capture"}`. Firmware ignores capture until the command is nonzero and strictly above the previous captured point. A valid capture is atomic: firmware must sample the no-flow raw blower-minus-mask sensor offset before saving the current driver command for that target or advancing to the next ruler mark. If the trim sample cannot be captured, the point is not counted, command backs off for another dwell window, and the operator must retry at the same mark after the sensor read is healthy.

After the 20 cmH2O point is captured, firmware stores the 17-point nonlinear map only after the averaged differential pressure sensor trim commits successfully from all 17 no-flow trim samples, and `motorCalDutyForCm()` interpolates between saved command points. Completion and later reboot both preserve the exact water-column completion status: `state=water-done`, inactive, `mode=water`, 17 captured points, and a valid curve. Normal pressure reads subtract the persisted trim from the blower-side sensor before calculating the differential/flow proxy. A new water-column run clears and persists the previous response curve and differential trim before collecting the new sample set, so an aborted or failed rerun cannot keep advertising the old curve as current setup evidence. Calibration status reports `sensorTrimStatus` as `saved`, `pending`, `too-few-samples`, `invalid-offset`, or `not-saved`, and keeps numeric JSON fields finite even when tach, trim, pressure, or gain evidence is unavailable. Trim samples, committed trim, and loaded persisted trim are rejected when the absolute blower-minus-mask offset is above the shared 25 hPa sensor-trim sanity bound. Stop, driver-readiness failure, sensor fault, overpressure fault, trim capture failure, trim commit failure, or abort exits without completing a new curve or trim update.

On boot, persisted motor calibration is treated as untrusted input. Firmware rejects non-finite gains or pressure limits, a false primary profile-valid flag, partial curve blobs, non-increasing water-column command maps, curve endpoints that disagree with the saved min/max command, and differential sensor trims that do not have all 17 committed samples. If any member of the paired curve-and-trim evidence is invalid, firmware rejects the whole saved water profile instead of retaining its endpoint-derived values as a fallback linear profile. When a persisted motor calibration profile is rejected or its curve map is invalidated, firmware writes the sanitized profile back to NVS with validity cleared so the same bad stored blob is not reaccepted for review on every boot. When a persisted differential sensor trim is rejected, firmware writes `diffValid=false`, `diffTrim=0`, and `diffSamples=0` back to the `sensorcal` namespace.

## Stored Profile

Firmware stores:

- minimum effective command
- maximum tested command
- observed maximum pressure
- retained `motorFgHz` trace for tach sanity review during the run
- approximate cmH2O-per-command-unit gain

The profile is a first-order mapping only. It does not model flow-dependent pressure curves, acoustic behavior, motor heating, supply sag, hose resistance, leaks, or long-term drift.

## Runtime Pressure Control

The runtime controller is intentionally conservative:

- target pressure maps to a starting motor command through calibration
- measured mask pressure corrects that command with bounded feedback
- the correction integral is clamped
- command increases and decreases are slew-limited per loop

This is meant to reduce abrupt motor changes across varied assemblies. It still requires bench tuning and independent instrumentation before any broader hardware claim.
