import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/kv.js", () => ({
  getGroupGyms: vi.fn(),
  setGroupGyms: vi.fn(),
  getAddgymState: vi.fn(),
  setAddgymState: vi.fn(),
  deleteAddgymState: vi.fn(),
  getRemovegymState: vi.fn(),
  setRemovegymState: vi.fn(),
  deleteRemovegymState: vi.fn(),
}));

vi.mock("../src/gym-groups.js", () => ({
  loadGymGroups: vi.fn(() => [
    { brand: "Boulder Movement", gyms: ["Boulder Movement (Bugis+)", "Boulder Movement (Tai Seng)"] },
    { brand: "Fit Bloc", gyms: ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"] },
    { brand: "Other", gyms: ["Ark Bloc", "Climba"] },
  ]),
}));

import {
  getGroupGyms,
  setGroupGyms,
  getAddgymState,
  setAddgymState,
  deleteAddgymState,
  getRemovegymState,
  setRemovegymState,
  deleteRemovegymState,
} from "../src/kv.js";
import {
  handleAddgym,
  handleAddgymCallback,
  handleRemovegym,
  handleRemovegymCallback,
} from "../src/addremovegyms-handler.js";

const mockedGetGroupGyms = vi.mocked(getGroupGyms);
const mockedSetGroupGyms = vi.mocked(setGroupGyms);
const mockedGetAddState = vi.mocked(getAddgymState);
const mockedSetAddState = vi.mocked(setAddgymState);
const mockedDeleteAddState = vi.mocked(deleteAddgymState);
const mockedGetRemoveState = vi.mocked(getRemovegymState);
const mockedSetRemoveState = vi.mocked(setRemovegymState);
const mockedDeleteRemoveState = vi.mocked(deleteRemovegymState);

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
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- /addgym ---

describe("handleAddgym", () => {
  it("shows brand selection with only brands that have unadded gyms", async () => {
    mockedGetGroupGyms.mockResolvedValue([
      "Boulder Movement (Bugis+)",
      "Boulder Movement (Tai Seng)",
    ]);

    const ctx = createCommandCtx();
    await handleAddgym(ctx);

    const call = ctx.reply.mock.calls[0];
    expect(call[0]).toContain("Select gym brands to add from");
    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).not.toContain("☐ Boulder Movement");
    expect(buttonTexts).toContain("☐ Fit Bloc");
    expect(buttonTexts).toContain("☐ Other");
  });

  it("replies with message when all gyms already added", async () => {
    mockedGetGroupGyms.mockResolvedValue([
      "Boulder Movement (Bugis+)", "Boulder Movement (Tai Seng)",
      "Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)",
      "Ark Bloc", "Climba",
    ]);

    const ctx = createCommandCtx();
    await handleAddgym(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("All available gyms are already added. Use /removegym to remove some.");
    expect(mockedSetAddState).not.toHaveBeenCalled();
  });

  it("shows all brands when no gyms configured yet", async () => {
    mockedGetGroupGyms.mockResolvedValue(null);

    const ctx = createCommandCtx();
    await handleAddgym(ctx);

    const call = ctx.reply.mock.calls[0];
    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).toContain("☐ Boulder Movement");
    expect(buttonTexts).toContain("☐ Fit Bloc");
    expect(buttonTexts).toContain("☐ Other");
  });
});

describe("handleAddgymCallback — brand toggle", () => {
  it("adds brand to selectedBrands", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: [],
    });

    const ctx = createCallbackCtx("addgym:brand:Fit Bloc");
    await handleAddgymCallback(ctx);

    expect(mockedSetAddState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: ["Fit Bloc"],
    }));
  });

  it("removes brand on second toggle", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: [],
    });

    const ctx = createCallbackCtx("addgym:brand:Fit Bloc");
    await handleAddgymCallback(ctx);

    expect(mockedSetAddState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: [],
    }));
  });
});

describe("handleAddgymCallback — next", () => {
  it("transitions to locations step showing only unadded gyms", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Boulder Movement"],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: ["Boulder Movement (Bugis+)"],
    });

    const ctx = createCallbackCtx("addgym:next");
    await handleAddgymCallback(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Boulder Movement:",
      expect.any(Object)
    );
    const call = ctx.editMessageText.mock.calls[0];
    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).toContain("☐ Boulder Movement (Tai Seng)");
    expect(buttonTexts).not.toContain("☐ Boulder Movement (Bugis+)");
  });

  it("rejects when no brands selected", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: [],
    });

    const ctx = createCallbackCtx("addgym:next");
    await handleAddgymCallback(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: "Select at least one brand." });
    expect(mockedSetAddState).not.toHaveBeenCalled();
  });
});

describe("handleAddgymCallback — gym toggle", () => {
  it("adds gym to selectedGyms", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: [],
    });

    const ctx = createCallbackCtx("addgym:gym:Fit Bloc (Kent Ridge)");
    await handleAddgymCallback(ctx);

    expect(mockedSetAddState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedGyms: ["Fit Bloc (Kent Ridge)"],
    }));
  });
});

describe("handleAddgymCallback — done", () => {
  it("moves to next brand when more brands remain", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Boulder Movement", "Fit Bloc"],
      selectedGyms: ["Boulder Movement (Tai Seng)"],
      currentBrandIndex: 0,
      existingGyms: [],
    });

    const ctx = createCallbackCtx("addgym:done");
    await handleAddgymCallback(ctx);

    expect(mockedSetAddState).toHaveBeenCalledWith(789, expect.objectContaining({
      currentBrandIndex: 1,
    }));
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Fit Bloc:",
      expect.any(Object)
    );
  });

  it("appends selected gyms to existing list on final done", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: ["Fit Bloc (Kent Ridge)"],
      currentBrandIndex: 0,
      existingGyms: ["Ark Bloc"],
    });

    const ctx = createCallbackCtx("addgym:done");
    await handleAddgymCallback(ctx);

    expect(mockedDeleteAddState).toHaveBeenCalledWith(789);
    expect(mockedSetGroupGyms).toHaveBeenCalledWith(789, ["Ark Bloc", "Fit Bloc (Kent Ridge)"]);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("Added!"));
  });

  it("shows message when no gyms selected on final done", async () => {
    mockedGetAddState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
      existingGyms: ["Ark Bloc"],
    });

    const ctx = createCallbackCtx("addgym:done");
    await handleAddgymCallback(ctx);

    expect(mockedDeleteAddState).toHaveBeenCalledWith(789);
    expect(ctx.editMessageText).toHaveBeenCalledWith("No gyms selected. Use /addgym to try again.");
    expect(mockedSetGroupGyms).not.toHaveBeenCalled();
  });

  it("handles expired session", async () => {
    mockedGetAddState.mockResolvedValue(null);
    const ctx = createCallbackCtx("addgym:done");
    await handleAddgymCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("expired"));
  });
});

// --- /removegym ---

describe("handleRemovegym", () => {
  it("shows current gyms as checkboxes", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Ark Bloc", "Fit Bloc (Kent Ridge)"]);

    const ctx = createCommandCtx();
    await handleRemovegym(ctx);

    const call = ctx.reply.mock.calls[0];
    expect(call[0]).toContain("Select gyms to remove");
    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).toContain("☐ Ark Bloc");
    expect(buttonTexts).toContain("☐ Fit Bloc (Kent Ridge)");
    expect(buttonTexts).toContain("Done ✓");
  });

  it("replies with message when no gyms configured", async () => {
    mockedGetGroupGyms.mockResolvedValue(null);

    const ctx = createCommandCtx();
    await handleRemovegym(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("No gyms configured. Use /setgyms or /addgym first.");
    expect(mockedSetRemoveState).not.toHaveBeenCalled();
  });

  it("replies with message when gym list is empty array", async () => {
    mockedGetGroupGyms.mockResolvedValue([]);

    const ctx = createCommandCtx();
    await handleRemovegym(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("No gyms configured. Use /setgyms or /addgym first.");
  });
});

describe("handleRemovegymCallback — gym toggle", () => {
  it("adds gym to removal list", async () => {
    mockedGetRemoveState.mockResolvedValue({
      selectedGyms: [],
      existingGyms: ["Ark Bloc", "Fit Bloc (Kent Ridge)"],
    });

    const ctx = createCallbackCtx("removegym:gym:Ark Bloc");
    await handleRemovegymCallback(ctx);

    expect(mockedSetRemoveState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedGyms: ["Ark Bloc"],
    }));
  });

  it("removes gym from removal list on second toggle", async () => {
    mockedGetRemoveState.mockResolvedValue({
      selectedGyms: ["Ark Bloc"],
      existingGyms: ["Ark Bloc", "Fit Bloc (Kent Ridge)"],
    });

    const ctx = createCallbackCtx("removegym:gym:Ark Bloc");
    await handleRemovegymCallback(ctx);

    expect(mockedSetRemoveState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedGyms: [],
    }));
  });
});

describe("handleRemovegymCallback — done", () => {
  it("removes selected gyms from group list", async () => {
    mockedGetRemoveState.mockResolvedValue({
      selectedGyms: ["Ark Bloc"],
      existingGyms: ["Ark Bloc", "Fit Bloc (Kent Ridge)"],
    });

    const ctx = createCallbackCtx("removegym:done");
    await handleRemovegymCallback(ctx);

    expect(mockedDeleteRemoveState).toHaveBeenCalledWith(789);
    expect(mockedSetGroupGyms).toHaveBeenCalledWith(789, ["Fit Bloc (Kent Ridge)"]);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("Removed!"));
  });

  it("shows message when no gyms selected for removal", async () => {
    mockedGetRemoveState.mockResolvedValue({
      selectedGyms: [],
      existingGyms: ["Ark Bloc"],
    });

    const ctx = createCallbackCtx("removegym:done");
    await handleRemovegymCallback(ctx);

    expect(mockedDeleteRemoveState).toHaveBeenCalledWith(789);
    expect(ctx.editMessageText).toHaveBeenCalledWith("No gyms removed.");
    expect(mockedSetGroupGyms).not.toHaveBeenCalled();
  });

  it("handles expired session", async () => {
    mockedGetRemoveState.mockResolvedValue(null);
    const ctx = createCallbackCtx("removegym:done");
    await handleRemovegymCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("expired"));
  });
});
