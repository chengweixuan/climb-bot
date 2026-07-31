import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

interface GymEntry {
  name: string;
  enabled?: boolean;
}

export function loadAllGymOptions(
  path = join(PROJECT_ROOT, "gyms.json")
): string[] {
  return loadGymNames(path);
}

export function loadInspirationQuotes(
  path = join(PROJECT_ROOT, "inspiration_quotes.json")
): string[] {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
  const quotes = raw.filter(
    (q): q is string => typeof q === "string" && q.trim().length > 0
  );

  if (quotes.length === 0) {
    throw new Error("inspiration_quotes.json needs at least one quote.");
  }

  return quotes.map((q) => q.trim());
}

function loadGymNames(path: string): string[] {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as GymEntry[];
  return raw
    .filter((gym) => gym.enabled !== false && gym.name?.trim())
    .map((gym) => gym.name.trim());
}
