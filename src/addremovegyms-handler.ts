import { CommandContext, Context } from "grammy";
import { loadGymGroups } from "./gym-groups.js";
import {
  getGroupGyms,
  setGroupGyms,
  getAddgymState,
  setAddgymState,
  deleteAddgymState,
  getRemovegymState,
  setRemovegymState,
  deleteRemovegymState,
  AddgymState,
  RemovegymState,
} from "./kv.js";

// --- /addgym ---

export async function handleAddgym(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const groups = loadGymGroups();
  const existing = (await getGroupGyms(chatId)) ?? [];
  const existingSet = new Set(existing);

  const availableBrands = groups.filter((g) =>
    g.gyms.some((gym) => !existingSet.has(gym))
  );

  if (availableBrands.length === 0) {
    await ctx.reply("All available gyms are already added. Use /removegym to remove some.");
    return;
  }

  const state: AddgymState = {
    step: "brands",
    selectedBrands: [],
    selectedGyms: [],
    currentBrandIndex: 0,
    existingGyms: existing,
  };
  await setAddgymState(chatId, state);

  const keyboard = buildBrandKeyboard(availableBrands, state.selectedBrands);
  await ctx.reply("Select gym brands to add from:", {
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAddgymCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? "";
  const state = await getAddgymState(chatId);

  if (!state) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Session expired. Use /addgym to start again.");
    return;
  }

  if (data.startsWith("addgym:brand:")) {
    await handleAddBrandToggle(ctx, chatId, data, state);
  } else if (data === "addgym:next") {
    await handleAddBrandNext(ctx, chatId, state);
  } else if (data.startsWith("addgym:gym:")) {
    await handleAddGymToggle(ctx, chatId, data, state);
  } else if (data === "addgym:done") {
    await handleAddLocationDone(ctx, chatId, state);
  }
}

async function handleAddBrandToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: AddgymState
): Promise<void> {
  await ctx.answerCallbackQuery();
  const brand = data.replace("addgym:brand:", "");

  if (state.selectedBrands.includes(brand)) {
    state.selectedBrands = state.selectedBrands.filter((b) => b !== brand);
  } else {
    state.selectedBrands.push(brand);
  }

  await setAddgymState(chatId, state);

  const existingSet = new Set(state.existingGyms);
  const groups = loadGymGroups();
  const availableBrands = groups.filter((g) =>
    g.gyms.some((gym) => !existingSet.has(gym))
  );
  const keyboard = buildBrandKeyboard(availableBrands, state.selectedBrands);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleAddBrandNext(
  ctx: Context,
  chatId: number,
  state: AddgymState
): Promise<void> {
  if (state.selectedBrands.length === 0) {
    await ctx.answerCallbackQuery({ text: "Select at least one brand." });
    return;
  }

  await ctx.answerCallbackQuery();
  state.step = "locations";
  state.currentBrandIndex = 0;
  await setAddgymState(chatId, state);

  await sendAddLocationMessage(ctx, chatId, state);
}

async function handleAddGymToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: AddgymState
): Promise<void> {
  await ctx.answerCallbackQuery();
  const gym = data.replace("addgym:gym:", "");

  if (state.selectedGyms.includes(gym)) {
    state.selectedGyms = state.selectedGyms.filter((g) => g !== gym);
  } else {
    state.selectedGyms.push(gym);
  }

  await setAddgymState(chatId, state);

  const existingSet = new Set(state.existingGyms);
  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const availableGyms = group.gyms.filter((gym) => !existingSet.has(gym));
  const keyboard = buildLocationKeyboard(availableGyms, state.selectedGyms, "addgym");
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleAddLocationDone(
  ctx: Context,
  chatId: number,
  state: AddgymState
): Promise<void> {
  await ctx.answerCallbackQuery();
  state.currentBrandIndex++;

  if (state.currentBrandIndex < state.selectedBrands.length) {
    await setAddgymState(chatId, state);
    await sendAddLocationMessage(ctx, chatId, state);
  } else {
    await deleteAddgymState(chatId);

    if (state.selectedGyms.length === 0) {
      await ctx.editMessageText("No gyms selected. Use /addgym to try again.");
      return;
    }

    const updated = [...state.existingGyms, ...state.selectedGyms];
    await setGroupGyms(chatId, updated);
    const gymList = state.selectedGyms.join(", ");
    await ctx.editMessageText(`Added! New gyms:\n${gymList}`);
  }
}

async function sendAddLocationMessage(
  ctx: Context,
  chatId: number,
  state: AddgymState
): Promise<void> {
  const existingSet = new Set(state.existingGyms);
  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const availableGyms = group.gyms.filter((gym) => !existingSet.has(gym));
  const keyboard = buildLocationKeyboard(availableGyms, state.selectedGyms, "addgym");

  await ctx.editMessageText(`Select locations for ${brand}:`, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

// --- /removegym ---

export async function handleRemovegym(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const existing = (await getGroupGyms(chatId)) ?? [];

  if (existing.length === 0) {
    await ctx.reply("No gyms configured. Use /setgyms or /addgym first.");
    return;
  }

  const state: RemovegymState = {
    selectedGyms: [],
    existingGyms: existing,
  };
  await setRemovegymState(chatId, state);

  const keyboard = buildLocationKeyboard(existing, [], "removegym");
  await ctx.reply("Select gyms to remove:", {
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleRemovegymCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? "";
  const state = await getRemovegymState(chatId);

  if (!state) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Session expired. Use /removegym to start again.");
    return;
  }

  if (data.startsWith("removegym:gym:")) {
    await handleRemoveGymToggle(ctx, chatId, data, state);
  } else if (data === "removegym:done") {
    await handleRemoveDone(ctx, chatId, state);
  }
}

async function handleRemoveGymToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: RemovegymState
): Promise<void> {
  await ctx.answerCallbackQuery();
  const gym = data.replace("removegym:gym:", "");

  if (state.selectedGyms.includes(gym)) {
    state.selectedGyms = state.selectedGyms.filter((g) => g !== gym);
  } else {
    state.selectedGyms.push(gym);
  }

  await setRemovegymState(chatId, state);

  const keyboard = buildLocationKeyboard(state.existingGyms, state.selectedGyms, "removegym");
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleRemoveDone(
  ctx: Context,
  chatId: number,
  state: RemovegymState
): Promise<void> {
  await ctx.answerCallbackQuery();
  await deleteRemovegymState(chatId);

  if (state.selectedGyms.length === 0) {
    await ctx.editMessageText("No gyms removed.");
    return;
  }

  const removeSet = new Set(state.selectedGyms);
  const updated = state.existingGyms.filter((g) => !removeSet.has(g));
  await setGroupGyms(chatId, updated);
  const gymList = state.selectedGyms.join(", ");
  await ctx.editMessageText(`Removed!\n${gymList}`);
}

// --- Shared keyboard builders ---

function buildBrandKeyboard(
  groups: { brand: string }[],
  selected: string[]
): { text: string; callback_data: string }[][] {
  const rows = groups.map((g) => {
    const icon = selected.includes(g.brand) ? "☑" : "☐";
    return [{ text: `${icon} ${g.brand}`, callback_data: `addgym:brand:${g.brand}` }];
  });
  rows.push([{ text: "Next →", callback_data: "addgym:next" }]);
  return rows;
}

function buildLocationKeyboard(
  gyms: string[],
  selected: string[],
  prefix: "addgym" | "removegym"
): { text: string; callback_data: string }[][] {
  const rows = gyms.map((gym) => {
    const icon = selected.includes(gym) ? "☑" : "☐";
    return [{ text: `${icon} ${gym}`, callback_data: `${prefix}:gym:${gym}` }];
  });
  rows.push([{ text: "Done ✓", callback_data: `${prefix}:done` }]);
  return rows;
}
