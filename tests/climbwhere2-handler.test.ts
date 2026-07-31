import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/kv.js", () => ({
  getGroupGyms: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  loadAllGymOptions: vi.fn(() => [
    "Boulder Movement (Bugis+)",
    "Boulder Movement (Tai Seng)",
    "Fit Bloc (Kent Ridge)",
    "Climba",
  ]),
}));

import { getGroupGyms } from "../src/kv.js";
import { handleClimbwhere2 } from "../src/climbwhere2-handler.js";

const mockedGetGroupGyms = vi.mocked(getGroupGyms);

function createCtx() {
  return {
    chat: { id: 123 },
    reply: vi.fn(),
    api: { sendPoll: vi.fn() },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleClimbwhere2", () => {
  it("replies with setup prompt when no preferences saved", async () => {
    mockedGetGroupGyms.mockResolvedValue(null);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("/setgyms")
    );
    expect(ctx.api.sendPoll).not.toHaveBeenCalled();
  });

  it("sends poll with saved gyms", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Fit Bloc (Kent Ridge)", "Climba"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.api.sendPoll).toHaveBeenCalledWith(
      123,
      "Where are we climbing this week?",
      ["Fit Bloc (Kent Ridge)", "Climba"],
      expect.objectContaining({ is_anonymous: false, allows_multiple_answers: false })
    );
  });

  it("filters out gyms no longer in gyms.json", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Fit Bloc (Kent Ridge)", "Climba", "Nonexistent Gym"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.api.sendPoll).toHaveBeenCalledWith(
      123,
      expect.any(String),
      ["Fit Bloc (Kent Ridge)", "Climba"],
      expect.any(Object)
    );
  });

  it("treats all-filtered-out as no preferences", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Nonexistent Gym"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("at least 2 gyms"));
    expect(ctx.api.sendPoll).not.toHaveBeenCalled();
  });

  it("replies with setup prompt when only 1 gym saved", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Climba"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("at least 2 gyms")
    );
    expect(ctx.api.sendPoll).not.toHaveBeenCalled();
  });
});
