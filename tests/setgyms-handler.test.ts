import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/kv.js", () => ({
  getSetgymsState: vi.fn(),
  setSetgymsState: vi.fn(),
  deleteSetgymsState: vi.fn(),
  setGroupGyms: vi.fn(),
}));

vi.mock("../src/gym-groups.js", () => ({
  loadGymGroups: vi.fn(() => [
    { brand: "Boulder Movement", gyms: ["Boulder Movement (Bugis+)", "Boulder Movement (Tai Seng)"] },
    { brand: "Fit Bloc", gyms: ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"] },
    { brand: "Other", gyms: ["Ark Bloc", "Climba"] },
  ]),
}));

import { getSetgymsState, setSetgymsState, deleteSetgymsState, setGroupGyms } from "../src/kv.js";
import { handleSetgyms, handleSetgymsCallback } from "../src/setgyms-handler.js";

const mockedGetState = vi.mocked(getSetgymsState);
const mockedSetState = vi.mocked(setSetgymsState);
const mockedDeleteState = vi.mocked(deleteSetgymsState);
const mockedSetGroupGyms = vi.mocked(setGroupGyms);

function createCommandCtx() {
  return {
    chat: { id: 789 },
    reply: vi.fn(),
  } as any;
}

function createCallbackCtx(data: string) {
  return {
    chat: { id: 789 },
    callbackQuery: { data },
    answerCallbackQuery: vi.fn(),
    editMessageText: vi.fn(),
    editMessageReplyMarkup: vi.fn(),
    reply: vi.fn(),
    api: { editMessageReplyMarkup: vi.fn() },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleSetgyms", () => {
  it("sends brand selection message with inline keyboard", async () => {
    const ctx = createCommandCtx();
    await handleSetgyms(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const call = ctx.reply.mock.calls[0];
    expect(call[0]).toContain("Select gym brands");

    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).toContain("☐ Boulder Movement");
    expect(buttonTexts).toContain("☐ Fit Bloc");
    expect(buttonTexts).toContain("☐ Other");
    expect(buttonTexts).toContain("Next →");
  });

  it("initializes setgyms state in KV", async () => {
    const ctx = createCommandCtx();
    await handleSetgyms(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, {
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
    });
  });
});

describe("handleSetgymsCallback — brand toggle", () => {
  it("adds brand to selectedBrands on toggle", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:brand:Boulder Movement");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: ["Boulder Movement"],
    }));
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
  });

  it("removes brand from selectedBrands on second toggle", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Boulder Movement"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:brand:Boulder Movement");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: [],
    }));
  });
});

describe("handleSetgymsCallback — next", () => {
  it("transitions to locations step", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:next");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      step: "locations",
      currentBrandIndex: 0,
    }));
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Fit Bloc:",
      expect.any(Object)
    );
  });

  it("shows validation toast and does not transition when no brands selected", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:next");
    await handleSetgymsCallback(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: "Select at least one brand." });
    expect(mockedSetState).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });
});

describe("handleSetgymsCallback — gym toggle", () => {
  it("adds gym to selectedGyms", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:gym:Fit Bloc (Kent Ridge)");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedGyms: ["Fit Bloc (Kent Ridge)"],
    }));
  });
});

describe("handleSetgymsCallback — done", () => {
  it("moves to next brand when more brands remain", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Boulder Movement", "Other"],
      selectedGyms: ["Boulder Movement (Bugis+)"],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      currentBrandIndex: 1,
    }));
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Other:",
      expect.any(Object)
    );
  });

  it("saves gyms and shows confirmation on final done", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);

    expect(mockedDeleteState).toHaveBeenCalledWith(789);
    expect(mockedSetGroupGyms).toHaveBeenCalledWith(789, ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"]);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining("Saved!")
    );
  });

  it("handles expired session gracefully", async () => {
    mockedGetState.mockResolvedValue(null);
    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("expired"));
  });
});
