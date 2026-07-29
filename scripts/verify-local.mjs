import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const [nodeMajor] = process.versions.node.split(".").map(Number);
if (nodeMajor !== 22) {
  console.error(`Local verification requires Node.js 22.x to match CI; found ${process.versions.node}.`);
  process.exit(1);
}

const python = resolvePlatformioPython();
const steps = [
  ["BLE protocol contract", "node", ["scripts/verify-protocol.mjs"], root],
  ["release text guard", "node", ["scripts/verify-release-text.mjs"], root],
  ["documentation links", "node", ["scripts/verify-doc-links.mjs"], root],
  ["mobile Simple-mode copy", "node", ["scripts/verify-mobile-simple-copy.mjs"], root],
  ["clean mobile lockfile install", "npm", ["ci", "--ignore-scripts"], resolve(root, "mobile")],
  ["Expo dependency compatibility", "npm", ["run", "check:expo"], resolve(root, "mobile")],
  ["mobile production audit summary", "npm", ["run", "audit:summary"], resolve(root, "mobile")],
  ["mobile validation helpers", "npm", ["run", "test:validation"], resolve(root, "mobile")],
  ["mobile retained CSV transfer", "npm", ["run", "test:csv-transfer"], resolve(root, "mobile")],
  ["mobile PLX oximetry parser", "npm", ["run", "test:plx-oximetry"], resolve(root, "mobile")],
  ["mobile TypeScript", "npm", ["run", "typecheck"], resolve(root, "mobile")],
  ["mobile web export smoke", "npm", ["run", "test:web-export"], resolve(root, "mobile")],
  [
    "firmware PlatformIO build",
    python.command,
    [...python.prefixArgs, "-m", "platformio", "run", "-d", "firmware/Rev 2", "-e", "esp32dev"],
    root,
  ],
  [
    "firmware bench PWM PlatformIO build",
    python.command,
    [...python.prefixArgs, "-m", "platformio", "run", "-d", "firmware/Rev 2", "-e", "esp32dev_bench_pwm"],
    root,
  ],
  ["firmware flash budget", "node", ["scripts/check-firmware-size.mjs"], root],
  ["repository hygiene", "node", ["scripts/verify-repo-hygiene.mjs"], root],
];

for (const [label, command, args, cwd] of steps) {
  console.log(`\n== ${label} ==`);
  const useShell = command === "npm";
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, {
    cwd,
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: "1",
    },
    shell: useShell,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`\n${label} could not start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`\n${label} terminated by signal ${result.signal}.`);
    process.exit(1);
  }
  if (result.status !== 0) {
    const code = result.status ?? 1;
    console.error(`\n${label} failed with exit code ${code}.`);
    process.exit(code);
  }
}

console.log("\nLocal verification passed.");

function resolvePlatformioPython() {
  const candidates = process.platform === "win32"
    ? [
        { command: resolve(root, ".venv", "Scripts", "python.exe"), prefixArgs: [] },
        { command: "py", prefixArgs: ["-3.12"] },
        { command: "python", prefixArgs: [] },
        { command: "python3", prefixArgs: [] },
      ]
    : [
        { command: resolve(root, ".venv", "bin", "python3.12"), prefixArgs: [] },
        { command: "python3.12", prefixArgs: [] },
        { command: "python3", prefixArgs: [] },
        { command: "python", prefixArgs: [] },
      ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [
      ...candidate.prefixArgs,
      "-c",
      "import platformio, sys; print(f'{sys.version_info.major}.{sys.version_info.minor} {platformio.__version__}')",
    ], {
      cwd: root,
      encoding: "utf8",
    });
    const output = String(result.stdout || "").trim();
    if (result.status === 0 && output === "3.12 6.1.19") return candidate;
  }

  const attempted = candidates
    .map(({ command, prefixArgs }) => [command, ...prefixArgs].join(" "))
    .join(", ");
  console.error(
    `Python 3.12 with PlatformIO Core 6.1.19 was not found through a supported launcher (${attempted}). ` +
      "Create the repository .venv (recommended) or activate another Python 3.12 environment, then install the exact requirements-ci.txt closure before running the local gate.",
  );
  process.exit(1);
}
