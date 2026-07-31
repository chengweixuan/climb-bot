import { loadAllGymOptions } from "./config.js";

export interface GymGroup {
  brand: string;
  gyms: string[];
}

export const BRAND_PATTERNS: Record<string, string> = {
  "Boulder Movement": "Boulder Movement",
  "Boulder Planet": "Boulder Planet",
  "Boulder Plus": "Boulder Plus",
  "BFF Climb": "BFF Climb",
  "Climb Central": "Climb Central",
  "Fit Bloc": "Fit Bloc",
};

export function loadGymGroups(): GymGroup[] {
  const allGyms = loadAllGymOptions();
  const grouped = new Map<string, string[]>();

  for (const prefix of Object.keys(BRAND_PATTERNS)) {
    grouped.set(prefix, []);
  }

  const others: string[] = [];

  for (const gym of allGyms) {
    let matched = false;
    for (const prefix of Object.keys(BRAND_PATTERNS)) {
      if (gym.startsWith(prefix)) {
        grouped.get(prefix)!.push(gym);
        matched = true;
        break;
      }
    }
    if (!matched) {
      others.push(gym);
    }
  }

  const groups: GymGroup[] = [];
  for (const [brand, gyms] of grouped) {
    if (gyms.length > 0) {
      groups.push({ brand, gyms });
    }
  }
  groups.push({ brand: "Other", gyms: others });

  return groups;
}
