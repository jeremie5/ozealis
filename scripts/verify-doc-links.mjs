import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

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
const failures = [];

function collectMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      out.push(...collectMarkdown(resolve(dir, entry.name)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(resolve(dir, entry.name));
    }
  }
  return out;
}

function isExternalLink(target) {
  return /^(https?:|mailto:|tel:)/i.test(target);
}

function isForbiddenLocalMachineLink(target) {
  return /^file:/i.test(target) || /^[A-Za-z]:[\\/]/.test(target) || /^\\\\/.test(target);
}

function isRepoAbsolutePath(target) {
  return target.startsWith("/");
}

function isPlaceholderExternalLink(target) {
  try {
    const url = new URL(target);
    const host = url.hostname.toLowerCase();
    return host === "example.com" || host === "example.test" || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function decodeLinkTarget(target) {
  return target.replace(/%20/g, " ");
}

function validateLocalTarget(file, rawTarget, label = "local link target") {
  if (!rawTarget || rawTarget.trim() === "") {
    failures.push(`${repoRelative(file)}: empty ${label}`);
    return;
  }
  const withoutTitle = rawTarget.split(/\s+["'][^"']*["']\s*$/)[0];
  const unwrapped = withoutTitle.startsWith("<") && withoutTitle.endsWith(">") ? withoutTitle.slice(1, -1) : withoutTitle;
  const [rawPathPart, rawAnchor = ""] = unwrapped.split("#");
  const pathPart = decodeLinkTarget(rawPathPart);
  if (pathPart && isPlaceholderExternalLink(pathPart)) {
    failures.push(`${repoRelative(file)}: placeholder external link ${rawTarget}`);
    return;
  }
  if (pathPart && isExternalLink(pathPart)) return;
  if (pathPart && isForbiddenLocalMachineLink(pathPart)) {
    failures.push(`${repoRelative(file)}: machine-specific ${label} ${rawTarget}`);
    return;
  }
  if (pathPart && isRepoAbsolutePath(pathPart)) {
    failures.push(`${repoRelative(file)}: absolute ${label} ${rawTarget}`);
    return;
  }

  const resolved = pathPart ? resolve(dirname(file), pathPart) : file;
  if (!existsSync(resolved)) {
    failures.push(`${repoRelative(file)}: missing ${label} ${rawTarget}`);
    return;
  }
  if (extname(resolved) === "" && statSync(resolved).isFile()) {
    failures.push(`${repoRelative(file)}: ambiguous ${label} ${rawTarget}`);
  }
  if (rawAnchor && resolved.toLowerCase().endsWith(".md")) {
    const anchors = markdownAnchors(resolved);
    const anchor = decodeLinkTarget(rawAnchor).toLowerCase();
    if (!anchors.has(anchor)) {
      failures.push(`${repoRelative(file)}: missing Markdown anchor ${rawTarget}`);
    }
  }
}

function parseReferenceDefinitions(text) {
  const definitions = new Map();
  const pattern = /^\s{0,3}\[([^\]]+)]:\s*(\S+)/gm;
  let match;
  while ((match = pattern.exec(text))) {
    const target = match[2].replace(/^<|>$/g, "");
    definitions.set(normalizeReferenceId(match[1]), target);
  }
  return definitions;
}

function normalizeReferenceId(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

for (const file of collectMarkdown(root)) {
  const text = readFileSync(file, "utf8");
  const referenceDefinitions = parseReferenceDefinitions(text);
  const linkPattern = /!?\[[^\]]*]\(([^)]*)\)/g;
  let match;
  while ((match = linkPattern.exec(text))) {
    validateLocalTarget(file, match[1].trim());
  }

  for (const [id, target] of referenceDefinitions) {
    validateLocalTarget(file, target, `reference definition [${id}]`);
  }

  const referenceLinkPattern = /!?\[([^\]]+)]\[([^\]]*)]/g;
  while ((match = referenceLinkPattern.exec(text))) {
    const id = normalizeReferenceId(match[2] || match[1]);
    if (!referenceDefinitions.has(id)) {
      failures.push(`${repoRelative(file)}: missing reference link definition [${id}]`);
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation link verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Documentation link verification passed.");

function repoRelative(file) {
  return relative(root, file).replace(/\\/g, "/");
}

function markdownAnchors(file) {
  const anchors = new Set();
  const counts = new Map();
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = githubSlug(match[2]);
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function githubSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
