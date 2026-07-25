/**
 * Register or clear the Telegram webhook URL.
 *
 * Usage:
 *   npx tsx scripts/set-webhook.ts https://your-app.vercel.app/api/webhook
 *   npx tsx scripts/set-webhook.ts --clear
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  console.error("Set it in .env or export it before running this script.");
  process.exit(1);
}

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/set-webhook.ts <url>");
  console.error("       npx tsx scripts/set-webhook.ts --clear");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function main() {
  if (url === "--clear") {
    const res = await fetch(`${API_BASE}/deleteWebhook`);
    const data = await res.json();
    if (data.ok) {
      console.log("Webhook cleared.");
    } else {
      console.error("Failed to clear webhook:", data.description);
      process.exit(1);
    }
  } else {
    const params: Record<string, string> = { url };
    if (WEBHOOK_SECRET) {
      params.secret_token = WEBHOOK_SECRET;
    }

    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();

    if (data.ok) {
      console.log(`Webhook set to: ${url}`);
      console.log(`Secret token: ${WEBHOOK_SECRET ? "configured" : "none"}`);
    } else {
      console.error("Failed to set webhook:", data.description);
      process.exit(1);
    }
  }
}

main();
