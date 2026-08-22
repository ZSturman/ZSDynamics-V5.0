/** Load local project environment files without echoing any values. */

import fs from "node:fs";
import path from "node:path";

const ENV_ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

function parseValue(raw) {
  if (!raw) return "";
  const quote = raw[0];
  if ((quote === '"' || quote === "'") && raw.endsWith(quote)) {
    const inner = raw.slice(1, -1);
    return quote === '"'
      ? inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      : inner;
  }
  return raw.replace(/\s+#.*$/, "").trim();
}

function loadFile(filePath, inherited) {
  if (!fs.existsSync(filePath)) return [];
  const loaded = [];
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (/^\s*(?:#|$)/.test(line)) continue;
    const match = line.match(ENV_ASSIGNMENT);
    if (!match) continue;
    const [, key, rawValue] = match;
    // Explicit shell/CI variables must always win. .env.local intentionally
    // overrides .env for values not inherited from the process.
    if (inherited.has(key)) continue;
    process.env[key] = parseValue(rawValue);
    loaded.push(key);
  }
  return loaded;
}

/**
 * Load .env followed by .env.local. Returns variable names only, never values.
 */
export function loadProjectEnvironment(root) {
  const inherited = new Set(Object.keys(process.env));
  return [
    ...loadFile(path.join(root, ".env"), inherited),
    ...loadFile(path.join(root, ".env.local"), inherited),
  ];
}
