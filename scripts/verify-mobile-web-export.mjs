import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mobileRoot = resolve(root, "mobile");
const outputDir = resolve(mobileRoot, ".expo-web-smoke");

rmSync(outputDir, { recursive: true, force: true });

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, ["expo", "export", "--platform", "web", "--output-dir", ".expo-web-smoke"], {
  cwd: mobileRoot,
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: "1",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

let exitCode = 0;
try {
  if (result.error) {
    console.error(`Expo web export smoke could not start: ${result.error.message}`);
    exitCode = 1;
  } else if (result.signal) {
    console.error(`Expo web export smoke terminated by signal ${result.signal}.`);
    exitCode = 1;
  } else if (result.status !== 0) {
    console.error(`Expo web export smoke failed with exit code ${result.status ?? 1}.`);
    exitCode = result.status ?? 1;
  } else if (!existsSync(resolve(outputDir, "index.html"))) {
    console.error("Expo web export smoke did not produce index.html.");
    exitCode = 1;
  } else if (!hasNonEmptyJsBundle(resolve(outputDir, "_expo", "static", "js"))) {
    console.error("Expo web export smoke did not produce a non-empty JS bundle.");
    exitCode = 1;
  } else {
    console.log("Expo web export smoke passed.");
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}

process.exit(exitCode);

function hasNonEmptyJsBundle(directory) {
  if (!existsSync(directory)) return false;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (hasNonEmptyJsBundle(absolute)) return true;
    } else if (entry.isFile() && entry.name.endsWith(".js") && statSync(absolute).size > 0) {
      return true;
    }
  }
  return false;
}
