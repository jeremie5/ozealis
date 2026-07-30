import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const gitAttributes = readFileSync(resolve(root, ".gitattributes"), "utf8");
const generatedPaths = [
  ".expo-web-preview.err.log",
  ".expo-web-preview.out.log",
  ".venv",
  "firmware/Rev 2/.pio",
  "mobile/node_modules",
  "mobile/.expo",
  "mobile/.expo-web-smoke",
  "mobile/.expo-shared",
  "mobile/android",
  "mobile/ios",
  "mobile/web-build",
  "mobile/dist",
  ".env",
  ".env.local",
  "dist",
  "build",
];
const allowedRootDirectories = [
  ".git",
  ".github",
  "docs",
  "firmware",
  "hardware",
  "mobile",
  "pictures",
  "scripts",
];
const requiredHardwareArtifacts = [
  "hardware/Rev 1/BOM_Board1_Schematic1_2025-11-20.xlsx",
  "hardware/Rev 1/InteractiveBOM_PCB1_2025-7-8.html",
  "hardware/Rev 1/Other parts.txt",
  "hardware/Rev 1/PCB/ProPrj_Ozealis_2025-07-08.epro",
  "hardware/Rev 1/Parts/Base.3mf",
  "hardware/Rev 1/Parts/BaseStiffener.3mf",
  "hardware/Rev 1/Parts/Body.3mf",
  "hardware/Rev 1/Parts/Button.3mf",
  "hardware/Rev 1/Parts/HoseConnector.3mf",
  "hardware/Rev 1/Parts/Inlet.3mf",
  "hardware/Rev 1/Parts/InletMesh.3mf",
  "hardware/Rev 1/Parts/InletResonator1.3mf",
  "hardware/Rev 1/Parts/InletResonator2.3mf",
  "hardware/Rev 1/Parts/PumpOutlet.3mf",
];
const requiredSourceReleaseArtifacts = [
  ".gitattributes",
  ".github/workflows/ci.yml",
  ".gitignore",
  "CONTRIBUTING.md",
  "instructions.md",
  "LICENSE.md",
  "README.md",
  "requirements-ci.txt",
  "SAFETY.md",
  "SECURITY.md",
  "docs/ble-protocol.md",
  "docs/mcf8316d-bringup.md",
  "docs/mcf8316d-commissioning.md",
  "docs/mcf8316d-register-manifest.json",
  "docs/mobile-app.md",
  "docs/mobile-audit.md",
  "docs/mobile-audit-baseline.json",
  "docs/motor-calibration.md",
  "docs/release-checklist.md",
  "docs/rev3-motor-driver.md",
  "firmware/Rev 2/README.md",
  "firmware/Rev 2/platformio.ini",
  "firmware/Rev 2/min_spiffs.csv",
  "firmware/Rev 2/ozealis/autopap.cpp",
  "firmware/Rev 2/ozealis/autopap.h",
  "firmware/Rev 2/ozealis/ble.cpp",
  "firmware/Rev 2/ozealis/ble.h",
  "firmware/Rev 2/ozealis/button.cpp",
  "firmware/Rev 2/ozealis/button.h",
  "firmware/Rev 2/ozealis/buzzer.cpp",
  "firmware/Rev 2/ozealis/buzzer.h",
  "firmware/Rev 2/ozealis/datalog.cpp",
  "firmware/Rev 2/ozealis/datalog.h",
  "firmware/Rev 2/ozealis/diag.cpp",
  "firmware/Rev 2/ozealis/diag.h",
  "firmware/Rev 2/ozealis/led.cpp",
  "firmware/Rev 2/ozealis/led.h",
  "firmware/Rev 2/ozealis/logic.cpp",
  "firmware/Rev 2/ozealis/logic.h",
  "firmware/Rev 2/ozealis/modules.cpp",
  "firmware/Rev 2/ozealis/modules.h",
  "firmware/Rev 2/ozealis/motor.cpp",
  "firmware/Rev 2/ozealis/motor.h",
  "firmware/Rev 2/ozealis/motor_calibration.cpp",
  "firmware/Rev 2/ozealis/motor_calibration.h",
  "firmware/Rev 2/ozealis/ota_secure.cpp",
  "firmware/Rev 2/ozealis/ota_secure.h",
  "firmware/Rev 2/ozealis/ozealis.ino",
  "firmware/Rev 2/ozealis/oximetry.cpp",
  "firmware/Rev 2/ozealis/oximetry.h",
  "firmware/Rev 2/ozealis/pressure_limits.h",
  "firmware/Rev 2/ozealis/sensor.cpp",
  "firmware/Rev 2/ozealis/sensor.h",
  "mobile/.gitignore",
  "mobile/app.json",
  "mobile/App.tsx",
  "mobile/index.ts",
  "mobile/package.json",
  "mobile/package-lock.json",
  "mobile/tsconfig.json",
  "mobile/assets/android-icon-background.png",
  "mobile/assets/android-icon-foreground.png",
  "mobile/assets/android-icon-monochrome.png",
  "mobile/assets/favicon.png",
  "mobile/assets/icon.png",
  "mobile/assets/splash-icon.png",
  "mobile/src/csvTransfer.ts",
  "mobile/src/operationLease.ts",
  "mobile/src/ozealisBle.ts",
  "mobile/src/plxOximetry.ts",
  "mobile/src/validation.ts",
  "pictures/body.png",
  "pictures/muffler.png",
  "pictures/pcb.png",
  "scripts/check-firmware-size.mjs",
  "scripts/summarize-mobile-audit.mjs",
  "scripts/test-mobile-csv-transfer.mjs",
  "scripts/test-mobile-operation-lease.mjs",
  "scripts/test-mobile-plx-oximetry.mjs",
  "scripts/test-mobile-validation.mjs",
  "scripts/verify-doc-links.mjs",
  "scripts/verify-local.mjs",
  "scripts/verify-mobile-web-export.mjs",
  "scripts/verify-mobile-simple-copy.mjs",
  "scripts/verify-protocol.mjs",
  "scripts/verify-release-text.mjs",
  "scripts/verify-repo-hygiene.mjs",
];
const requiredGitignoreFragments = [
  "*.log",
  ".venv/",
  ".pio/",
  "node_modules/",
  "mobile/.expo/",
  "mobile/.expo-web-smoke/",
  "mobile/android/",
  "mobile/ios/",
  ".env",
  "!.env.example",
];
const requiredGitAttributeLines = [
  "*.md text eol=lf",
  "*.yml text eol=lf",
  "*.yaml text eol=lf",
  "*.json text eol=lf",
  "*.ts text eol=lf",
  "*.tsx text eol=lf",
  "*.js text eol=lf",
  "*.mjs text eol=lf",
  "*.csv text eol=lf",
  "*.txt text eol=lf",
  "*.html text eol=lf",
  "*.cpp text eol=lf",
  "*.h text eol=lf",
  "*.ino text eol=lf",
  "*.ini text eol=lf",
  "*.ps1 text eol=crlf",
  "*.png binary",
  "*.jpg binary",
  "*.jpeg binary",
  "*.gif binary",
  "*.xlsx binary",
  "*.3mf binary",
  "*.epro binary",
];
const requiredLfTextExtensions = new Set([
  ".cpp",
  ".csv",
  ".h",
  ".html",
  ".ini",
  ".ino",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const failures = [];

assertUniqueList("generatedPaths", generatedPaths);
assertUniqueList("allowedRootDirectories", allowedRootDirectories);
assertUniqueList("requiredHardwareArtifacts", requiredHardwareArtifacts);
assertUniqueList("requiredSourceReleaseArtifacts", requiredSourceReleaseArtifacts);
assertUniqueList("requiredGitignoreFragments", requiredGitignoreFragments);
assertUniqueList("requiredGitAttributeLines", requiredGitAttributeLines);

const requiredSourceReleaseSet = new Set(requiredSourceReleaseArtifacts);
const allowedRootDirectorySet = new Set(allowedRootDirectories);
for (const relativePath of collectRootDirectories().sort()) {
  if (!allowedRootDirectorySet.has(relativePath) && !isGitIgnored(relativePath)) {
    failures.push(`top-level directory is present but not listed in allowedRootDirectories or ignored: ${relativePath}`);
  }
}

const actualHardwareFiles = collectFiles("hardware").sort();
const requiredHardwareSet = new Set(requiredHardwareArtifacts);
for (const relativePath of actualHardwareFiles) {
  if (!requiredHardwareSet.has(relativePath)) {
    failures.push(`hardware artifact is present but not listed in requiredHardwareArtifacts: ${relativePath}`);
  }
}

const actualRootFiles = collectRootFiles().sort();
for (const relativePath of actualRootFiles) {
  if (!requiredSourceReleaseSet.has(relativePath) && !isGitIgnored(relativePath)) {
    failures.push(`top-level artifact is present but not listed in requiredSourceReleaseArtifacts or ignored: ${relativePath}`);
  }
}

const actualGithubFiles = collectFiles(".github").sort();
for (const relativePath of actualGithubFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`GitHub metadata artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

const actualPictureFiles = collectFiles("pictures").sort();
for (const relativePath of actualPictureFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`picture artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

const actualMobileFiles = collectFiles("mobile", new Set([
  "mobile/node_modules",
  "mobile/.expo",
  "mobile/.expo-web-smoke",
  "mobile/.expo-shared",
  "mobile/android",
  "mobile/ios",
  "mobile/web-build",
  "mobile/dist",
])).sort();
const actualFirmwareFiles = collectFiles("firmware/Rev 2", new Set([
  "firmware/Rev 2/.pio",
])).sort();
for (const relativePath of actualFirmwareFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`firmware artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

const actualDocsFiles = collectFiles("docs").sort();
for (const relativePath of actualDocsFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`documentation artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

const actualScriptFiles = collectFiles("scripts").sort();
for (const relativePath of actualScriptFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`script artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

for (const relativePath of actualMobileFiles) {
  if (!requiredSourceReleaseSet.has(relativePath)) {
    failures.push(`mobile source artifact is present but not listed in requiredSourceReleaseArtifacts: ${relativePath}`);
  }
}

for (const line of requiredGitAttributeLines) {
  if (!hasGitAttributeLine(line)) {
    failures.push(`.gitattributes missing required rule: ${line}`);
  }
}

for (const relativePath of [...requiredSourceReleaseArtifacts, ...requiredHardwareArtifacts]) {
  if (!requiredLfTextExtensions.has(extensionOf(relativePath))) continue;
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) continue;
  if (readFileSync(absolutePath).includes("\r\n")) {
    failures.push(`text artifact must use LF line endings per .gitattributes: ${relativePath}`);
  }
}

const requiredReleaseArtifacts = [...requiredHardwareArtifacts, ...requiredSourceReleaseArtifacts];
const trackedReleaseArtifacts = gitTrackedPaths(requiredReleaseArtifacts);
const ignoredRequiredSourceArtifacts = gitIgnoredPaths(requiredSourceReleaseArtifacts, "required source-release artifacts");

for (const relativePath of requiredHardwareArtifacts) {
  if (!existsSync(resolve(root, relativePath))) {
    failures.push(`required hardware release artifact is missing: ${relativePath}`);
  } else if (trackedReleaseArtifacts && !trackedReleaseArtifacts.has(relativePath)) {
    failures.push(`required hardware release artifact is not tracked: ${relativePath}`);
  }
}

for (const relativePath of requiredSourceReleaseArtifacts) {
  if (!existsSync(resolve(root, relativePath))) {
    failures.push(`required source-release artifact is missing: ${relativePath}`);
    continue;
  }
  if (trackedReleaseArtifacts && !trackedReleaseArtifacts.has(relativePath)) {
    failures.push(`required source-release artifact is not tracked: ${relativePath}`);
  }
  if (ignoredRequiredSourceArtifacts?.has(relativePath)) {
    failures.push(`required source-release artifact is ignored: ${relativePath}`);
  }
}

const ignorePolicyCandidates = new Map(
  requiredGitignoreFragments
    .filter((fragment) => !fragment.startsWith("!"))
    .map((fragment) => [fragment, fragment.replace(/\/$/, "/sentinel")]),
);
const ignoredPolicyPaths = gitIgnoredPaths(
  [...ignorePolicyCandidates.values(), ".env.example"],
  "required .gitignore policy",
);
if (ignoredPolicyPaths) {
  for (const [fragment, candidate] of ignorePolicyCandidates) {
    if (!ignoredPolicyPaths.has(candidate)) {
      failures.push(`gitignore does not appear to ignore ${fragment}`);
    }
  }
  if (ignoredPolicyPaths.has(".env.example")) {
    failures.push(".env.example must remain trackable while real .env files are ignored");
  }
}

const existingGeneratedPaths = generatedPaths.filter((relativePath) => existsSync(resolve(root, relativePath)));
const ignoredGeneratedPaths = gitIgnoredPaths(existingGeneratedPaths, "generated/local paths");
if (ignoredGeneratedPaths) {
  for (const relativePath of existingGeneratedPaths) {
    if (!ignoredGeneratedPaths.has(relativePath)) {
      failures.push(`generated/local path is not ignored: ${relativePath}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Repository hygiene verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Repository hygiene verification passed.");

function hasGitAttributeLine(expectedLine) {
  return gitAttributes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(expectedLine);
}

function assertUniqueList(label, entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of entries) {
    if (seen.has(entry)) duplicates.add(entry);
    seen.add(entry);
  }
  for (const duplicate of duplicates) {
    failures.push(`${label} contains duplicate entry: ${duplicate}`);
  }
}

function collectFiles(relativeDir, skipRelativeDirs = new Set()) {
  const absoluteDir = resolve(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (skipRelativeDirs.has(relativePath)) continue;
      files.push(...collectFiles(relativePath, skipRelativeDirs));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function collectRootFiles() {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function collectRootDirectories() {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function extensionOf(relativePath) {
  const dot = relativePath.lastIndexOf(".");
  return dot >= 0 ? relativePath.slice(dot).toLowerCase() : "";
}

function gitTrackedPaths(relativePaths) {
  if (relativePaths.length === 0) return new Set();
  const result = spawnSync("git", ["ls-files", "-z", "--", ...relativePaths], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.signal) {
    failures.push(`git ls-files terminated by signal ${result.signal}`);
    return null;
  }
  if (result.status === null) {
    failures.push(`could not start git ls-files: ${result.error?.message || "unknown error"}`);
    return null;
  }
  if (result.status !== 0) {
    failures.push(`git ls-files failed with exit code ${result.status}: ${result.stderr.trim()}`);
    return null;
  }
  return new Set(result.stdout.split("\0").filter(Boolean).map(normalizeGitPath));
}

function gitIgnoredPaths(relativePaths, label) {
  if (relativePaths.length === 0) return new Set();
  const result = spawnSync("git", ["check-ignore", "--no-index", "--", ...relativePaths], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.signal) {
    failures.push(`git check-ignore for ${label} terminated by signal ${result.signal}`);
    return null;
  }
  if (result.status === null) {
    failures.push(`could not start git check-ignore for ${label}: ${result.error?.message || "unknown error"}`);
    return null;
  }
  if (result.status !== 0 && result.status !== 1) {
    failures.push(`git check-ignore for ${label} failed with exit code ${result.status}: ${result.stderr.trim()}`);
    return null;
  }
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean).map(normalizeGitPath));
}

function normalizeGitPath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function isGitIgnored(relativePath) {
  const result = spawnSync("git", ["check-ignore", "-q", "--", relativePath], {
    cwd: root,
    encoding: "utf8",
  });
  return !result.signal && result.status === 0;
}
