# Ozealis BLE Protocol

This document describes the BLE surface currently implemented by `firmware/Rev 2/ozealis/ble.*` and used by the React Native app in `mobile/`.

The protocol is experimental and may change between hardware and firmware revisions.

## Service

| Name | UUID | Notes |
| --- | --- | --- |
| Ozealis service | `7f2d5f4a-0f4d-4a1f-9f84-0c2a6b3d0000` | Project-owned experimental service UUID. |

## Characteristics

All values are UTF-8 strings encoded by the BLE stack. Numeric telemetry is sent as decimal text. Firmware derives pressure delta and mask gauge values only from finite mask and blower pressure reads; incomplete pressure reads emit `NAN`, do not update the ambient estimate, and make the running pressure-control loop drop motor command to zero and reset its pressure controller state.

The firmware reserves enough GATT handles for the complete project service and attaches a Client Characteristic Configuration descriptor (`0x2902`) to every notifying characteristic. Without both pieces, the Arduino-ESP32 default service budget registers only an early prefix of this table and mobile clients cannot subscribe to notification streams. CCCD access for encrypted notification surfaces is itself encrypted.

Arduino-ESP32 dispatches BLE callbacks on a Bluetooth task that is separate from `loop()`. Firmware serializes the complete main control/button pass and every BLE callback that reads or mutates machine state, retained snapshots, calibration, settings, motor/sensor evidence, or the shared `Wire` bus through one recursive FreeRTOS control mutex. That makes each retained-transfer page snapshot atomic relative to new rows/faults and prevents a BLE read or write from interleaving an I2C transaction with pressure, accessory, or motor work. The background OTA worker remains outside that mutex by design: it uses task-local credential copies and Wi-Fi/OTA APIs, and exposes only its volatile byte-sized status/progress state to the guarded control paths.

| Name | Short UUID | Full UUID | Direction | Payload |
| --- | --- | --- | --- | --- |
| Pressure delta | `0001` | `7f2d0001-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | hPa decimal text or `NAN` |
| Flow proxy | `0002` | `7f2d0002-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | hPa decimal text or `NAN` |
| Setpoint | `0003` | `7f2d0003-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | hPa decimal text or `NAN` |
| Input voltage | `0004` | `7f2d0004-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | volts decimal text or `NAN` |
| System mode | `0005` | `7f2d0005-0f4d-4a1f-9f84-0c2a6b3d0000` | read + notify | enum text: `0` idle, `1` startup, `2` running, `3` shutdown, `4` fault |
| Low-flow index, legacy AHI slot | `0006` | `7f2d0006-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | non-diagnostic decimal text or `NAN` |
| OTA command | `0007` | `7f2d0007-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write | JSON: `{"ssid":"...","pwd":"...","url":"http(s)://..."}` |
| OTA status | `0008` | `7f2d0008-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read + notify | `IDLE`, `START`, `n%`, `OK`, or `ERR` |
| Current fault | `0009` | `7f2d0009-0f4d-4a1f-9f84-0c2a6b3d0000` | read + notify | enum text: `0` none, `1` low VIN, `2` sensor, `3` overpressure, `4` I/O |
| Humidifier temperature | `0010` | `7f2d0010-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | Celsius decimal text or `NAN` |
| Humidifier RH | `0011` | `7f2d0011-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | percent decimal text or `NAN` |
| Hose temperature | `0012` | `7f2d0012-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | Celsius decimal text or `NAN` |
| Module status | `0013` | `7f2d0013-0f4d-4a1f-9f84-0c2a6b3d0000` | read + notify | bitfield text: bit 0 humidifier, bit 1 hose, bit 2 oximeter, bit 3 water-warmer prewarm |
| Oximetry status | `0014` | `7f2d0014-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read + notify | JSON status: `present`, `spo2`, `pulse`, `quality`, `source`, `ageMs` |
| Live CSV | `0020` | `7f2d0020-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | `ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c` |
| Session log | `0021` | `7f2d0021-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write | paged session CSV transfer |
| Fault CSV | `0022` | `7f2d0022-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write | paged fault CSV transfer |
| Motor calibration status | `0030` | `7f2d0030-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read + notify | JSON status |
| Motor calibration command | `0031` | `7f2d0031-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write | JSON command |
| MCF8316D parameter snapshot | `0032` | `7f2d0032-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read | read-only commissioning snapshot JSON |
| Control command | `00C0` | `7f2d00c0-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write | JSON command |
| Oximetry relay | `00D0` | `7f2d00d0-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write | JSON sample: `{"spo2":97.5,"pulse":62.0,"quality":0}` |
| Settings | `00F0` | `7f2d00f0-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write | JSON settings |
| Protocol version | `00FF` | `7f2d00ff-0f4d-4a1f-9f84-0c2a6b3d0000` | read | `ozealis-ble-v3` |

The companion app treats this protocol value as a compatibility gate. If a connected device does not report `ozealis-ble-v3`, the app may still allow ordinary read-only inspection, but settings writes, start, calibration, OTA, paged retained-log transfer, log clearing, and driver-fault clearing stay disabled. Version 2 replaced the non-scalable direct `0021`/`0022` characteristic reads from version 1 with the paged transfer described below. Version 3 keeps that transfer and adds an exact `sample_kind` field to every retained-session row so airflow runs and motor-calibration evidence cannot be analyzed as the same signal context.

JSON readbacks for settings, motor calibration status, and the MCF8316D parameter snapshot must be JSON objects. The companion app treats malformed JSON, arrays, primitive JSON values, or `null` as invalid readback instead of deriving readiness from a non-object root. Invalid motor-calibration and MCF8316D snapshots fall back to closed/default display state; an invalid settings readback leaves the currently displayed settings in place, marks them unverified, and keeps settings writes disabled until a complete canonical readback succeeds.

### Mobile foreground operation leases

The companion app serializes foreground Ozealis BLE transactions with one synchronous exclusive operation coordinator. Each token is immutable and bound to the exact `{deviceId, sessionId, operation}` triple. Current-session operation identities cover settings read/write, manual and automatic retained-log reads, retained-log clear, MCF8316D snapshot read, motor-fault clear, OTA write, every start/stop/prewarm control command, and every calibration start/water-start/capture/abort command. The same coordinator reserves `connection:connect` and `connection:disconnect` transition identities. A second operation or connection transition cannot enter while another token is active, including two callbacks that run before React has rendered the busy state.

The app validates both the exact token and the current device session after every `await`, immediately before any state-changing BLE dispatch, and before publishing readback, success, or error state. Paged retained-log transfer also validates before and after every individual GATT request write and response read, so invalidation after one page cannot dispatch the next page. Only the exact active token can release the lease or clear the UI busy state; a stale `finally` from invalidated work cannot release a replacement operation. Starting a new connection generation, beginning disconnect, Bluetooth power loss, telemetry-subscription failure, any connected-session reset, and app unmount invalidate outstanding tokens synchronously; a completed connected-session reset also advances the generation. Bluetooth loss additionally tombstones the exact connection/source transition admission rather than waiting indefinitely for a native promise, while late candidate cleanup skips an in-flight or committed same-device replacement. Unmount additionally nulls the connected identity and advances its generation before asynchronous cancellation, preventing a delayed confirmation from acquiring a new token after teardown. Log-clear, OTA, and water-column-start confirmations capture the device/session that opened the prompt and acquire inside the confirmed callback, so a confirmation retained across reconnect cannot select the replacement device. Scheduled prewarm records its run key only after lease admission and all fresh guards succeed, immediately before the control write is dispatched.

Connect closes the previous committed-session identity and reserves its transition before the first `await`, checks that exact owner after relay drain, device connect, MTU negotiation, discovery, and each bootstrap protocol/settings/driver read, then releases busy only through the token. Disconnect preempts the current foreground token, closes the session identity synchronously, and initiates target cancellation without waiting on a potentially hung relay write. Scanning does not acquire a current-session foreground lease, but Ozealis and oximeter scans share their own synchronous exact admission from before the permission prompt through native scan completion. Cross-kind replacement awaits the native stop promise before installing the new global listener; start is awaited and failures are handled; live manager Bluetooth state is read after the permission await; exact admission plus both transition types are revalidated after every await and immediately before and after native dispatch; callbacks, timeouts, and early cleanup are exact-owner scoped; and callbacks require the expected advertised service UUID to reject a queued event from the previous scan family. Oximeter disconnect/reset also revokes reconnect-scan admission synchronously. Passive telemetry subscriptions and local exports do not acquire a lease. The PLX oximetry relay remains independently serialized and source/target-session scoped. Foreground or transition admission clears queued relay work; foreground operations and Ozealis connection bootstrap wait for any relay write already dispatched to finish, and later relay samples drop while either owner is active. These tokens are an app-local race and object-lifetime rule, not a wire-protocol revision: they do not change UUIDs or payloads, cannot retract a write already accepted by the platform BLE stack, and do not provide app-layer authorization or a firmware safety boundary.

### Retained CSV transfer

Protocol v3 retains the protocol-v2 paged transfer for session and fault CSV on the same encrypted characteristic. A client starts a snapshot by writing `{"offset":0}` to `0021` or `0022`, then reads that characteristic. A successful response is compact JSON:

```json
{"ok":true,"generation":17,"offset":0,"total":18342,"hash":"5f2a3c91","data":"...base64..."}
```

`data` contains at most 288 raw CSV bytes as canonical base64. A full page requires 384 encoded bytes plus the terminating NUL, so firmware gives the base64 encoder the complete 385-byte destination capacity. The client requests each later page with `{"offset":288,"generation":17}`, using the exact next byte offset and generation returned by the first page. Firmware advertises a local ATT MTU of 517 and the Android client requests the same MTU after connecting; a failed MTU upgrade does not falsely mark the whole connection unusable, but a paged transfer may then fail closed if its request or response cannot be carried. Firmware accepts only sequential offsets, caps a snapshot at 512,000 bytes, and keeps each JSON response at or below 500 characters. It rejects malformed schemas, unexpected offsets, changed generations, unavailable states, encoding failures, and oversized sources with `{"ok":false,"error":"reason"}`. Transfer is available only in idle or fault mode with no active calibration or OTA; startup, running, shutdown, calibration, and OTA are rejected so retained evidence cannot change under a download.

The first page snapshots the source generation, byte count, and lowercase eight-hex-digit FNV-1a hash. Firmware stores the 30-minute session window as compact fixed-point typed records in one ring allocated before BLE startup, avoiding both per-row `String` fragmentation and an oversized static BSS allocation. It streams those rows without materializing the complete CSV in heap memory. Every later request must match that generation, and firmware also checks the live source generation before producing the page. The app caps downloads at 512,000 bytes and 2,048 pages, requires the exact response schema and canonical base64, rejects non-ASCII CSV bytes, verifies stable generation/total/hash metadata and exact offsets, then recomputes the FNV-1a hash before exposing or storing the reassembled CSV. Session and fault transfers are accepted into app state only as one validated pair. The app writes both CSV files before a strict manifest containing the BLE device ID, import time, and each file's generation, byte count, and hash; the manifest is the commit marker, and restore rejects the whole pair if either file no longer matches it. Data bound to one device is hidden while a different Ozealis is connected. Firmware resets both transfer cursors and publishes `{"ok":false,"error":"request_required"}` on every BLE connect and disconnect, so even a missed disconnect callback cannot carry a prior client's cursor into a new connection. A reconnect, clear, new retained row, new fault snapshot, malformed response, or integrity mismatch requires a fresh offset-zero transfer.

The MCF8316D snapshot remains read-only until the parameter-register readback layer exists. When volatile I2C speed-command write/readback is verified it may report `state=readback_valid`, `runtimeSpeed=i2c`, `targetSpeed=i2c`, and `commandReady=true` while `writesAllowed=false`. In `register_layer_pending` state it still includes passive commissioning diagnostics: `commandAmp` (`0..255`), `commandPwm` (`0..65535`), and a `pins` object with `speedPwm`, `drvOff`, `nFault`, and `fg` GPIO numbers where `-1` means intentionally disabled. The app treats missing, string, fractional, or out-of-range command and pin fields as unknown/default evidence rather than clamping them into plausible values.

Characteristic `0006` keeps its legacy firmware/app key name for compatibility, but user-facing text must treat it as a non-diagnostic low-flow index rather than a clinical AHI value.

Mobile display parsers treat telemetry enum and optional-module notification values as exact protocol text. System mode and fault must be exact single-character enum values, module status must be an exact decimal bitfield from `0` through `15`, and humidifier/hose readings must be exact unpadded plain-decimal finite numbers or exact uppercase `NAN`; padded, exponent-form, or otherwise malformed notification text is displayed as unknown/not present rather than normalized into valid telemetry.

Bluetooth oximeters are collected by the companion app through the Bluetooth SIG Pulse Oximeter Service `00001822-0000-1000-8000-00805f9b34fb` and PLX Continuous Measurement characteristic `00002a5f-0000-1000-8000-00805f9b34fb`. The app decodes the standard SFLOAT SpO2 and pulse-rate fields with a pure parser covered by `npm run test:plx-oximetry`, bounds them to `50..100` percent and `20..250` bpm, then relays accepted samples to Ozealis through encrypted characteristic `00D0`; standard PLX relay quality is sent as `0` because the app does not infer a confidence score from the flags byte. Oximeter monitor callbacks carry their own device/session token, and relay writes are serialized with only the latest pending sample retained, so a replaced oximeter cannot reset the current source or append a queued stale sample to Ozealis evidence. The firmware also supports a wired I2C oximeter accessory at address `0x46`: register `0x00` returns heartbeat byte `0xA5`, and register `0x01` returns five bytes: centi-percent SpO2, centi-bpm pulse, and `0..255` quality. Fresh wired I2C samples take precedence over BLE-relayed samples. Samples expire after 10 seconds. Oximetry fields are observational data and not diagnostic claims.

## Settings JSON

```json
{
  "pMin": 4,
  "pMax": 15,
  "auto": true,
  "ramp": 300,
  "mode": 1,
  "delta": 4,
  "epr": 3,
  "backupRate": 12,
  "inspTimeMs": 1000,
  "triggerSens": 5,
  "cycleSens": 5,
  "humidifierKind": 0,
  "humidifierTargetRH": 70,
  "humidifierMaxTempC": 45,
  "humidifierPrewarmMinutes": 15,
  "hoseTempDeltaC": 4,
  "bleName": "Ozealis",
  "bleAdv": true
}
```

Mode values:

- `0`: CPAP
- `1`: AutoPAP
- `2`: BiPAP S
- `3`: BiPAP ST
- `4`: BiPAP T
- `5`: ASV
- `6`: AutoASV
- `7`: Auto BiPAP / VAuto-style auto bilevel
- `8`: BiPAP PC
- `9`: VAPS / AVAPS/iVAPS-style volume-assured pressure support

The mode IDs are reserved protocol contracts for the classical positive-airway-pressure families. Current firmware implements fixed CPAP/AutoPAP pressure-target behavior and maps BiPAP S onto an experimental bilevel target family. BiPAP ST/T and BiPAP PC add an experimental backup-rate timing overlay: `backupRate` sets the minimum timed interval, `inspTimeMs` sets the timed IPAP window, ST/PC spontaneous inspiratory flow resets the backup interval, and T mode follows the timed interval without spontaneous reset. These controls are bounded to `4..30` bpm and `300..3000` ms, matching conservative ranges seen in manufacturer ST/T manuals and sleep-center best-practice discussions, but they are not a prescription model, servo-ventilation algorithm, or validated ventilator feature. ASV/AutoASV, Auto BiPAP, and VAPS remain reserved labels mapped onto the same experimental pressure-target logic rather than their named servo, auto-bilevel, or volume-assured algorithms. Trigger/cycle controls, servo-ventilation adaptation, auto-bilevel adaptation, and volume-assured pressure support are not implemented or validated yet. The `mode` field is authoritative; `auto` is retained for older settings clients and is mirrored from AutoPAP/AutoASV/Auto BiPAP mode selection. Legacy settings with `mode=0` and `auto=true` are normalized to explicit AutoPAP. Firmware sanitizes persisted and BLE-written settings before applying them, and the pressure-controller mode setter also clamps out-of-range enum values back to CPAP so future internal callers cannot install an invalid therapy mode. For CPAP mode, firmware treats the effective maximum pressure as `pMin`; other modes keep the configured pressure range available to the pressure-target logic. Every final pressure target, including ASV/AutoASV IPAP, is clamped to the shared 25 cmH2O therapy ceiling. An accepted start begins a fresh PAP session, resets ramp, integral, measured-pressure, and breath-timing state, and immediately arms pressure control; stop, automatic low-flow stop, pressure-read loss, fault, and shutdown zero the command and synchronize the system back to a non-running state. `triggerSens` and `cycleSens` are persisted reserved settings for future spontaneous-bilevel work; current firmware clamps and echoes them but does not use them to cycle pressure transitions.

Humidifier settings are experimental accessory-control fields for the I2C humidifier at address `0x44`. `humidifierKind` is `0` off, `1` ultrasonic, or `2` water warmer. Firmware uses a faster RH PID profile for ultrasonic humidifiers and a slower, rate-limited RH PID profile for water-warming humidifiers; the water-warmer profile also reduces or cuts output as the humidifier temperature approaches `humidifierMaxTempC`. `humidifierTargetRH` is clamped to `30..90` percent RH, `humidifierMaxTempC` to `30..60 C`, `humidifierPrewarmMinutes` to whole minutes `0..60`, and `hoseTempDeltaC` to `0..15 C`. Humidifier output is forced to zero while therapy is not running, while the accessory is absent, while its complete temperature/RH frame is missing, stale, or out of bounds, or when the selected kind is off, except for water-warmer prewarm. Prewarm is started and stopped with encrypted control commands `{"command":"prewarmStart"}` and `{"command":"prewarmStop"}`; `prewarmStart` is accepted only while idle, with fault code `0`, no active calibration or OTA, a currently detected and ready humidifier accessory with fresh bounded temperature/RH telemetry, `humidifierKind=2`, and nonzero `humidifierPrewarmMinutes`. The mobile app verifies prewarm success by rereading module status and requiring bit 3 rather than treating unchanged idle/no-fault mode as success. Prewarm auto-expires after the configured duration and is canceled by therapy start, stop, fault, calibration, OTA, humidifier disconnect, telemetry loss, wrong humidifier type, or timeout. During prewarm the firmware uses a water-warmer temperature-headroom output path rather than RH error and never substitutes synthetic temperature headroom, so missing temperature evidence forces zero output. Heated-hose target output is likewise zero outside therapy and whenever its fresh bounded temperature frame is unavailable. The accessory command frame written starting at humidifier register `0x10` contains target RH centi-percent, kind, output centi-percent, and max temperature centi-C so accessory boards can implement either ultrasonic drive or water-heater power electronics without changing the main firmware loop.

Firmware accepts settings configuration writes only while the system is idle, the reported fault code is `0`, no motor calibration sweep is active, and no OTA task is in progress. Settings writes must be JSON objects; malformed JSON, arrays, strings, numbers, booleans, or `null` roots are ignored. Configuration writes sent while running, faulted, shutting down, starting, calibrating, updating firmware, or with a nonzero fault code are ignored and the current sanitized settings are echoed back on the settings characteristic. The settings characteristic must be a complete canonical JSON object; the mobile app treats malformed JSON, arrays, strings, numbers, booleans, `null`, or partial objects as invalid readback, leaves the currently displayed settings unchanged, marks their readback unverified, and keeps settings writes disabled rather than manufacturing plausible defaults. Numeric settings must be finite JSON numbers; integer settings (`mode`, `epr`, `inspTimeMs`, `triggerSens`, `cycleSens`, `humidifierKind`, and `humidifierPrewarmMinutes`) must be JSON integers rather than fractional values. Boolean settings (`auto` and `bleAdv`) must be JSON booleans. Invalid numeric or boolean values keep the previous sanitized setting before bounds are applied. Pressure settings are clamped to the shared 4-25 cmH2O therapy range; the upper therapy-setting ceiling is intentionally tied to the 25 cmH2O mask overpressure trip constant so firmware and app validation cannot drift. Empty, whitespace-only, or non-string BLE names are ignored, and accepted BLE names are trimmed and sanitized to printable ASCII with quotes, backslashes, and control characters removed before persistence or advertising. On boot, persisted settings are treated as untrusted input; if sanitization changes any loaded value, firmware writes the sanitized settings back to the `cpap` NVS namespace so the same bad stored value is not reloaded on every boot. When `bleAdv=true`, boot initializes the BLE stack and starts the normal advertising window. When it is false, boot remains radio-silent until a physical triple press opens a temporary pairing window; that temporary path initializes BLE without mutating or persisting `bleAdv`.

Special write:

```json
{ "clearLog": 1, "clearFaults": 1, "clearMotorFault": 1 }
```

This requests session log clearing, fault log clearing, or motor-driver fault latch clearing through the settings characteristic. Fields can be sent independently, and each request flag must be the JSON integer `1`; booleans, strings, fractional numbers, and other values are ignored. `clearLog` and `clearFaults` are accepted only while idle, with fault code `0`, no calibration sweep active, and no OTA task in progress, so running or fault evidence is not erased mid-test or while flash is being rewritten. Accepted clears reset the corresponding typed ring buffer and invalidate any transfer snapshot. The companion app then starts fresh paged transfers and treats only both canonical header-only CSV results as a verified clear; each clear readback must be exactly its expected header with at most one final newline and no leading, extra trailing, or whitespace-only lines. For app evidence, empty, malformed, live-format, swapped, foreign, incomplete, or integrity-failed transfers must not erase stored latest-data evidence, and post-clear rows are reported as still present only when they normalize into the expected retained-session or fault readback family. If log-clear flags are sent together with `clearMotorFault` while log clearing is unavailable, firmware ignores only the log-clear flags and still evaluates the motor-fault clear request under its own gate. `clearMotorFault` is accepted only while idle or while the system is in `FAULT_IO`, with no calibration or OTA active; it succeeds only if the MCF8316D responds on I2C, firmware writes the `ALGO_CTRL1` `CLR_FLT` bit, the driver still responds afterward, the speed-command path revalidates by writing and reading back a zero speed command, and `nFAULT` remains deasserted through that command-readiness check. Firmware does not clear its software fault latch on a failed command readback. A write that mixes `clearMotorFault` with normal settings fields treats the fault clear as the only command; firmware echoes the unchanged sanitized settings characteristic instead of applying the mixed configuration fields. When it clears firmware `FAULT_IO`, firmware updates and notifies the mode/fault characteristics immediately after returning to idle. The companion app reports motor-fault clear as verified only when the post-write MCF8316D snapshot shows a present driver with a clear latch and `commandReady=true`, and the fresh firmware mode/fault readback is idle/no-fault. The MCF8316D parameter snapshot includes `fault:true/false` so the app can reread the snapshot and mode/fault characteristics after a clear request and report whether the latch is verified clear or still asserted.

## CSV exports

Live CSV header:

```csv
ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz
```

Current live CSV header:

```csv
ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c
```

Session log header:

```csv
ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c,sample_kind
```

The firmware appends one finite row per second while the system is running or an experimental motor calibration sweep is active. Firmware supplies the row context directly to the typed logger: `sample_kind` is exactly `airflow_run` for normal running evidence or `calibration` for an active motor-calibration sweep. The app validates and preserves both row kinds in the exact transferred artifact, but graphs, elapsed-day summaries, and heuristic airflow windows consume only `airflow_run`; calibration rows remain Builder bench evidence and cannot enter airflow interpretation. A missing, padded, or foreign sample kind invalidates the retained pair.

If a retained-session row would contain non-finite pressure, flow, setpoint, controller-error, or FG tach data, firmware skips that row rather than storing `nan`/`inf` evidence; the retained logger checks `motorFgHz` before formatting the row so the exported tach column follows the same finite-token rule the app enforces. During calibration, where the PAP pressure controller is intentionally inactive, `setpoint_cmH2O` is the current water-column target or automatic-sweep stop target, `flowProxy_hPa` is the fresh blower-minus-mask differential, `error_cmH2O` and `controller_error_cmH2O` are target minus measured pressure, and `controller_amp` is the active calibration motor command. Optional oximetry absence is encoded as `NAN,NAN,0` so missing SpO2 does not invalidate pressure and flow evidence. Optional humidifier and heated-hose environment absence is encoded as `NAN,NAN,NAN`; valid app evidence bounds those fields to `-20..80 C`, `0..100 %RH`, and `-20..80 C`. A row may use `oximeter_source=1` or `2` only when both SpO2 and pulse fields are finite and in range; partial oximetry such as `97.5,NAN,2` or absent oximetry with a nonzero source is not valid app evidence. The datalog helper rejects empty, overlong, or newline-containing rows so one retained-session append cannot inject extra CSV records. The in-RAM session buffer is sized for 30 minutes at 1 Hz, then older rows roll off. `pressure_cmH2O` is the measured mask gauge pressure estimate, `error_cmH2O` is setpoint minus measured pressure, `controller_amp` is the pressure controller command, `motorCmd` is the driver command units sent to the motor abstraction, `motorFault` is `1` when the motor driver fault latch is active, `motorI2c` is `1` when a fresh MCF8316D I2C target probe responds, `motorFgHz` is the latest GPIO33 FG tach frequency estimate, and `oximeter_source` is `0` none, `1` wired I2C, or `2` Bluetooth relay.

When a phone is connected, the live CSV notification is emitted every 100 ms for app-side 10 Hz graph capture when the required numeric graph fields, including FG tach, are finite; incomplete pressure, controller, or FG tach reads skip that live CSV row instead of emitting `NAN` or lowercase formatter tokens into the graph stream. The app keeps a rolling 60-minute in-memory trace and mirrors that latest window to local documents storage so a restart does not erase the most recent connected trace before export. The CSV is committed with a strict live-source manifest containing the exact BLE device ID and app connection generation, app and protocol versions, capture timestamps, first/last device timestamps, row count, byte count, and FNV-1a hash. Restore fails closed if the CSV and manifest disagree. Restored evidence remains exportable but is not attributed to a replacement connection; the first accepted row for a new `{deviceId, sessionId}` starts a new source, and live analysis remains derated until that exact source has at least 10 fresh valid rows.

Slow diagnostic fields such as `motor_i2c` are refreshed from a real target probe once per second and repeated between probes so graphing does not load the I2C bus; `motor_fg_hz` is the cached GPIO33 FG tach frequency estimate. App-side graphing, summaries, row counts, previews, Simple day filtering, Builder environment graphs, and heuristic airflow windows require exact recognized first-line headers, exact unpadded rows and field tokens, bounded finite pressure/flow fields, typed status fields, live rows from startup/running modes only, and strictly increasing timestamps. Core report arithmetic accepts retained setpoint `0..25 cmH2O`, pressure `-25..25 cmH2O`, error fields `-50..50 cmH2O`, and flow proxy `-1000..1000 hPa`; live evidence applies the corresponding `0..25 hPa` setpoint, `-25..25 hPa` pressure, `-1000..1000 hPa` flow, `0..60 V` supply, `-25..25 cmH2O` measured pressure, and `-50..50 cmH2O` error bounds. A retained snapshot with a duplicate or backwards timestamp is rejected atomically and cannot replace the previously committed pair. A retained over-cadence forward gap is allowed between legitimate airflow runs in the exact stored snapshot, while its analysis surfaces select only the latest cadence-consistent `airflow_run` segment. Heuristic airflow analysis additionally caps credited terminal cadence at one second and requires both the overall segment and each candidate window to average at least `0.8` accepted samples per second; sparse evidence is insufficient rather than evidence of no reduced-flow window. For live capture and spool restore, a large backwards timestamp jump or over-cadence forward gap starts a fresh latest trace instead of stitching across a reboot, pause, or stale readback. Plain-decimal numeric fields with leading zeroes, such as `09.81`, are not canonical evidence tokens and are not counted as valid app graph or latest-data rows. Exponent-form numeric fields are also not canonical evidence tokens. Leading blank lines before the CSV header, blank body lines, whitespace-only lines, and extra trailing blank lines are rejected rather than skipped. Live CSV `mode` must be a firmware mode enum integer `0..4`, but live CSV rows count as graph/session evidence only when `mode` is startup `1` or running `2`; live and retained motor command fields must be firmware-range unsigned integers; `motorFgHz` / `motor_fg_hz` must be an unpadded finite decimal from `0` through `100000`; `motorFault`/`motorI2c` or `motor_fault`/`motor_i2c` must be binary `0`/`1` flags; and humidifier or hose environment graph fields must be exact finite values in their bounded ranges or uppercase `NAN`. Optional `NAN` samples render as missing graph gaps rather than minimum values. If Bluetooth is disconnected or the app is not present, only the firmware's 1 Hz retained session buffer continues, so the app derates analysis to that retained trace after connection loss, reconnect, or stop-time import while keeping the last connected live trace exportable.

The Advanced app can build a deterministic `SessionReportV1` from one strict, full-resolution evidence snapshot. A retained report records the paged-transfer generation, total byte count, and FNV-1a metadata, then binds the exact raw retained CSV and the derived latest cadence-consistent `airflow_run` analysis input with separate SHA-256 digests. A live report similarly binds its committed manifest-matched source and derived analysis input. The report records cadence, gaps, estimated missing samples, segment and optional-channel coverage, possible rolling-window truncation, neutral heuristic output, and explicit limitations. Device `ms` is ESP32 uptime and is not a wall-clock session timestamp; app capture or import times are only local anchors. FNV-1a and SHA-256 provide transfer consistency and local artifact binding, not device, operator, or measurement authenticity.

By default the report omits raw BLE device ID, app session ID, BLE/device name, settings, OTA URL, SSID/password fields, and other credentials. Optional oxygen, pulse, environment, and timing summaries can still be sensitive. The report is experimental and non-diagnostic and contains no clinical AHI, diagnosis, screening, treatment, efficacy, probability, or confidence output.

Fault CSV header:

```csv
ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2
```

Fault CSV rows keep exact field counts. Firmware records `sys_mode=4` for captured fault rows so retained fault evidence is unambiguous even when the trip happened from startup, running, calibration, or shutdown context. After firmware has entered `MODE_FAULT`, secondary sensor-health and overpressure checks do not overwrite the active latched fault code; low-VIN recovery remains the explicit exception described below. The analog diagnostic fields from `vin_V` through `flowProxy_hPa` and `motorFgHz` are emitted as finite decimal numbers or uppercase `NAN` if the fault itself prevented a trustworthy reading. The capture helper rejects `fault=0`, forces `sys_mode=4`, normalizes non-finite analog diagnostic fields to uppercase `NAN` on export, and clamps `motorFault`/`motorI2c` to binary flags before storing the row. The firmware also normalizes formatter-produced lowercase `nan` tokens to uppercase before export. Status evidence stays typed: `sys_mode` must be exact fault mode `4`, `fault` must be a nonzero enum integer from `1` through `4`, `motorFault` and `motorI2c` must be binary `0`/`1` flags, `motorFgHz` must be uppercase `NAN` or an unpadded finite decimal from `0` through `100000`, motor command and loop/miss counter fields must be unsigned integers in their firmware-emitted ranges, I2C error fields must be signed 8-bit integers, `-0` is not accepted as a canonical integer token, and `ts_ms` must be strictly increasing. Exponent-form numeric fields are rejected for fault analog fields, counters, motor command, tach, and I2C evidence. Rows outside those bounds are still exportable as raw CSV, but the app does not count or preview them as valid fault evidence.

Filtered VIN below `9.8 V` for more than `200 ms` raises `FAULT_LOW_VIN`. The VIN filter initializes from the first ADC reading instead of a synthetic `0 V` value so boot does not start the low-VIN debounce from an artificial undervoltage. When a low-VIN fault recovers above `10.3 V`, firmware clears `FAULT_LOW_VIN`, returns to idle, and immediately publishes the mode/fault characteristics through the `VIN_RECOVER` BLE event path. Connected clients should still treat the retained fault CSV as evidence that the undervoltage happened, but the live mode/fault readback does not have to wait for the next telemetry interval to show recovery.

## Control command JSON

```json
{ "command": "start" }
```

```json
{ "command": "stop" }
```

Firmware accepts `start` only while the system is idle, the reported fault code is `0`, no motor calibration sweep is active, the speed-command transport is enabled, and the MCF8316D motor driver responds on I2C with no latched driver fault. The mobile app requires the expected protocol version before sending any start or stop control write, and additionally requires the encrypted MCF8316D snapshot to report `commandReady=true` after cross-checking I2C presence, target speed, runtime speed, and an explicit clear driver fault before enabling start; unknown driver-fault telemetry is not treated as ready. If the driver or command transport is not ready, firmware rejects the start and enters the normal `FAULT_IO` path. Even after a start is accepted into `MODE_STARTUP`, firmware only advances to `MODE_RUNNING` if the motor wrapper reports that the driver actually started; a refused start returns to idle and raises `FAULT_IO` instead of publishing a false running state. A `start` command sent while running, faulted, shutting down, starting, calibrating, or with a nonzero fault code is ignored after notifying the unchanged mode/fault characteristics. `stop` aborts any active motor calibration sweep, then requests shutdown. A `stop` command sent while faulted keeps the system in `MODE_FAULT` and only ensures the motor output path remains disabled. Fault transitions enter `MODE_FAULT` before publishing the BLE fault notification, so a fault notification readback should already show fault mode. The mode, fault, and calibration-status characteristics are updated and notified after command-driven transitions; mode and fault remain readable so the app can reread them immediately after a control write and report whether the command was accepted, faulted, or still pending a later notification. Physical button start, stop, calibration capture/abort, and temporary pairing actions use the same mode/fault and calibration-status event publisher so connected clients can observe button actions without waiting for the next telemetry interval; a short-press start ignored because a fault is already latched also publishes the unchanged state through that event path. Temporary pairing advertising is advertising-only: timeout stops unconnected advertising and the pairing LED wave, but does not force the firmware into idle or change therapy/calibration state. If a connected phone disconnects while saved BLE advertising is enabled, firmware starts a new unconnected advertising window and arms the same timeout without changing therapy/calibration state or LED mode. Malformed JSON, non-object JSON roots, missing, empty, or non-string `command`, or unknown control commands are ignored with a serial diagnostic and no state change.

## OTA command JSON

```json
{ "ssid": "...", "pwd": "...", "url": "http(s)://..." }
```

Firmware accepts OTA commands only while the system is idle, the reported fault code is `0`, no motor calibration sweep is active, and water-warmer prewarm is off. The OTA command root must be a JSON object. The `ssid`, `pwd`, and `url` fields must be non-empty JSON strings, and `url` must start with `http://` or `https://`, include a non-empty URL host/authority immediately after the scheme, and contain no leading, trailing, embedded whitespace, or ASCII control characters. After validation, firmware copies the OTA fields, sets status to `START`, and runs the Wi-Fi/download work in a background task so the BLE write can return and the status characteristic remains readable. From `START` through `PROG` and the brief reboot-pending `OK` state, a firmware-wide busy interlock keeps the PAP session and motor disabled, cancels heater prewarm or any impossible calibration overlap, and rejects physical/BLE start, calibration start, settings changes, log clearing, motor-fault clearing, pairing/reset button actions, and another OTA trigger. Commands sent while running, faulted, shutting down, starting, calibrating, prewarming, with a nonzero fault code, malformed JSON, non-object JSON roots, missing or non-string OTA fields, unsupported URL scheme, missing URL host/authority, URL whitespace/control characters, or oversized OTA fields are ignored and OTA status is set to `ERR` unless an OTA task is already in progress. Immediate command-validation errors update and notify the OTA status characteristic with `ERR`; accepted commands and trigger-time validation failures also notify the resulting `START` or `ERR` status before the BLE write handler returns. The characteristic can also be reread after a command write and is notified once per second while connected during background OTA progress. After an OTA failure, a later idle OTA command may retry; `START`, any `n%` progress status including `100%`, and reboot-pending `OK` reject a new OTA trigger. `ERR` releases the interlock for retry, while successful `OK` restarts the controller instead of reopening normal control on the old image.

The OTA trigger clears stale pending OTA buffers before validating a new command. The OTA worker clears the static pending SSID/password/URL buffers after copying them into task-local storage, clears the task-local SSID/password after the Wi-Fi connection attempt, and clears the task-local URL after the OTA call or failed Wi-Fi connection. Pending buffers are also cleared if validation or task creation fails. The mobile app clears its OTA password field after every OTA write attempt and after canceling the final OTA confirmation; on connected-session reset it clears all in-app OTA command fields and returns displayed comfort settings to defaults so stale per-device state cannot carry into a disconnected or newly paired session. This reduces credential lifetime in ordinary RAM but does not make OTA a trusted or hardened update channel.

Current OTA is a bench/source-release convenience path only. It does not perform project-owned signed-image verification or certificate pinning, and plain `http://` URLs are accepted for local lab servers. Use only firmware binaries you built and verified from a trusted local source. A broader hardware release needs a signed update or equivalent authenticity design before OTA is treated as a trusted update channel.

## Motor calibration command JSON

Start a conservative command sweep:

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

Start a manual water-column map:

```json
{
  "command": "waterStart",
  "maxAmp": 220,
  "stepAmp": 1,
  "dwellMs": 1200
}
```

In water-column mode the firmware starts at 4 cmH2O, slowly increases driver command from zero, and waits for the builder to confirm that the physical water column matches the current target. Confirmation can come from a short physical button press or a BLE capture command:

```json
{ "command": "capture" }
```

Each valid capture must sample the no-flow raw blower-minus-mask sensor offset before storing the current driver command for the active whole-centimeter target and advancing from 4 cmH2O through 20 cmH2O. Capture is ignored until the command is nonzero and strictly above the previous captured point, and a failed trim sample leaves the same target pending, backs off command for another dwell window, and does not count a pressure-map point. After the 20 cmH2O point is captured, firmware stores a nonlinear 17-point pressure response map only after the averaged differential sensor trim commits successfully from all 17 no-flow samples, and AutoPAP interpolates between those command points. On boot, the saved water curve, primary valid flag, exact blob, monotonic endpoints, and paired 17-sample sensor trim form one fail-closed profile; invalidating any member invalidates both the curve and the endpoint-derived profile rather than silently falling back to it as a linear calibration. A new water-column run clears and persists the previous response curve and differential trim before collecting the new sample set, so `curveValid` and `sensorTrimStatus` must be checked after completion.

The `minAmp`, `maxAmp`, `stepAmp`, `amp`, and `bestAmp` field names are retained for protocol compatibility; with the MCF8316D motor abstraction they represent bounded driver command units, not direct phase-drive amplitude.

Firmware accepts calibration `start` and `waterStart` only while the system is idle, the reported fault code is `0`, no calibration sweep is already active, the speed-command transport is enabled, and the MCF8316D motor driver responds on I2C with no latched driver fault. Calibration commands must be JSON objects. The mobile app additionally requires the encrypted MCF8316D snapshot to report `commandReady=true` after cross-checking I2C presence, target speed, runtime speed, and an explicit clear driver fault before enabling calibration start. Firmware calibration entry also requires a fresh complete pressure read from both pressure sensors; the debounced runtime `sensorsOK()` grace path is not enough to accept a new calibration start. If the driver, command transport, or fresh pressure read is not ready before or during the sweep, firmware rejects or aborts the sweep and enters the normal `FAULT_IO` path for driver/transport faults or reports calibration `sensor-error` for pressure evidence failures. `capture` is accepted only during an active water-column sweep, and `abort` is accepted only during an active calibration sweep. Valid calibration command-object writes update and notify the calibration-status characteristic immediately after accepted starts, captures, aborts, ignored captures, unavailable start-like writes, or driver-ready rejection. Start-like commands sent while running, faulted, shutting down, starting, calibrating, or with a nonzero fault code are ignored after notifying the unchanged calibration status. Calibration command-unit fields (`minAmp`, `maxAmp`, `stepAmp`, and `dwellMs`) must be JSON integers; `maxPressureCm` must be a finite JSON number and is clamped to the same shared 4-25 cmH2O therapy range as settings. Invalid integer or finite-number values keep the previous command default before bounds are applied. Malformed JSON, non-object JSON roots, missing, empty, or non-string `command`, or unknown calibration commands are ignored with a serial diagnostic, no calibration status notification, and no calibration state change.

Abort an active sweep:

```json
{ "command": "abort" }
```

Calibration status is JSON similar to:

```json
{
  "state": "sweeping",
  "active": true,
  "valid": false,
  "amp": 70,
  "minAmp": 30,
  "maxAmp": 180,
  "gain": 0.0625,
  "maxCm": 0,
  "bestCm": 3.1,
  "bestAmp": 70,
  "mode": "water",
  "targetCm": 6,
  "capturedPoints": 3,
  "curveValid": true,
  "fgHz": 234.5,
  "sensorTrimValid": true,
  "sensorTrimHpa": -0.125,
  "sensorTrimSamples": 17,
  "sensorTrimStatus": "saved"
}
```

`minAmp` and `maxAmp` report the active calibration plan while `active=true`, and the stored profile bounds while no sweep is active, so clients do not display stale stored-profile limits during a new setup run. A successful final water-column capture, and a later boot that loads the same valid profile, report the stable completion tuple `state="water-done"`, `active=false`, `mode="water"`, `capturedPoints=17`, and `curveValid=true`; this lets reconnect and reboot preserve setup-completion evidence. Calibration-status numeric fields must remain finite JSON numbers; firmware reports unavailable or out-of-range gain, pressure, FG, and trim values as bounded `0` values and leaves validity/status fields to indicate whether they are usable. `fgHz` is the same cached GPIO33 MCF8316D FG tach frequency used in session evidence. It is included in calibration status so water-column and automatic sweeps can review whether the driver is physically turning as command rises; the app accepts only finite JSON numbers from `0` through `100000` Hz. The app treats `curveValid` as true only from a non-active status with exactly 17 captured water-column points; active, partial, malformed, or foreign statuses that claim a curve is valid fail closed for app display and setup completion.

## MCF8316D Parameter Snapshot JSON

The `0032` characteristic is encrypted read-only. It is the reserved readback/export surface for MCF8316D commissioning data:

```json
{
  "driver": "MCF8316D",
  "state": "readback_valid",
  "i2c": true,
  "fault": false,
  "i2cAddr": "0x01",
  "runtimeSpeed": "i2c",
  "targetSpeed": "i2c",
  "commandReady": true,
  "writesAllowed": false,
  "benchOnly": false,
  "fgHz": 0.0
}
```

Current firmware does not write MCF8316D parameter or EEPROM registers through BLE. Default builds write volatile runtime speed commands over I2C, using `ALGO_DEBUG1` `OVERRIDE=1` plus `DIGITAL_SPEED_CTRL`, and require same-register readback before the command path is considered ready. While idle with zero command and no driver fault, start/calibration readiness checks and MCF snapshot reads retry a zero-speed command/readback so a driver powered or repaired after boot can recover to `commandReady=true` without reflashing. The `commandReady` field is the firmware-owned readiness summary for motor command availability; mobile clients require an explicit boolean `commandReady=true` and still cross-check driver identity, I2C presence, fault state, target speed, runtime speed, and readback state before enabling start or calibration. A true I2C speed-command path must come from `state=readback_valid`; `register_layer_pending` never unlocks I2C motor actions even if a foreign snapshot claims readiness. Missing or non-boolean `commandReady` fields are treated as not ready. The MCF snapshot keeps `fgHz` as a finite JSON number from `0` through `100000`; unavailable or out-of-range tach evidence is reported as `0` while the readiness booleans and state fields remain authoritative. `benchOnly` is true only when the explicit bench PWM speed-command fallback is compiled in. A PWM speed-command path exists only for explicit bench firmware compiled with `OZEALIS_MCF8316D_I2C_SPEED=0` and `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1`. Future parameter writes must use a separate idle-only commissioning flow with command at zero, `DRVOFF` asserted, no calibration active, readback verification, and no start path available until verification completes.

The sweep is an experimental bench characterization aid. It does not prove safety, performance, acoustic behavior, long-term reliability, or suitability for any motor/blower/load combination. Use independent pressure and current instrumentation and an appropriate test load.

## Security expectations

The firmware configures BLE bonding and encrypted transport for sensitive characteristics. On ESP32 boards without display or keypad hardware, pairing is expected to use the platform BLE "Just Works" flow. That improves accidental/open access but does not provide passkey verification or app-layer authorization.

Characteristics that require encrypted access:

- `0007` OTA command: encrypted write
- `0008` OTA status: encrypted read
- `0021` session log: encrypted read
- `0022` fault CSV: encrypted read
- `0030` motor calibration status: encrypted read
- `0031` motor calibration command: encrypted write
- `0032` MCF8316D parameter snapshot: encrypted read
- `00C0` control command: encrypted write
- `00F0` settings: encrypted read/write

The React Native app relies on Android or iOS to show the pairing prompt when an encrypted read or write requires it.

## Release hardening notes

- Validate BLE bonding and encrypted characteristic behavior on real Android and iOS devices before OTA or settings changes are considered release-ready.
- Add signed-image verification, certificate pinning, or an equivalent documented firmware authenticity design before OTA is treated as a trusted update channel.
- Add app-layer authorization or a documented physical commissioning flow before broader hardware use.
- Keep the protocol characteristic updated when incompatible firmware/app changes are introduced.
