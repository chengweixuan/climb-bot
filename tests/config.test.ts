import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  loadAllGymOptions,
  loadInspirationQuotes,
} from "../src/config.js";

const FIXTURES = join(__dirname, "..");

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
