import { CommandContext, Context } from "grammy";
import { getGroupGyms } from "./kv.js";
import { loadAllGymOptions } from "./config.js";
import { splitPollOptions, buildPollQuestion } from "./handlers.js";

const POLL_QUESTION = "Where are we climbing this week?";

export async function handleClimbwhere2(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const saved = await getGroupGyms(chatId);

  if (!saved) {
    await ctx.reply("No gyms configured yet — use /setgyms to pick your group's gyms first.");
    return;
  }

  const allGyms = new Set(loadAllGymOptions());
  const validGyms = saved.filter((gym) => allGyms.has(gym));

  if (validGyms.length < 2) {
    await ctx.reply("You need at least 2 gyms for a poll — use /setgyms to add more.");
    return;
  }

  const groups = splitPollOptions(validGyms);
  for (let i = 0; i < groups.length; i++) {
    await ctx.api.sendPoll(
      chatId,
      buildPollQuestion(POLL_QUESTION, i + 1, groups.length),
      groups[i],
      { is_anonymous: false, allows_multiple_answers: false }
    );
  }
}
