# Security Policy

Ozealis is experimental and not a medical device. Security issues can still create serious risk in any connected hardware project, so please report them carefully.

## Supported versions

No stable release is supported yet. The repository is pre-prototype.

## What to report

Please report issues involving:

- Unauthorized BLE settings writes.
- OTA update tampering or unsafe update behavior.
- Secrets exposed in logs, builds, or examples.
- Firmware behavior that can bypass fault handling.
- Mobile app behavior that writes unintended settings.
- Documentation that encourages unsafe deployment or overstates security.

## Current known security limitations

- Firmware requests BLE bonding and encrypted GATT access for settings, control/start-stop, OTA command/status, session and fault logs, motor-calibration status/command, and MCF8316D parameter snapshots, but this has not been validated on hardware across Android and iOS.
- Current ESP32 boards are expected to pair with the operating system "Just Works" flow, which does not provide passkey verification.
- There is no app-layer authorization, rotating key, or documented physical commissioning flow yet.
- OTA payload authenticity depends on the firmware update source and transport path. Firmware currently accepts `http://` and `https://` OTA URLs and does not perform project-owned signed-image verification or certificate pinning.
- OTA credentials are still handled as sensitive RAM data: the app clears the in-app password field after each write attempt and after canceling the final OTA confirmation, clears all in-app OTA command fields on device-session reset, OTA write exceptions use fixed failure copy instead of displaying raw exception text near credentials, and firmware clears stale pending OTA buffers, pending credential buffers, task-local SSID/password, and task-local URL after ordinary handoff, Wi-Fi failure, or OTA completion. This reduces credential lifetime in ordinary RAM, but does not make OTA a trusted or hardened update channel.
- The mobile app is a control surface, not a safety boundary.
- `npm audit --omit=dev` currently reports moderate advisories in the Expo SDK configuration/prebuild dependency graph; suggested forced fixes can cross SDK major versions and should not be applied blindly.

These are known release blockers, not acceptable production behavior.

## Reporting

Open a GitHub issue for non-sensitive security hardening work.

For sensitive reports, contact the repository maintainer privately before publishing details. Do not include secrets, exploit payloads, private keys, or customer/user data in public issues.

## Disclosure expectations

Please give maintainers a reasonable opportunity to understand and patch sensitive issues before public disclosure.
