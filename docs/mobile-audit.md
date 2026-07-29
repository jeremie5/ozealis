# Mobile Dependency Audit

Last reviewed: 2026-07-29

Command:

```bash
cd mobile
npm run audit:prod
npm run audit:summary
```

Current result: 11 moderate production advisories.

On 2026-07-29, a non-forced `npm audit fix --omit=dev` updated the Expo 56-compatible lockfile and removed the previously reported high-severity `brace-expansion`, `js-yaml`, `postcss`, and `shell-quote` paths. The compatible `expo-dev-client` patch was then aligned to `~56.0.24`. `npm run check:expo` reports the dependency set up to date, and the live high/critical gate below remains clear.

Current `npm run audit:summary` output starts with:

```text
moderate=11 high=0 critical=0 total=11
```

The machine-readable reviewed baseline is [mobile-audit-baseline.json](mobile-audit-baseline.json). It records the exact severity counts plus each affected package's severity, directness, and normalized dependency/advisory path. The summary command fails if the live report adds or removes a package, changes any of those fields, or changes any count; even a reduction requires review before the baseline is rewritten so release evidence never changes silently.

Observed reviewed summary lines included:

```text
- @expo/cli: moderate; via @expo/config, @expo/config-plugins, @expo/inline-modules, @expo/metro-config, @expo/prebuild-config; fix expo@46.0.21 (major)
- @expo/config: moderate; via @expo/config-plugins; fix expo@46.0.21 (major)
- @expo/config-plugins: moderate; via xcode; fix expo@46.0.21 (major)
- @expo/inline-modules: moderate; via @expo/config-plugins; fix expo@46.0.21 (major)
- @expo/local-build-cache-provider: moderate; via @expo/config; fix expo@46.0.21 (major)
- @expo/metro-config: moderate; via @expo/config; fix expo@46.0.21 (major)
- @expo/prebuild-config: moderate; via @expo/config, @expo/config-plugins; fix available
- expo: moderate, direct; via @expo/cli, @expo/config, @expo/config-plugins, @expo/local-build-cache-provider, @expo/metro-config; fix expo@46.0.21 (major)
- expo-sharing: moderate, direct; via @expo/config-plugins; fix expo-sharing@14.0.8 (major)
- uuid: moderate; via GHSA-w5hq-g745-h8pq; fix expo@46.0.21 (major)
- xcode: moderate; via uuid; fix expo@46.0.21 (major)
```

`npm run audit:prod` exits nonzero while advisories remain. `npm run audit:summary` converts the same JSON audit result into a stable review summary and exits successfully only when no high or critical production advisories are present and the normalized report exactly matches the reviewed baseline. It also fails closed if the audit JSON omits severity counters, reports a total that does not match the severity buckets, or the baseline schema is malformed.

Observed advisory area:

- Current advisories are in the Expo SDK developer/configuration/prebuild dependency graph.
- As of the current review, the summary names `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-sharing`, `xcode`, and `uuid`.
- The live `npm audit` renderer may change exact dependency chains as the advisory database changes, so treat the exact package chain as review evidence for the current checkout, not as a stable source contract.
- The `fixAvailable` parent package can also vary between audit runs for the same advisory graph; keep the severity counts, package area, and high/critical gate authoritative over an individual suggested parent package.

Current assessment:

- The affected packages are in the Expo developer/configuration/prebuild toolchain, not the Ozealis BLE protocol, firmware protocol verifier, settings serializer, calibration logic, or runtime pressure-control code.
- `expo-sharing` is used only for local export/share actions in the companion app.
- The `uuid` advisory is through `xcode`, which is part of Expo native project generation tooling.
- Remaining automated advisory fixes propose major-version or SDK-incompatible changes, including `expo@46.0.21` and `expo-sharing@14.0.8`, which are not valid unattended fixes for this Expo 56 app.

Release handling:

- Do not tag a release until this audit has been re-run from a clean checkout and still matches the reviewed baseline.
- Prefer an Expo SDK-compatible upgrade path over `npm audit fix --force`.
- If advisories change, review the live report first, then update both this document and `mobile-audit-baseline.json` with the exact command output summary, affected dependency chain, and why any remaining risk is accepted for the tagged source release.
