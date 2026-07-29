import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skipDirs = new Set([
  ".expo",
  ".expo-web-smoke",
  ".git",
  ".pio",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "node_modules",
  "web-build",
]);

const files = unique([
  ...collectMarkdownFiles("."),
  ...collectSourceFiles("firmware/Rev 2/ozealis"),
  ...collectSourceFiles("mobile"),
  ".github/workflows/ci.yml",
  "docs/mcf8316d-register-manifest.json",
  "mobile/app.json",
  "mobile/package.json",
  "firmware/Rev 2/README.md",
  "firmware/Rev 2/platformio.ini",
  "firmware/Rev 2/min_spiffs.csv",
]);

const bannedPatterns = [
  { label: "treats sleep apnea", pattern: /\btreats?\s+sleep\s+apnea\b/ },
  { label: "clinically validated", pattern: /\bclinically\s+validated\b/ },
  { label: "clinically proven", pattern: /\bclinically\s+proven\b/ },
  { label: "validated for human use", pattern: /\bvalidated\s+for\s+human\s+use\b/ },
  { label: "therapy guaranteed", pattern: /\btherapy\s+guaranteed\b/ },
  { label: "therapeutic", pattern: /\btherapeutic\b/ },
  { label: "safe for use", pattern: /\bsafe\s+for\s+use\b/ },
  { label: "safe and effective", pattern: /\bsafe\s+and\s+effective\b/ },
  { label: "production-ready", pattern: /\bproduction-ready\b/ },
  { label: "production ready", pattern: /\bproduction\s+ready\b/ },
  { label: "compliant", pattern: /\bcompliant\b/ },
  { label: "approved medical device", pattern: /\bapproved\s+medical\s+device\b/ },
  { label: "certified medical device", pattern: /\bcertified\s+medical\s+device\b/ },
  { label: "medical-grade", pattern: /\bmedical-grade\b/ },
  { label: "medical grade", pattern: /\bmedical\s+grade\b/ },
  { label: "medical quality", pattern: /\bmedical\s+quality\b/ },
  { label: "clinical quality", pattern: /\bclinical\s+quality\b/ },
  { label: "clinical-grade", pattern: /\bclinical-grade\b/ },
  { label: "clinical grade", pattern: /\bclinical\s+grade\b/ },
  { label: "FDA-approved", pattern: /\bfda[-\s]+approved\b/ },
  { label: "regulator-approved", pattern: /\bregulator[-\s]+approved\b/ },
  { label: "patient-ready", pattern: /\bpatient-ready\b/ },
  { label: "patient ready", pattern: /\bpatient\s+ready\b/ },
  { label: "ready for patients", pattern: /\bready\s+for\s+patients\b/ },
  { label: "ready for clinical use", pattern: /\bready\s+for\s+clinical\s+use\b/ },
  { label: "sleep apnea treatment", pattern: /\bsleep\s+apnea\s+treatment\b/ },
  { label: "sleep apnea screening", pattern: /\bsleep\s+apnea\s+screening\b/ },
  { label: "emergency use", pattern: /\bemergency\s+use\b/ },
  { label: "life-support", pattern: /\blife-support\b/ },
  { label: "life support", pattern: /\blife\s+support\b/ },
  { label: "screening tool", pattern: /\bscreening\s+tool\b/ },
  { label: "screens for sleep apnea", pattern: /\bscreens?\s+for\s+sleep\s+apnea\b/ },
  { label: "medical advice", pattern: /\bmedical\s+advice\b/ },
  { label: "prescription", pattern: /\bprescriptions?\b/ },
  { label: "prescribed setting", pattern: /\bprescribed\s+settings?\b/ },
  { label: "cure", pattern: /\bcure\b/ },
  { label: "diagnose", pattern: /\bdiagnose\b/ },
];

const allowedContext = [
  "not a medical device",
  "not approved",
  "not an approved",
  "not an approved medical device",
  "not a cpap, bipap, asv, ventilator, or other approved medical device",
  "not validated for human use",
  "not a cpap",
  "no medical",
  "no claims",
  "do not make",
  "do not make medical, diagnostic, screening, treatment, cure, prevention, or emergency-use claims",
  "avoid wording",
  "not approved for diagnosis",
  "no medical, diagnostic, therapeutic",
  "a device for diagnosis, treatment, cure, mitigation, or prevention",
  "not ahi, diagnosis, screening",
  "no claims about diagnosis, treatment, cure",
  "project treats, diagnoses, screens for, prevents, or cures disease",
  "claims treatment, diagnosis, screening, cure, prevention",
  "cure time",
  "not medical advice",
  "never share settings as medical advice",
  "emergency, life-support",
  "not approved for emergency",
  "not approved for life-support",
  "not approved for diagnosis, treatment, emergency, or life-support use",
  "not clinical quality",
  "not medical quality",
  "do not present unvalidated behavior as safe, therapeutic, compliant, or production-ready",
  "not prescriptions",
  "not a prescription",
  "not approved, certified, compliant, production-ready, therapeutic, safe, effective, or prescribed",
];

const mojibake =
  /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2(?:[\u0080-\u00BF]{2}|\u20AC[\u0080-\u00BF\u2010-\u204A\u2122])|\u00F0\u0178|\u00EF\u00BB\u00BF/u;
const staleBle = /180F|0000180f-0000-1000-8000-00805f9b34fb/i;
const staleSecurity = /not authenticated yet|writes are not authenticated/i;
const requiredText = [
  {
    file: "README.md",
    fragments: [
      "It is not a medical device.",
      "It makes no claims about diagnosis, treatment, cure, prevention, safety, reliability, or fitness for use.",
      "concrete open-source pressure and airflow research that is transparent, reproducible, and accessible worldwide",
      "access to conventional equipment, trained support, replacement parts, or funding may be limited",
      "inspectable hardware, commodity components, reproducible calibration steps, offline-friendly documentation",
      "not a shortcut around professional review, local law, or independent validation",
      "make every subsystem more measurable, conservative, repairable, and failure-aware while keeping claims honest",
    ],
  },
  {
    file: "SAFETY.md",
    fragments: [
      "Ozealis is not a medical device.",
      "The project is built with awareness that equipment shortages can happen.",
      "Public documentation must stay honest about the experimental scope even when internal engineering aims for high rigor.",
      "A device for diagnosis, treatment, cure, mitigation, or prevention of sleep apnea or any other condition.",
      "Emergency, life-support, or unattended safety-critical equipment.",
      "Never share settings as medical advice or present airflow observations as screening results.",
      "\"emergency use\"",
      "\"life support\"",
      "\"therapeutic\"",
      "\"production ready\"",
      "\"prescription\"",
    ],
  },
  {
    file: "CONTRIBUTING.md",
    fragments: [
      "Do not make medical, diagnostic, screening, treatment, cure, prevention, or emergency-use claims.",
      "Documentation avoids claims that the project treats, diagnoses, screens for, prevents, or cures disease.",
      "Do not present unvalidated behavior as safe, therapeutic, compliant, or production-ready.",
      "Prefer designs that can be inspected, repaired, calibrated, and documented worldwide, including low-resource settings, without proprietary lab equipment.",
      "Keep user-facing text clear that this is not an approved medical device and has no warranty.",
    ],
  },
  {
    file: "SECURITY.md",
    fragments: [
      "Firmware requests BLE bonding and encrypted GATT access",
      "does not provide passkey verification",
      "There is no app-layer authorization, rotating key, or documented physical commissioning flow yet.",
      "does not perform project-owned signed-image verification or certificate pinning.",
      "The mobile app is a control surface, not a safety boundary.",
      "These are known release blockers, not acceptable production behavior.",
    ],
  },
  {
    file: "mobile/App.tsx",
    fragments: [
      "const [message, setMessage] = useState(\"\");",
      "Experimental research platform only. Not approved for diagnosis, treatment, emergency, or life-support use.",
      "Experimental research project only. No warranties or medical claims.",
      "It makes no medical, diagnostic, therapeutic, performance, safety, or reliability claims.",
      "Only continue with a firmware binary you built and verified.",
      "These are not AHI, diagnosis, screening, or treatment guidance.",
    ],
  },
  {
    file: "mobile/app.json",
    fragments: [
      "Allow Ozealis Control to connect to nearby Ozealis experimental airflow devices.",
      "Ozealis Control uses Bluetooth to connect to an Ozealis experimental airflow device.",
    ],
  },
  {
    file: "docs/ble-protocol.md",
    fragments: [
      "non-diagnostic low-flow index rather than a clinical AHI value",
      "does not perform project-owned signed-image verification or certificate pinning",
      "not implemented or validated yet",
    ],
  },
];
const failures = [];

for (const { file, fragments } of requiredText) {
  const text = readFileSync(resolve(root, file), "utf8");
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      failures.push(`${file} missing required release-boundary text: ${fragment}`);
    }
  }
}

for (const file of files) {
  const text = readFileSync(resolve(root, file), "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (mojibake.test(line)) {
      failures.push(`${file}:${lineNumber} contains mojibake-looking text`);
    }
    if (staleBle.test(line)) {
      failures.push(`${file}:${lineNumber} contains stale BLE UUID text`);
    }
    if (staleSecurity.test(line)) {
      failures.push(`${file}:${lineNumber} contains stale BLE security text`);
    }

    const lower = line.toLowerCase();
    for (const label of claimLikePhrases(lower, file)) {
      failures.push(`${file}:${lineNumber} contains claim-like phrase "${label}"`);
    }
  });
}

const contradictoryProbe = claimLikePhrases("not medical advice; clinically proven", "probe.md");
if (contradictoryProbe.length !== 1 || contradictoryProbe[0] !== "clinically proven") {
  failures.push("release-text claim guard must not exempt a whole line because one safe phrase is present");
}
if (claimLikePhrases("this is not medical advice", "probe.md").length !== 0) {
  failures.push("release-text claim guard must preserve scoped negative context");
}
if (claimLikePhrases('- "clinically validated"', "SAFETY.md").length !== 0 ||
    claimLikePhrases('- "clinically validated and approved"', "SAFETY.md").length === 0) {
  failures.push("release-text claim guard must allow only exact quoted forbidden-phrase examples");
}

if (failures.length > 0) {
  console.error("Release text verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release text verification passed.");

function collectMarkdownFiles(relativeDir) {
  const absoluteDir = resolve(root, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = relativeDir === "." ? entry.name : `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...collectMarkdownFiles(relativePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(relativePath);
    }
  }
  return files;
}

function collectSourceFiles(relativeDir) {
  const sourceExtensions = new Set([".cpp", ".h", ".ino", ".ts", ".tsx"]);
  const absoluteDir = resolve(root, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...collectSourceFiles(relativePath));
    } else if (entry.isFile() && sourceExtensions.has(extensionOf(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function claimLikePhrases(lower, file) {
  const allowedRanges = [];
  for (const fragment of allowedContext) {
    let start = lower.indexOf(fragment);
    while (start >= 0) {
      allowedRanges.push([start, start + fragment.length]);
      start = lower.indexOf(fragment, start + 1);
    }
  }
  const quotedSafety = file === "SAFETY.md"
    ? /^-\s+"([^"]+)"\s*$/.exec(lower.trim())?.[1]
    : undefined;
  const violations = [];
  for (const { label, pattern } of bannedPatterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    for (const match of lower.matchAll(new RegExp(pattern.source, flags))) {
      const start = match.index;
      const end = start + match[0].length;
      const insideAllowedContext = allowedRanges.some(([allowedStart, allowedEnd]) =>
        allowedStart <= start && end <= allowedEnd);
      const exactQuotedExample = quotedSafety === match[0];
      if (!insideAllowedContext && !exactQuotedExample) violations.push(label);
    }
  }
  return violations;
}

function unique(values) {
  return [...new Set(values)];
}
