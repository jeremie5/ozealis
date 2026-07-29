import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mobileDir = resolve(root, "mobile");
const baselinePath = resolve(root, "docs/mobile-audit-baseline.json");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["audit", "--omit=dev", "--json"], {
  cwd: mobileDir,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Could not start npm audit: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`npm audit terminated by signal ${result.signal}.`);
  process.exit(1);
}

if (!result.stdout.trim()) {
  console.error(result.stderr.trim() || "npm audit did not return JSON output.");
  process.exit(result.status || 1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error(`Could not parse npm audit JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities;
if (!isAuditCounts(counts)) {
  console.error("npm audit JSON is missing numeric vulnerability metadata.");
  process.exit(1);
}
const expectedTotal =
  counts.info +
  counts.low +
  counts.moderate +
  counts.high +
  counts.critical;
if (counts.total !== expectedTotal) {
  console.error(`npm audit JSON vulnerability total is inconsistent: total=${counts.total}, severity sum=${expectedTotal}.`);
  process.exit(1);
}
const vulnerabilities = Object.values(report.vulnerabilities || {});
const sorted = vulnerabilities
  .map((item) => ({
    name: String(item.name || "unknown"),
    severity: String(item.severity || "unknown"),
    direct: Boolean(item.isDirect),
    via: Array.isArray(item.via) ? item.via.map(normalizeVia).sort() : ["unknown"],
    fix: describeFix(item.fixAvailable),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log("Mobile production audit summary");
console.log(`moderate=${counts.moderate || 0} high=${counts.high || 0} critical=${counts.critical || 0} total=${counts.total || 0}`);
for (const item of sorted) {
  console.log(`- ${item.name}: ${item.severity}${item.direct ? ", direct" : ""}; via ${item.via.join(", ")}; fix ${item.fix}`);
}

const blockingAdvisories = sorted.filter((item) => item.severity === "high" || item.severity === "critical");

if ((counts.high || 0) > 0 || (counts.critical || 0) > 0 || blockingAdvisories.length > 0) {
  console.error("High or critical production advisories require explicit review before release.");
  for (const item of blockingAdvisories) {
    console.error(`- ${item.name}: ${item.severity}`);
  }
  process.exit(1);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch (error) {
  console.error(`Could not read the mobile audit baseline: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const baselineErrors = validateBaseline(baseline);
if (baselineErrors.length > 0) {
  console.error("Mobile production audit baseline is invalid:");
  for (const error of baselineErrors) console.error(`- ${error}`);
  process.exit(1);
}

const observed = {
  counts: {
    info: counts.info,
    low: counts.low,
    moderate: counts.moderate,
    high: counts.high,
    critical: counts.critical,
    total: counts.total,
  },
  vulnerabilities: sorted.map(({ name, severity, direct, via }) => ({ name, severity, direct, via })),
};
const expected = {
  counts: baseline.counts,
  vulnerabilities: [...baseline.vulnerabilities]
    .map((item) => ({ ...item, via: [...item.via].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name)),
};

if (JSON.stringify(observed) !== JSON.stringify(expected)) {
  console.error(`Mobile production audit differs from the reviewed baseline at ${baselinePath}.`);
  console.error(`Expected: ${JSON.stringify(expected)}`);
  console.error(`Observed: ${JSON.stringify(observed)}`);
  console.error("Review the live advisories before updating both the baseline and docs/mobile-audit.md.");
  process.exit(1);
}

console.log(`Audit matches reviewed baseline ${baseline.reviewed}.`);

function describeFix(value) {
  if (value === true) return "available";
  if (!value || typeof value !== "object") return "none";
  const name = value.name || "unknown";
  const version = value.version || "unknown";
  return `${name}@${version}${value.isSemVerMajor ? " (major)" : ""}`;
}

function normalizeVia(entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "unknown";
  const advisoryUrl = typeof entry.url === "string" ? entry.url : "";
  const advisoryId = /\/advisories\/(GHSA-[A-Za-z0-9-]+)$/.exec(advisoryUrl)?.[1];
  if (advisoryId) return advisoryId;
  if (Number.isInteger(entry.source)) return `source:${entry.source}`;
  return String(entry.name || entry.title || "unknown");
}

function validateBaseline(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["root must be a JSON object"];
  if (value.schema !== 1) errors.push("schema must equal 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.reviewed || "")) errors.push("reviewed must be an ISO date");
  if (value.command !== "npm audit --omit=dev --json") errors.push("command does not match the release audit");
  if (!isAuditCounts(value.counts)) errors.push("counts must contain finite numeric severity totals");
  if (!Array.isArray(value.vulnerabilities)) {
    errors.push("vulnerabilities must be an array");
    return errors;
  }
  const names = new Set();
  for (const item of value.vulnerabilities) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("each vulnerability must be an object");
      continue;
    }
    if (typeof item.name !== "string" || !item.name) errors.push("vulnerability name must be non-empty");
    if (names.has(item.name)) errors.push(`duplicate vulnerability name: ${item.name}`);
    names.add(item.name);
    if (!["info", "low", "moderate", "high", "critical"].includes(item.severity)) {
      errors.push(`invalid severity for ${item.name || "unknown"}`);
    }
    if (typeof item.direct !== "boolean") errors.push(`direct must be boolean for ${item.name || "unknown"}`);
    if (!Array.isArray(item.via) || item.via.some((entry) => typeof entry !== "string" || !entry)) {
      errors.push(`via must contain non-empty strings for ${item.name || "unknown"}`);
    }
  }
  return errors;
}

function isAuditCounts(value) {
  return (
    value &&
    typeof value === "object" &&
    Number.isFinite(value.info) &&
    Number.isFinite(value.low) &&
    Number.isFinite(value.moderate) &&
    Number.isFinite(value.high) &&
    Number.isFinite(value.critical) &&
    Number.isFinite(value.total)
  );
}
