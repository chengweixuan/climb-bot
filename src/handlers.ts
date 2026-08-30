import { CommandContext, Context } from "grammy";
import { loadAllGymOptions, loadInspirationQuotes } from "./config.js";

const MAX_POLL_OPTIONS = 10;
const CLIMB_WHEN_OPTIONS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "I can't make it this week :(",
];
const CLIMB_WHEN_QUESTION = "Which days are you free to climb?";

const INFO_TEXT = `I help this group coordinate climbing plans.

Commands:
/info - show this help message
/chatid - show this chat ID
/gyms - list all known gyms
/setgyms - choose which gyms your group frequents
/addgym - add gyms to your group's list
/removegym - remove gyms from your group's list
/climbwhere - vote on where to climb (group's gyms)
/climbwhen - vote on which days people are free
/inspire - receive questionable climbing wisdom`;

export async function handleInfo(ctx: CommandContext<Context>): Promise<void> {
  await ctx.reply(INFO_TEXT);
}

export async function handleChatid(
  ctx: CommandContext<Context>
): Promise<void> {
  await ctx.reply(`Chat ID: ${ctx.chat.id}`);
}

export async function handleGyms(ctx: CommandContext<Context>): Promise<void> {
  const options = loadAllGymOptions();
  const text = "Gym options:\n" + options.map((o) => `- ${o}`).join("\n");
  await ctx.reply(text);
}

export async function handleClimbwhen(
  ctx: CommandContext<Context>
): Promise<void> {
  await ctx.reply("Which week are you planning for?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "This week", callback_data: "climbwhen:this" },
          { text: "Next week", callback_data: "climbwhen:next" },
        ],
      ],
    },
  });
}

export async function handleClimbwhenCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const data = ctx.callbackQuery?.data ?? "";
  const week = data.split(":")[1];

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  if (week === "next") {
    monday.setDate(monday.getDate() + 7);
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekLabel = `${formatDate(monday)} - ${formatDate(sunday)}`;
  const question = `${CLIMB_WHEN_QUESTION} (Week of ${weekLabel})`;

  await ctx.editMessageText(`Poll posted for week of ${weekLabel}`);
  await ctx.api.sendPoll(ctx.chat!.id, question, CLIMB_WHEN_OPTIONS, {
    is_anonymous: false,
    allows_multiple_answers: true,
  });
}

export async function handleInspire(
  ctx: CommandContext<Context>
): Promise<void> {
  const quotes = loadInspirationQuotes();
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  await ctx.reply(quote);
}

export function splitPollOptions(options: string[]): string[][] {
  const groups: string[][] = [];
  for (let i = 0; i < options.length; i += MAX_POLL_OPTIONS) {
    groups.push(options.slice(i, i + MAX_POLL_OPTIONS));
  }

  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    const last = groups[groups.length - 1];
    const secondLast = groups[groups.length - 2];
    last.unshift(secondLast.pop()!);
  }

  return groups;
}

export function buildPollQuestion(
  question: string,
  index: number,
  total: number
): string {
  if (total === 1) return question;
  return `${question} (${index}/${total})`;
}

function formatDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}
