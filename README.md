# Climb Bot

A small Telegram bot that sends a weekly poll asking which climbing gym the group wants to visit.

## How Telegram bot creation works

Telegram bots are created through Telegram's official bot called `@BotFather`.

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Pick a display name and username for the bot.
4. BotFather gives you a bot token.
5. Put that token in `.env` as `TELEGRAM_BOT_TOKEN`.
6. Add the bot to your Telegram group.
7. Run `/chatid` in the group to get the group chat ID.
8. Put that ID in `.env` as `TELEGRAM_CHAT_ID`.

The bot token is effectively the bot's password. Do not commit it to git or share it publicly.

## Local setup

```bash
cd ~/personal/climb-bot
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

Edit `.env` and replace `TELEGRAM_BOT_TOKEN`.

Then run:

```bash
climb-bot
```

To send one poll and exit:

```bash
climb-bot-send-poll
```

## Bot commands

- `/start` - show a short help message
- `/info` - show what the bot does and list its commands
- `/chatid` - print the current chat ID
- `/gyms` - list all known gyms from `gyms.json`
- `/climbwhere` - send the climbing poll immediately
- `/climbwhen` - send a multiple-choice availability poll for Monday through Sunday
- `/inspire` - send a random climbing quote

## Gym options

Edit `poll_gyms.json` to choose which gyms appear in the poll:

```json
[
  { "name": "Gym A", "enabled": true },
  { "name": "Gym B", "enabled": true }
]
```

Only enabled gyms are included in the poll. `gyms.json` is kept as the full Singapore gym reference list.

Telegram polls allow up to 10 options. If `poll_gyms.json` has more than 10 enabled gyms, the bot sends numbered polls like `(1/3)`, `(2/3)`, and `(3/3)`.

## Inspiration quotes

Edit `inspiration_quotes.json` to change the annoying inspirational climbing quotes used by `/inspire`.

Set `QUOTE_INTERVAL_MINUTES` in `.env` to make the bot automatically send quotes to `TELEGRAM_CHAT_ID`. Use `0` to disable automatic quotes.

## Weekly schedule

The default schedule is Sunday 8:00pm Singapore time:

```env
TIMEZONE=Asia/Singapore
POLL_DAY_OF_WEEK=sun
POLL_HOUR=20
POLL_MINUTE=0
```

The scheduled poll only runs if `TELEGRAM_CHAT_ID` is set.

## GitHub Action

`.github/workflows/weekly-climbing-poll.yml` sends the Telegram poll every Sunday at 8:00pm Singapore time. It can also be run manually from the GitHub Actions tab.

Set these repository secrets before enabling it:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
