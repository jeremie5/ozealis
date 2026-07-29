# Ozealis Firmware Rev 2

This folder contains the ESP32 firmware sketch for the Rev 2 firmware line.

## Build with PlatformIO

Use Python 3.12 and PlatformIO Core `6.1.19`, matching CI. From the repository root, create the repository-local environment:

```bash
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv --requirement requirements-ci.txt
```

Then build from the repository root on POSIX systems:

```bash
.venv/bin/python -m platformio run -d "firmware/Rev 2"
```

Flash:

```bash
.venv/bin/python -m platformio run -d "firmware/Rev 2" --target upload
```

Serial monitor:

```bash
.venv/bin/python -m platformio device monitor -d "firmware/Rev 2" --baud 115200
```

On Windows, substitute `.venv\Scripts\python.exe` for `.venv/bin/python`. The top-level `node scripts/verify-local.mjs` command discovers either project-local interpreter automatically.

Default builds compile with `CORE_DEBUG_LEVEL=0`. Project-owned boot and event diagnostics remain, but ESP32 core debug logging, motor-wrapper serial chatter, button serial chatter, accessory-module serial chatter, sensor setup/read-failure chatter, LED pairing-reset chatter, and the old periodic state/pin dump stay off by default. For a noisy bench session, add `-D OZEALIS_SERIAL_STATUS_LOG=1` to local build flags to compile the periodic serial status logger, `-D OZEALIS_MOTOR_SERIAL_LOG=1` for motor wrapper setup/start diagnostics, `-D OZEALIS_BUTTON_SERIAL_LOG=1` for physical-button action diagnostics, `-D OZEALIS_MODULE_SERIAL_LOG=1` for humidifier/heated-hose I2C presence diagnostics, `-D OZEALIS_SENSOR_SERIAL_LOG=1` for LPS22/AHT setup and read-failure diagnostics, and `-D OZEALIS_LED_SERIAL_LOG=1` for LED pairing diagnostics.

`platformio.ini` pins `espressif32@6.13.0`, the ESP32 Arduino framework/toolchain/upload packages used by this build, and the complete current direct/transitive library set (ArduinoJson, the Adafruit sensor/display dependency closure, and CircularBuffer). `requirements-ci.txt` pins the reviewed Python dependency closure for PlatformIO Core `6.1.19`. Host OS tools and the GitHub runner image remain outside that lock boundary.

## Main entry point

```text
ozealis/ozealis.ino
```

## BLE contract

The firmware exposes the project-owned Ozealis BLE service and characteristics documented in:

```text
../../docs/ble-protocol.md
```

Settings are persisted in ESP32 NVS and converted into `PapLimits` at boot through `settingsToPapLimits()`. After `papBegin()`, boot also applies the sanitized saved therapy mode through `papSetMode(settings.mode)` before BLE can accept control writes. Settings writes over BLE require encrypted GATT access, are sanitized, saved, echoed back through the settings characteristic, and applied to the running PAP controller through `papSetLimits()`.

Motor calibration profiles are persisted in the `motorcal` NVS namespace. AutoPAP maps pressure targets through that profile when valid and falls back to an uncalibrated linear command estimate when no profile has been recorded.

At boot, `startBLE()` applies the saved `bleAdv` preference: enabled starts the normal advertising window, while disabled leaves the BLE stack down until the physical triple-press path requests a temporary window. Temporary pairing initializes or restarts advertising without changing the live or persisted boot preference.

Each accepted airflow start creates a fresh PAP session and resets its ramp, pressure integral, measurement, and breath-timing state. Stop, auto-stop, pressure-read loss, shutdown, fault, and OTA busy state zero the command and synchronize the PAP session with the system mode. Final pressure targets in every experimental mode are clamped to the shared 25 cmH2O ceiling.

## Motor driver contract

The active motor abstraction targets an MCF8316D-style code-free sensorless FOC driver. Default firmware wiring is:

| Signal | Default ESP32 pin / value | Purpose |
| --- | ---: | --- |
| `MOTOR_SPEED_PWM_PIN` | GPIO 19 | bench-only 25 kHz speed-command PWM fallback |
| `MCF_DRVOFF_PIN` | GPIO 17 | hard driver output disable |
| `MCF_NFAULT_PIN` | GPIO 26 | active-low driver fault input |
| `MCF_FG_PIN` | GPIO 33 | FG tach input, pulled up to 3.3 V |
| `MCF_I2C_ADDR` | `0x01` | default MCF8316D I2C target address |

The firmware probes `MCF_I2C_ADDR` during motor setup, writes a zero I2C speed command to the MCF8316D `ALGO_DEBUG1` register, and requires readback verification before start or calibration can unlock. If the driver target does not respond or speed-command readback fails, start commands are ignored and the normal `FAULT_IO` path is used. These macros can be overridden in `platformio.ini` build flags for a board revision with different routing.

Default firmware uses the Rev 3 D-variant I2C speed-command path and verifies every volatile speed-command write by reading the command register back. Full motor-parameter and EEPROM write support is still unavailable; `writesAllowed` remains false. The legacy PWM speed-command path is available only for deliberate bench builds compiled with `OZEALIS_MCF8316D_I2C_SPEED=0` and `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1`; do not enable it for normal app-controlled operation.

The checked-in `esp32dev_bench_pwm` PlatformIO environment exists only to prove that bench opt-in path still compiles:

```powershell
python3.12 -m platformio run -e esp32dev_bench_pwm
```

Use the default `esp32dev` environment for normal source-release checks.

Bench validation for this driver contract is tracked in [MCF8316D Bench Bring-Up](../../docs/mcf8316d-bringup.md).

## Physical button behavior

The physical button follows the same state rules as the BLE control surface:

- short press starts only from idle, stops running/startup, and aborts active calibration before shutdown
- short-press start requires the MCF8316D driver to respond on I2C with the fault latch clear
- start, pairing, and settings-reset button actions are ignored while OTA is in progress
- short-press start ignored because a fault is already latched publishes the unchanged BLE mode/fault and calibration-status event path
- triple press starts pairing advertising only while idle; this temporary advertising action does not change the saved boot-advertising setting
- long press clears the `cpap` persisted settings namespace and reboots only while idle; it does not clear retained session/fault logs, motor calibration profiles, MCF8316D EEPROM/configuration, or pressure-sensor trim data

Button-driven start, stop, calibration capture/abort, and temporary pairing actions publish the same BLE mode/fault and calibration-status event path as BLE commands, so a connected app does not have to wait for the next telemetry interval to observe a physical action.

## Fault handling invariant

`triggerFault()` latches the fault code and asserts the dedicated motor hardware-disable path before any pressure, I2C, BLE, logging, or UI work. It then aborts active calibration, enters `MODE_FAULT`, and captures best-effort diagnostics before publishing the BLE fault notification or starting any audible alarm sequence. `stopMotor()` likewise asserts `DRVOFF` before attempting the zero-speed I2C write, so blocking bus retries or beeps cannot leave a previous motor command enabled.

The Arduino main loop/button pass and every BLE callback that touches shared control state, retained snapshots, calibration, settings, motor/sensor evidence, or `Wire` are serialized by one recursive FreeRTOS control mutex initialized before BLE startup. This prevents Bluetooth-task callbacks from interleaving state transitions or I2C transactions with the main motor/sensor loop. The OTA download worker does not touch `Wire` or machine-control objects; only its volatile byte-sized status/progress fields cross that boundary.

Accessory heat commands also fail closed: humidifier readiness requires a complete, bounded, fresh temperature/RH frame; missing or stale temperature prevents water-warmer output and prewarm; and the heated-hose target is zero outside therapy or without fresh bounded temperature telemetry.

The two WS2812 status LEDs are driven by the ESP32 RMT peripheral with explicit waveform timing. State transitions set idle blue, startup yellow, running green, shutdown orange, and fault red; hardware verification remains required.

Filtered VIN below `9.8 V` for more than `200 ms` raises `FAULT_LOW_VIN`. Low-VIN recovery above `10.3 V` clears `FAULT_LOW_VIN`, returns to idle, and publishes the same immediate BLE mode/fault event path, so a connected app can see recovery without waiting for the next telemetry interval.

## Partition layout

The build uses `min_spiffs.csv` to keep two OTA app slots on 4 MB ESP32 flash while allowing the current firmware image to fit. CI builds the firmware and then runs:

```bash
node scripts/check-firmware-size.mjs
```

That script checks the generated `firmware.bin` against the repository flash budget. Run it after a local PlatformIO build when changing firmware dependencies, BLE surfaces, logging, calibration, OTA, or motor-control code.

## Local verification

The firmware builds locally with:

```bash
python3.12 -m platformio run -d "firmware/Rev 2"
```

After building, check the image budget with:

```bash
node scripts/check-firmware-size.mjs
```
