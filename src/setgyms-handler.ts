import { CommandContext, Context } from "grammy";
import { loadGymGroups } from "./gym-groups.js";
import {
  getSetgymsState,
  setSetgymsState,
  deleteSetgymsState,
  setGroupGyms,
  SetgymsState,
} from "./kv.js";

export async function handleSetgyms(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const groups = loadGymGroups();

  const state: SetgymsState = {
    step: "brands",
    selectedBrands: [],
    selectedGyms: [],
    currentBrandIndex: 0,
  };
  await setSetgymsState(chatId, state);

  const keyboard = buildBrandKeyboard(groups, state.selectedBrands);
  await ctx.reply("Select gym brands your group frequents:", {
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleSetgymsCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? "";
  const state = await getSetgymsState(chatId);

  if (!state) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Session expired. Use /setgyms to start again.");
    return;
  }

  if (data.startsWith("setgyms:brand:")) {
    await handleBrandToggle(ctx, chatId, data, state);
  } else if (data === "setgyms:next") {
    await handleBrandNext(ctx, chatId, state);
  } else if (data.startsWith("setgyms:gym:")) {
    await handleGymToggle(ctx, chatId, data, state);
  } else if (data === "setgyms:done") {
    await handleLocationDone(ctx, chatId, state);
  }
}

async function handleBrandToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: SetgymsState
): Promise<void> {
  await ctx.answerCallbackQuery();
  const brand = data.replace("setgyms:brand:", "");

  if (state.selectedBrands.includes(brand)) {
    state.selectedBrands = state.selectedBrands.filter((b) => b !== brand);
  } else {
    state.selectedBrands.push(brand);
  }

  await setSetgymsState(chatId, state);

  const groups = loadGymGroups();
  const keyboard = buildBrandKeyboard(groups, state.selectedBrands);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleBrandNext(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  if (state.selectedBrands.length === 0) {
    await ctx.answerCallbackQuery({ text: "Select at least one brand." });
    return;
  }

  await ctx.answerCallbackQuery();
  state.step = "locations";
  state.currentBrandIndex = 0;
  await setSetgymsState(chatId, state);

  await sendLocationMessage(ctx, chatId, state);
}

async function handleGymToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: SetgymsState
): Promise<void> {
  await ctx.answerCallbackQuery();
  const gym = data.replace("setgyms:gym:", "");

  if (state.selectedGyms.includes(gym)) {
    state.selectedGyms = state.selectedGyms.filter((g) => g !== gym);
  } else {
    state.selectedGyms.push(gym);
  }

  await setSetgymsState(chatId, state);

  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const keyboard = buildLocationKeyboard(group.gyms, state.selectedGyms);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleLocationDone(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  await ctx.answerCallbackQuery();
  state.currentBrandIndex++;

  if (state.currentBrandIndex < state.selectedBrands.length) {
    await setSetgymsState(chatId, state);
    await sendLocationMessage(ctx, chatId, state);
  } else {
    await deleteSetgymsState(chatId);

    if (state.selectedGyms.length === 0) {
      await ctx.editMessageText("No gyms selected. Use /setgyms to try again.");
      return;
    }

    await setGroupGyms(chatId, state.selectedGyms);
    const gymList = state.selectedGyms.join(", ");
    await ctx.editMessageText(`Saved! Your group's gyms:\n${gymList}`);
  }
}

async function sendLocationMessage(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const keyboard = buildLocationKeyboard(group.gyms, state.selectedGyms);

  await ctx.editMessageText(`Select locations for ${brand}:`, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

function buildBrandKeyboard(
  groups: { brand: string }[],
  selected: string[]
): { text: string; callback_data: string }[][] {
  const rows = groups.map((g) => {
    const icon = selected.includes(g.brand) ? "☑" : "☐";
    return [{ text: `${icon} ${g.brand}`, callback_data: `setgyms:brand:${g.brand}` }];
  });
  rows.push([{ text: "Next →", callback_data: "setgyms:next" }]);
  return rows;
}

function buildLocationKeyboard(
  gyms: string[],
  selected: string[]
): { text: string; callback_data: string }[][] {
  const rows = gyms.map((gym) => {
    const icon = selected.includes(gym) ? "☑" : "☐";
    return [{ text: `${icon} ${gym}`, callback_data: `setgyms:gym:${gym}` }];
  });
  rows.push([{ text: "Done ✓", callback_data: "setgyms:done" }]);
  return rows;
}
