import { describe, it, expect } from "vitest";
import { splitPollOptions, buildPollQuestion } from "../src/handlers";

describe("splitPollOptions", () => {
  it("keeps a small list as a single group", () => {
    const options = ["Gym A", "Gym B", "Gym C"];
    expect(splitPollOptions(options)).toEqual([["Gym A", "Gym B", "Gym C"]]);
  });

  it("splits into groups of 10", () => {
    const options = Array.from({ length: 12 }, (_, i) => `Gym ${i}`);
    const result = splitPollOptions(options);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(10);
    expect(result[1]).toHaveLength(2);
  });

  it("avoids a single-item last group", () => {
    const options = Array.from({ length: 11 }, (_, i) => `Gym ${i}`);
    const result = splitPollOptions(options);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(9);
    expect(result[1]).toHaveLength(2);
  });

  it("handles exactly 10 as a single group", () => {
    const options = Array.from({ length: 10 }, (_, i) => `Gym ${i}`);
    const result = splitPollOptions(options);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(10);
  });
});

describe("buildPollQuestion", () => {
  it("returns plain question for single poll", () => {
    expect(buildPollQuestion("Where?", 1, 1)).toBe("Where?");
  });

  it("adds numbering for multi-poll", () => {
    expect(buildPollQuestion("Where?", 2, 3)).toBe("Where? (2/3)");
  });
});
