# Spec: Migrate to Vercel Webhook

**Date:** 2026-07-25
**Status:** Draft

## Summary

Migrate climb-bot from a long-polling Python process to a Vercel Python serverless function receiving Telegram webhooks. Remove all scheduled functionality. The bot becomes purely reactive — it only responds to commands.

## Scope

### What changes

- Bot switches from long-polling to Telegram webhook mode
- Deployed as a Vercel Python serverless function (`api/webhook.py`)
- Remove APScheduler, scheduled poll, and daily quote functionality
- Remove `climb-bot` and `climb-bot-send-poll` CLI entrypoints
- Remove `.github/workflows/weekly-climbing-poll.yml`

### What stays the same

- All 7 interactive commands behave identically
- JSON data files (`gyms.json`, `poll_gyms.json`, `inspiration_quotes.json`) unchanged
- Bot token configured via environment variable (now in Vercel dashboard)

### Success criteria

- All commands respond correctly when triggered from Telegram
- Callback queries for `/climbwhen` inline buttons work
- Bot deploys automatically on push to main
- No persistent process needed

## Architecture

```
GitHub repo → Vercel auto-deploy → HTTPS endpoint
Telegram → POST /api/webhook → parse update → dispatch command → reply via Telegram API
```

### Project structure

```
api/
  webhook.py              ← Vercel serverless function entry point
src/climb_bot/
  handlers.py             ← command handler functions (extracted from main.py)
  config.py               ← Settings + JSON loaders (simplified, no scheduler config)
gyms.json
poll_gyms.json
inspiration_quotes.json
scripts/
  set_webhook.py          ← utility to register webhook URL with Telegram
vercel.json               ← Vercel config (Python runtime, routes)
requirements.txt          ← dependencies for Vercel deployment
pyproject.toml            ← kept for local dev (pip install -e .)
```

### Removed

- `APScheduler` dependency
- `post_init` / `post_shutdown` / `scheduled_poll` / `scheduled_inspiration`
- `climb-bot` / `climb-bot-send-poll` entrypoints
- `.github/workflows/weekly-climbing-poll.yml`

## Webhook Setup & Deployment

### Telegram webhook registration

- One-time setup: call Telegram's `setWebhook` API with the Vercel URL
- URL pattern: `https://<your-app>.vercel.app/api/webhook`
- Utility script `scripts/set_webhook.py` handles this
- A secret token (`TELEGRAM_WEBHOOK_SECRET`) is passed in `setWebhook` and verified on each inbound request

### Vercel configuration

```json
{
  "builds": [{ "src": "api/webhook.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/api/webhook", "dest": "/api/webhook.py" }]
}
```

### Environment variables (Vercel dashboard)

- `TELEGRAM_BOT_TOKEN` — required
- `TELEGRAM_WEBHOOK_SECRET` — secret token to verify inbound requests from Telegram

Note: `TELEGRAM_CHAT_ID` is no longer needed. Scheduled sends (which targeted a specific chat) are removed. Interactive commands reply to whatever chat sent the message.

### Deploy flow

1. Connect GitHub repo to Vercel (one-time, via Vercel dashboard)
2. Set environment variables in Vercel dashboard
3. Push to main → auto-deploys
4. Run `scripts/set_webhook.py` to register the URL with Telegram

### Local development

- Use ngrok or similar tunnel to expose localhost
- Set webhook to ngrok URL for testing
- Or: a local test script that simulates webhook POSTs for unit testing

## Request Handling Flow

1. Telegram POSTs JSON update to `/api/webhook`
2. `webhook.py` verifies the `X-Telegram-Bot-Api-Secret-Token` header matches `TELEGRAM_WEBHOOK_SECRET`
3. Parses JSON into a `python-telegram-bot` Update object
4. Checks if it's a command message or callback query — dispatches to matching handler
5. Handler calls Telegram API to send reply
6. Returns HTTP 200 to Telegram

### Handler mapping

| Command | Handler | Behavior |
|---------|---------|----------|
| `/start`, `/info` | `handle_info` | Reply with help text |
| `/chatid` | `handle_chatid` | Reply with chat ID |
| `/gyms` | `handle_gyms` | Reply with full gym list |
| `/climbwhere` | `handle_climbwhere` | Send gym poll(s) |
| `/climbwhen` | `handle_climbwhen` | Send inline keyboard (this/next week) |
| `/inspire` | `handle_inspire` | Reply with random quote |

### Callback queries

- `/climbwhen` sends inline buttons → Telegram sends a callback query on button press
- Webhook handles callback queries with data `climbwhen:this` / `climbwhen:next` → sends availability poll for the selected week

### Error handling

- If a handler throws, log the error and return HTTP 200 (prevents Telegram from retrying the same failed message indefinitely)
- Errors are visible in Vercel function logs

## Dependencies

### Production (requirements.txt)

- `python-telegram-bot>=21,<23`
- `python-dotenv>=1.0,<2`

### Removed

- `APScheduler` — no longer needed

## Out of Scope

- Scheduled polls or daily quotes (removed, may be re-added as a future spec)
- TypeScript rewrite (separate spec)
- Database or persistent state
