# Climb Bot

A Telegram bot that helps climbing groups in Singapore coordinate weekly sessions. Each group configures which gyms they frequent, and the bot creates polls from that list. Deployed as a serverless function on Vercel with Upstash Redis for storage.

## Bot Commands

| Command | Description |
|---------|-------------|
| `/setgyms` | Choose which gyms your group frequents (multi-step inline buttons) |
| `/climbwhere` | Poll: where are we climbing this week? (uses group's configured gyms) |
| `/climbwhen` | Poll: which days are people free? (this week or next week) |
| `/gyms` | List all known climbing gyms in Singapore |
| `/inspire` | Random climbing quote |
| `/info` | Show help message |
| `/chatid` | Print the current chat ID |

## How It Works

1. A group member runs `/setgyms` to pick gyms from categorized brands (Boulder Movement, Fit Bloc, etc.)
2. Selections are saved per-group in Upstash Redis
3. `/climbwhere` creates a poll with only those gyms (splits into multiple polls if >10)

## Setup

### 1. Create the bot

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts.
3. Copy the bot token.

### 2. Deploy to Vercel

1. Fork/push this repo to GitHub.
2. Connect the repo to [Vercel](https://vercel.com).
3. Add [Upstash Redis](https://vercel.com/marketplace) from the Vercel marketplace.
4. Set environment variables in Vercel dashboard:
   - `TELEGRAM_BOT_TOKEN` — your bot token from BotFather
   - `TELEGRAM_WEBHOOK_SECRET` — any random string (used to verify requests from Telegram)
   - `KV_REST_API_URL` — Upstash Redis REST endpoint (auto-set if using Vercel marketplace)
   - `KV_REST_API_TOKEN` — Upstash Redis auth token (auto-set if using Vercel marketplace)

### 3. Register the webhook

```bash
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET
npm run set-webhook -- https://your-app.vercel.app/api/webhook
```

### 4. Add the bot to your group

Add the bot to a Telegram group. Run `/setgyms` to configure gym preferences, then use `/climbwhere` to create polls.

## Gym Data

`gyms.json` is the full Singapore climbing gym reference list. Gyms are grouped by brand for the `/setgyms` selection UI:

- Boulder Movement (4 locations)
- Boulder Planet (2 locations)
- Boulder Plus (2 locations)
- BFF Climb (3 locations)
- Climb Central (4 locations)
- Fit Bloc (3 locations)
- Other (10 single-location gyms)

To add a new gym, add an entry to `gyms.json`. It will automatically appear in `/setgyms` under the appropriate brand (or "Other" if it doesn't match a known brand prefix).

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your bot token and KV credentials

# Run tests
npm test

# Type check
npx tsc --noEmit

# Use ngrok to test webhook locally
ngrok http 3000
npm run set-webhook -- https://your-ngrok-url.ngrok.io/api/webhook
npx vercel dev
```
