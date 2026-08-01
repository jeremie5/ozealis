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
- Mobile foreground-operation and connection-transition tokens prevent stale or overlapping app callbacks from selecting a replacement device session; paged transfers also stop issuing later page requests after token invalidation. This is local race control only. It does not authenticate an operator, retract a write already handed to BLE, replace firmware interlocks, or make the app a safety boundary.
- Retained and live evidence manifests provide local source binding and integrity checks only. The retained manifest binds transferred generations and hashes to a BLE device ID; the live manifest binds one app connection generation and CSV hash to a device ID. Neither proves device, operator, or measurement authenticity under the current "Just Works" pairing and no-app-authorization design.
- Advanced `SessionReportV1` exports add SHA-256 binding for the exact raw evidence and its derived analysis input while preserving source FNV-1a transfer metadata. These digests detect local artifact changes; they are not signatures and do not establish device, operator, measurement, or report authenticity. The report omits raw BLE device IDs, app session IDs, BLE/device names, settings, OTA URLs, SSIDs/passwords, and other credentials by default, but its timing and optional oxygen, pulse, temperature, or humidity summaries can still be sensitive user data. Device `ms` values are uptime rather than wall-clock timestamps.
- The manual Advanced evidence archive retains the exact raw and selected airflow CSV, a retained fault CSV when present, and the byte-identical report JSON in app document storage. The content `archiveId` is a same-owner/source/evidence/report deduplication identity and intentionally remains the same when only the archive timestamp changes. A separate domain-separated committed-envelope SHA-256 binds that timestamp and the rest of the canonical stored metadata. Both are unkeyed integrity digests rather than signatures, access controls, or proof of origin.
- The archive replaces the raw BLE identity with a domain-separated SHA-256 owner fingerprint and normalizes the live app-session identifier, but this is linkable pseudonymization rather than anonymity or identity protection. Someone who can read an archive or backup can dictionary-enumerate low-entropy or MAC-shaped candidate BLE identifiers against the unkeyed fingerprint. Domain separation prevents the same raw hash from being reused across purposes; it does not add secret entropy.
- Archive mutations are serialized and a save is staged under a random UUID `.pending` filename, read back and verified, moved to the matching `.json` filename, and verified again before publication. Restore accepts only the strict versioned schema, revalidates and recovers complete pending saves, and surfaces invalid or duplicate pending saves for explicit destructive removal. Corrupt, duplicate, and overflow committed entries are not admitted or automatically deleted. An archive-level restore failure leaves storage not ready and blocks new saves instead of publishing a ready-empty archive.
- Archive work is bounded to 40,000,000 bytes per serialized entry, 256 MiB across recognized committed and pending files, and at most 250 published validated captures. The app refuses a new save at the entry or aggregate limit; restore publishes at most 250 and leaves excess valid files on disk. Random filenames, bounds, and fail-closed parsing reduce accidental disclosure, corruption, and resource-exhaustion risk; they do not protect file contents from an actor who can read or rewrite app storage.
- Archive files may be included in operating-system, device-transfer, or account backups; the app does not claim backup exclusion or app-layer archive encryption. On platforms with a share sheet, CSV/JSON exports are staged in cache and the app attempts to delete the temporary file after sharing returns. When sharing is unavailable, the export remains in app document storage by design. Copies handed to another app, backup provider, or recipient are outside Ozealis lifecycle control.
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
