import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const MAX_POLL_OPTION_LENGTH = 100;

interface GymEntry {
  name: string;
  enabled?: boolean;
}

export function loadGymOptions(
  path = join(PROJECT_ROOT, "poll_gyms.json")
): string[] {
  const options = loadGymNames(path);

  if (options.length < 2) {
    throw new Error("Telegram polls need at least two enabled gym options.");
  }

  const tooLong = options.filter((o) => o.length > MAX_POLL_OPTION_LENGTH);
  if (tooLong.length > 0) {
    throw new Error("Telegram poll options must be 100 characters or fewer.");
  }

  return options;
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
