import { webhookCallback } from "grammy";
import { bot } from "../src/bot";

const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

export default webhookCallback(bot, "std/http", {
  secretToken,
});
