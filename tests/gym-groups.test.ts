import { describe, it, expect } from "vitest";
import { loadGymGroups, GymGroup } from "../src/gym-groups.js";

describe("loadGymGroups", () => {
  it("returns known multi-location brands", () => {
    const groups = loadGymGroups();
    const brandNames = groups.map((g) => g.brand);
    expect(brandNames).toContain("Boulder Movement");
    expect(brandNames).toContain("Boulder Planet");
    expect(brandNames).toContain("Boulder Plus");
    expect(brandNames).toContain("BFF Climb");
    expect(brandNames).toContain("Climb Central");
    expect(brandNames).toContain("Fit Bloc");
    expect(brandNames).toContain("Other");
  });

  it("groups Boulder Movement locations correctly", () => {
    const groups = loadGymGroups();
    const bm = groups.find((g) => g.brand === "Boulder Movement")!;
    expect(bm.gyms).toContain("Boulder Movement (Bugis+)");
    expect(bm.gyms).toContain("Boulder Movement (Downtown)");
    expect(bm.gyms).toContain("Boulder Movement (Rochor)");
    expect(bm.gyms).toContain("Boulder Movement (Tai Seng)");
  });

  it("groups Climb Central locations correctly", () => {
    const groups = loadGymGroups();
    const cc = groups.find((g) => g.brand === "Climb Central")!;
    expect(cc.gyms).toContain("Climb Central (Kallang Wave Mall)");
    expect(cc.gyms).toContain("Climb Central Funan");
    expect(cc.gyms).toContain("Climb Central Novena");
    expect(cc.gyms).toContain("Climb Central SAFRA Choa Chu Kang");
  });

  it("puts single-location gyms in Other", () => {
    const groups = loadGymGroups();
    const other = groups.find((g) => g.brand === "Other")!;
    expect(other.gyms).toContain("Ark Bloc");
    expect(other.gyms).toContain("Climba");
    expect(other.gyms).toContain("Z-Vertigo Boulder Gym");
  });

  it("does not put multi-location gyms in Other", () => {
    const groups = loadGymGroups();
    const other = groups.find((g) => g.brand === "Other")!;
    expect(other.gyms).not.toContain("Boulder Movement (Bugis+)");
    expect(other.gyms).not.toContain("Fit Bloc (Kent Ridge)");
  });
});
