# Ozealis

Ozealis is an open-source, experimental airflow simulation platform inspired by the spirit of projects like OpenAPS: community knowledge, repairability, and access where commercial systems are unavailable or unaffordable.

It is not a medical device. It is not approved by any regulator. It makes no claims about diagnosis, treatment, cure, prevention, safety, reliability, or fitness for use. The repository is provided as-is, with no warranties.

Read [SAFETY.md](SAFETY.md) before building, flashing, testing, or modifying anything.
Report security-sensitive issues through [SECURITY.md](SECURITY.md).
Use [docs/release-checklist.md](docs/release-checklist.md) before tagging any release.

## Project status

Pre-prototype. Hardware, firmware, enclosure, and mobile control surfaces are under active development and require independent validation.

## Mission and design posture

Ozealis is built for concrete open-source pressure and airflow research that is transparent, reproducible, and accessible worldwide, especially where access to conventional equipment, trained support, replacement parts, or funding may be limited. The project should prefer inspectable hardware, commodity components, reproducible calibration steps, offline-friendly documentation, and logs that let builders understand what happened instead of guessing.

That mission does not change the public boundary. Ozealis is not approved equipment, not a replacement for regulated devices where they are available, and not a shortcut around professional review, local law, or independent validation. The engineering posture is to make every subsystem more measurable, conservative, repairable, and failure-aware while keeping claims honest.

## Repository layout

| Path | Purpose |
| --- | --- |
| `firmware/Rev 2/ozealis/` | ESP32 firmware for sensors, motor control, BLE telemetry, logs, settings, faults, and OTA hooks. |
| `hardware/Rev 1/` | PCB project, BoM, interactive BoM, and printable mechanical parts. |
| `mobile/` | React Native companion app for BLE control, telemetry, settings, logs, faults, and OTA commands. |
| `docs/ble-protocol.md` | BLE service and characteristic contract used by firmware and the mobile app. |
| `docs/mobile-app.md` | Mobile app setup and current limitations. |
| `docs/motor-calibration.md` | Experimental bench motor/blower calibration notes. |
| `docs/rev3-motor-driver.md` | MCF8316D Rev 3 motor-driver architecture notes. |
| `docs/mcf8316d-bringup.md` | Bench bring-up checklist for the MCF8316D driver path. |
| `docs/mcf8316d-commissioning.md` | MCF8316D parameter readback/write-gating contract. |
| `docs/mcf8316d-register-manifest.json` | Machine-readable MCF8316D commissioning manifest. |
| `docs/mobile-audit.md` | Current mobile dependency audit review and release handling notes. |
| `docs/release-checklist.md` | Required checks before tagging a source release. |
| `pictures/` | Project images and build references. |

## Current capabilities

- ESP32 firmware with pressure sensing, guarded motor-driver abstraction, fault capture, BLE telemetry, settings persistence, logs, and OTA command plumbing.
- Bluetooth companion app with scan/connect, live telemetry, settings read/write, log/fault export, deterministic Advanced session-report export, manual evidence archiving and neutral same-device comparisons, and OTA command entry.
- Open hardware files, BoM, and 3D-printable enclosure parts.
- Explicit safety and contribution boundaries for open-source collaboration.

## What this project is not

- Not a CPAP, BiPAP, ASV, ventilator, or other approved medical device.
- Not a substitute for professional care.
- Not validated for human use.
- Not guaranteed to be safe, accurate, hygienic, durable, quiet, or reliable.
- Not provided with warranty, support obligations, or liability acceptance.

## Mobile app

The mobile app is in `mobile/`. For a browser layout preview without BLE hardware:

Use Node.js `22.x` for mobile commands; the mobile package declares this engine and CI runs the same major version.

```bash
cd mobile
npm ci --ignore-scripts
npm run check:expo
npm run test:live-evidence
npm run test:session-report
npm run test:graph-downsampling
npm run test:session-archive
npm run typecheck
npm run test:web-export
npm run web
```

There is no `npm run build` script. `npm run test:web-export` is a bundler smoke for browser preview only. Native BLE control requires an Expo development build because `react-native-ble-plx` does not run as a full BLE client in Expo Go or the browser.

Create and install the native development client with `npm run android:dev-build`, or with `npm run ios:dev-build` from macOS for iOS. After that client is installed, `npm run android` / `npm run ios` starts Metro and launches the existing development build.

Advanced Data can export a deterministic `SessionReportV1` JSON artifact from one strict, full-resolution live or retained evidence snapshot. The report binds the exact raw evidence and the derived analysis input separately with SHA-256, preserves FNV-1a transfer metadata, and summarizes cadence, gaps, optional-channel coverage, neutral heuristic output, and explicit limitations. It omits the BLE device ID, app session ID, BLE name, settings, and credentials by default. Device `ms` values are uptime, not wall-clock timestamps, and the hashes provide local artifact integrity rather than device, operator, or measurement authenticity. This experimental report is non-diagnostic and contains no clinical AHI, diagnosis, screening, treatment, efficacy, probability, or confidence output.

Advanced Data also provides a manual, read-only archive for a bounded evidence capture. Each saved entry binds its exact raw CSV, exact selected airflow CSV, retained fault CSV when present, and byte-identical report JSON. A content `archiveId` deduplicates the same owner/source/evidence/report independently of save time, while a separate committed-envelope SHA-256 binds the archive timestamp and all stored metadata. The owner is represented by a domain-separated pseudonymous fingerprint rather than the raw BLE identity, but low-entropy or MAC-shaped identifiers can be dictionary-enumerated by someone with an archive or backup; this remains linkable pseudonymization, not identity protection. The app can compare factual values only between validated captures from the same pseudonymous owner, and suppresses deltas when source windows or heuristic results are not comparable.

Archive restore and save are bounded to 40,000,000 bytes per entry, 256 MiB across recognized committed and pending files, and at most 250 published captures. Valid interrupted `.pending` saves are reverified and recovered; invalid or duplicate pending files are surfaced for explicit removal. A directory-level restore failure blocks new saves instead of presenting an empty archive as ready, and valid entries beyond the published limit remain on disk rather than being silently deleted. These files remain private experimental evidence in app document storage, may be included in platform backups, and do not extend the firmware's 30-minute retained window or the app's 60-minute connected live window into a full-night recorder.

See [docs/mobile-app.md](docs/mobile-app.md).

## Local verification

Install Python 3.12 and the pinned PlatformIO Core `6.1.19` firmware tooling into a repository-local virtual environment. With `uv`, the same commands work on Linux, macOS, and Windows:

```bash
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv --requirement requirements-ci.txt
```

The local source-release gate prefers `.venv/bin/python3.12` on POSIX systems or `.venv\Scripts\python.exe` on Windows, then falls back to an active `python3.12`, `python3`, `python`, or Windows `py -3.12` launcher. Every accepted interpreter must report Python `3.12` and PlatformIO Core `6.1.19`. The gate also requires Node.js `22.x` and includes a clean `npm ci --ignore-scripts` install for the dependency-backed mobile checks:

```bash
node scripts/verify-local.mjs
```

This runs the BLE protocol contract, release text guard, documentation link check, mobile Simple-mode copy check, clean mobile lockfile install, Expo dependency compatibility check, mobile production audit baseline check, mobile validation, evidence-preserving graph downsampling, deterministic session-report, and archive/comparison tests, mobile typecheck, mobile web export smoke, firmware builds, firmware flash-budget check, and repository hygiene check.

## BLE protocol

The firmware currently exposes a BLE service with telemetry, settings, logs, fault CSV, and OTA command/status characteristics. The app consumes that protocol directly.

See [docs/ble-protocol.md](docs/ble-protocol.md).

Important release-hardening note: sensitive BLE characteristics request encrypted, bonded access, but the current hardware pairing model is still OS "Just Works" and is not an app-layer authorization boundary.

## Firmware

Firmware entry point:

```text
firmware/Rev 2/ozealis/ozealis.ino
```

The firmware currently includes:

- Sensor setup and pressure conversion helpers.
- System state and fault handling.
- AutoPAP-style experimental pressure target logic.
- Classical therapy-mode identifiers in firmware/app settings: CPAP, AutoPAP, BiPAP S, BiPAP ST, BiPAP T, ASV, AutoASV, Auto BiPAP, BiPAP PC, and VAPS. BiPAP S currently maps to an experimental bilevel target family. BiPAP ST, BiPAP T, and BiPAP PC add an experimental backup-rate timing overlay that raises the pressure target to IPAP for the configured inspiratory-time window when the backup interval expires; this is not a validated ventilation algorithm. Trigger/cycle controls, servo-adaptation, auto-bilevel adaptation, and volume-assured pressure-support behavior are not implemented or validated yet.
- MCF8316D-style sensorless FOC driver readiness and fault handling.
- BLE telemetry, settings, log, fault, and OTA characteristics.
- Diagnostic and data logging helpers.

Build metadata for PlatformIO is included in `firmware/Rev 2/platformio.ini`. It pins the `espressif32` platform, the ESP32 Arduino framework/toolchain/upload packages used by the build, and the complete current direct/transitive firmware-library set. `requirements-ci.txt` separately pins the reviewed Python dependency closure for PlatformIO Core.

Current motor-driver boundary:

- Default firmware probes the MCF8316D I2C target, uses the Rev 3 D-variant I2C speed-command register with readback verification, and blocks start/calibration unless the command path, I2C target, and fault state are all verified ready.
- MCF8316D FG tach is routed to ESP32 GPIO33 and exported as `motor_fg_hz` / `motorFgHz` in live, retained-session, and fault evidence.
- PWM speed command exists only in the explicit `esp32dev_bench_pwm` PlatformIO environment with `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1` for instrumented bench bring-up.
- Start and calibration are blocked in the mobile app and firmware when the driver is missing, faulted, or the command transport is disabled.

Motor-driver firmware wiring and bench validation are documented in `firmware/Rev 2/README.md`, [docs/rev3-motor-driver.md](docs/rev3-motor-driver.md), and [docs/mcf8316d-bringup.md](docs/mcf8316d-bringup.md).

## Hardware and enclosure

Hardware assets are in `hardware/Rev 1/`:

- PCB project files.
- BoM spreadsheet and interactive BoM.
- Printable `.3mf` enclosure and airflow parts.
- Additional parts notes.

Any build should be instrumented and validated independently before any practical experiment.

## Contributing

Contributions are welcome when they improve reproducibility, safety boundaries, firmware robustness, test coverage, mobile usability, hardware documentation, localization, or accessibility.

Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under Creative Commons Attribution-NonCommercial 4.0 International unless otherwise stated in a specific file.

See [LICENSE.md](LICENSE.md).

## Trademark

Ozealis is a trademark of Shopiro Ltd.
