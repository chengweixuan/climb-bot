import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  loadGymOptions,
  loadAllGymOptions,
  loadInspirationQuotes,
} from "../src/config";

const FIXTURES = join(__dirname, "..");

describe("loadGymOptions", () => {
  it("loads enabled gyms from poll_gyms.json", () => {
    const options = loadGymOptions(join(FIXTURES, "poll_gyms.json"));
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0]).toBe("BFF Climb (Bendemeer)");
  });

  it("throws if fewer than 2 options", () => {
    expect(() =>
      loadGymOptions(join(__dirname, "fixtures/too-few-gyms.json"))
    ).toThrow("at least two");
  });
});

describe("loadAllGymOptions", () => {
  it("loads all gyms from gyms.json", () => {
    const options = loadAllGymOptions(join(FIXTURES, "gyms.json"));
    expect(options.length).toBeGreaterThan(10);
    expect(options).toContain("Ark Bloc");
  });
});

describe("loadInspirationQuotes", () => {
  it("loads quotes from inspiration_quotes.json", () => {
    const quotes = loadInspirationQuotes(
      join(FIXTURES, "inspiration_quotes.json")
    );
    expect(quotes.length).toBeGreaterThan(50);
    expect(typeof quotes[0]).toBe("string");
  });

  it("throws if no quotes", () => {
    expect(() =>
      loadInspirationQuotes(join(__dirname, "fixtures/empty-quotes.json"))
    ).toThrow("at least one quote");
  });
});
