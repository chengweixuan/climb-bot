# Climb Bot

A Telegram bot that helps a climbing group coordinate weekly sessions. Deployed as a serverless function on Vercel.

## Setup

### 1. Create the bot

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts.
3. Copy the bot token.

### 2. Deploy to Vercel

1. Fork/push this repo to GitHub.
2. Connect the repo to [Vercel](https://vercel.com).
3. Set environment variables in Vercel dashboard:
   - `TELEGRAM_BOT_TOKEN` — your bot token from BotFather
   - `TELEGRAM_WEBHOOK_SECRET` — any random string (used to verify requests from Telegram)

### 3. Register the webhook

```bash
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET
python scripts/set_webhook.py https://your-app.vercel.app/api/webhook
```

### 4. Add the bot to your group

Add the bot to a Telegram group. It will respond to commands immediately.

## Bot commands

- `/start` — show help message
- `/info` — show what the bot does and list commands
- `/chatid` — print the current chat ID
- `/gyms` — list all known gyms from `gyms.json`
- `/climbwhere` — send the climbing gym poll
- `/climbwhen` — send availability poll (choose this week or next week)
- `/inspire` — send a random climbing quote

## Gym options

Edit `poll_gyms.json` to choose which gyms appear in the poll. Only enabled gyms are included. `gyms.json` is the full Singapore gym reference list.

Telegram polls allow up to 10 options. If more than 10 are enabled, the bot sends numbered polls.

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env with your bot token

# Run tests
pytest tests/ -v

# Use ngrok to test webhook locally
ngrok http 8000
python scripts/set_webhook.py https://your-ngrok-url.ngrok.io/api/webhook
```
