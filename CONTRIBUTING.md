# Contributing to Ozealis

Ozealis is an experimental, open-source airflow research platform. Contributions are welcome, especially when they improve safety, reproducibility, documentation, localization, testability, or accessibility.

## Safety-first contribution rules

- Do not make medical, diagnostic, screening, treatment, cure, prevention, or emergency-use claims.
- Do not present unvalidated behavior as safe, therapeutic, compliant, or production-ready.
- Prefer bounded settings, explicit units, reversible changes, and clear failure states.
- Prefer designs that can be inspected, repaired, calibrated, and documented worldwide, including low-resource settings, without proprietary lab equipment.
- Document test conditions. Include hardware revision, firmware revision, sensor configuration, power supply, and measurement tools when reporting behavior.
- Keep user-facing text clear that this is not an approved medical device and has no warranty.

## Pull request checklist

- The change has a clear purpose and narrow scope.
- Firmware changes build or include exact reasons why they could not be built locally.
- Mobile changes pass `npm run typecheck` from `mobile/`.
- BLE protocol changes update `docs/ble-protocol.md`.
- Hardware changes include revision notes and any relevant BoM/schematic updates.
- Documentation avoids claims that the project treats, diagnoses, screens for, prevents, or cures disease.

## Local mobile app workflow

The companion app uses Expo with native BLE modules, so it requires a development build.

```bash
cd mobile
npm ci --ignore-scripts
npm run typecheck
npm run android:dev-build
```

`npm run android:dev-build` generates, builds, and installs the native Android development client. iOS native builds require macOS and `npm run ios:dev-build`. Once a development client is installed, use `npm run start`, `npm run android`, or `npm run ios` to start Metro and launch that existing client.

## Reporting issues

Please include:

- Hardware revision and firmware revision.
- Mobile app version and phone OS.
- Whether the issue occurs while idle, starting, running, faulted, or updating OTA.
- Relevant serial logs, BLE logs, or exported CSV, with secrets removed.
- Photos or measurement screenshots when helpful.
