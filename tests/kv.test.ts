import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import { kv } from "@vercel/kv";
import {
  getGroupGyms,
  setGroupGyms,
  getSetgymsState,
  setSetgymsState,
  deleteSetgymsState,
} from "../src/kv.js";

const mockedKv = vi.mocked(kv);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGroupGyms", () => {
  it("returns gym list when key exists", async () => {
    mockedKv.get.mockResolvedValue(["Gym A", "Gym B"]);
    const result = await getGroupGyms(123);
    expect(mockedKv.get).toHaveBeenCalledWith("gyms:123");
    expect(result).toEqual(["Gym A", "Gym B"]);
  });

  it("returns null when key does not exist", async () => {
    mockedKv.get.mockResolvedValue(null);
    const result = await getGroupGyms(123);
    expect(result).toBeNull();
  });
});

describe("setGroupGyms", () => {
  it("saves gym list under correct key", async () => {
    await setGroupGyms(123, ["Gym A"]);
    expect(mockedKv.set).toHaveBeenCalledWith("gyms:123", ["Gym A"]);
  });
});

describe("getSetgymsState", () => {
  it("returns state when key exists", async () => {
    const state = { step: "brands", selectedBrands: [], selectedGyms: [], currentBrandIndex: 0 };
    mockedKv.get.mockResolvedValue(state);
    const result = await getSetgymsState(456);
    expect(mockedKv.get).toHaveBeenCalledWith("setgyms:456");
    expect(result).toEqual(state);
  });
});

describe("setSetgymsState", () => {
  it("saves state with 10 minute TTL", async () => {
    const state = { step: "brands" as const, selectedBrands: [], selectedGyms: [], currentBrandIndex: 0 };
    await setSetgymsState(456, state);
    expect(mockedKv.set).toHaveBeenCalledWith("setgyms:456", state, { ex: 600 });
  });
});

describe("deleteSetgymsState", () => {
  it("deletes state key", async () => {
    await deleteSetgymsState(456);
    expect(mockedKv.del).toHaveBeenCalledWith("setgyms:456");
  });
});
