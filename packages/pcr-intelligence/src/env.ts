import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const loadedFiles = new Set<string>();

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) {
    return null;
  }
  const key = match[1];
  let value = match[2] ?? "";
  value = value.trim().replace(/^['"]|['"]$/g, "");
  return [key, value];
}

export function loadLocalEnv(cwd = process.cwd()): void {
  if (process.env.PCR_SKIP_ENV_FILE === "1") {
    return;
  }

  const candidates = [
    join(resolve(cwd), ".env.local"),
    join(resolve(cwd), ".env"),
  ];

  for (const file of candidates) {
    if (loadedFiles.has(file)) {
      continue;
    }
    loadedFiles.add(file);
    if (!existsSync(file)) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
