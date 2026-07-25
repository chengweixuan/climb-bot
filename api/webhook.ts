import { webhookCallback } from "grammy";
import { bot } from "../src/bot.js";

const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

export default webhookCallback(bot, "next-js", {
  secretToken,
});
