import { Bot } from "grammy";
import {
  handleChatid,
  handleClimbwhen,
  handleClimbwhenCallback,
  handleGyms,
  handleInfo,
  handleInspire,
} from "./handlers.js";
import { handleSetgyms, handleSetgymsCallback } from "./setgyms-handler.js";
import { handleClimbwhere } from "./climbwhere-handler.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");

export const bot = new Bot(token);

bot.command("start", handleInfo);
bot.command("info", handleInfo);
bot.command("chatid", handleChatid);
bot.command("gyms", handleGyms);
bot.command("climbwhere", handleClimbwhere);
bot.command("climbwhen", handleClimbwhen);
bot.command("setgyms", handleSetgyms);
bot.command("inspire", handleInspire);

bot.callbackQuery(/^climbwhen:/, handleClimbwhenCallback);
bot.callbackQuery(/^setgyms:/, handleSetgymsCallback);
