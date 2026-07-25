# Climb Bot

Telegram bot that helps a climbing group in Singapore coordinate weekly sessions.

## Capabilities

- **Gym poll** (`/climbwhere`) — asks which gym to visit this week. Splits into multiple polls if >10 options.
- **Availability poll** (`/climbwhen`) — asks which days people are free. Supports "this week" or "next week" via inline buttons.
- **Inspiration quotes** (`/inspire`) — sends a random climbing quote. Also sent automatically on a daily schedule.
- **Scheduled poll** — automatically sends the gym poll weekly (default: Sunday 8pm SGT).
- **Info commands** (`/start`, `/info`, `/chatid`, `/gyms`) — help text and diagnostics.

## Architecture

```
src/climb_bot/
  main.py    — bot setup, command handlers, scheduling, poll logic
  config.py  — Settings dataclass, env loading, JSON file loaders
```

Single-module bot using `python-telegram-bot` (async) + `APScheduler`. No database — all state is in JSON files and environment variables.

## Data Files

| File | Purpose |
|------|---------|
| `gyms.json` | Full reference list of Singapore climbing gyms |
| `poll_gyms.json` | Subset of gyms included in the weekly poll |
| `inspiration_quotes.json` | Quotes pool for `/inspire` and auto-quotes |

## Configuration

All config via `.env` (loaded by python-dotenv):
- `TELEGRAM_BOT_TOKEN` — required
- `TELEGRAM_CHAT_ID` — target group chat (required for scheduled polls)
- `TIMEZONE`, `POLL_DAY_OF_WEEK`, `POLL_HOUR`, `POLL_MINUTE` — poll schedule
- `QUOTE_HOUR`, `QUOTE_MINUTE` — daily quote schedule

## Running

- `climb-bot` — start long-running bot with polling + scheduler
- `climb-bot-send-poll` — send one poll and exit (used by GitHub Action)

## Conventions

- Python 3.11+, setuptools build, editable install (`pip install -e .`)
- No tests yet — specs-driven development starting now
- Specs for new features go in `docs/specs/`
