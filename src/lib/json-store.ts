import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function candidateDirs(): string[] {
  const dirs = [
    path.join(process.cwd(), ".data"),
    path.join("/tmp", "blakjac21-data"),
  ];
  return dirs;
}

function resolveFile(name: string): string | null {
  for (const dir of candidateDirs()) {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      // Prove the directory is writable
      writeFileSync(path.join(dir, ".write-test"), "ok", "utf8");
      return file;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function readJsonFile<T>(name: string): T | null {
  const file = resolveFile(name);
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(name: string, value: unknown): void {
  const file = resolveFile(name);
  if (!file) return;
  try {
    writeFileSync(file, JSON.stringify(value), "utf8");
  } catch {
    /* ignore — memory store remains source of truth for this instance */
  }
}
