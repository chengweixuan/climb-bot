# Climb Bot

Telegram bot that helps a climbing group in Singapore coordinate weekly sessions. Deployed as a Vercel serverless function.

## Capabilities

- **Gym poll** (`/climbwhere`) — asks which gym to visit this week. Splits into multiple polls if >10 options.
- **Availability poll** (`/climbwhen`) — asks which days people are free. Supports "this week" or "next week" via inline buttons.
- **Inspiration quotes** (`/inspire`) — sends a random climbing quote.
- **Info commands** (`/start`, `/info`, `/chatid`, `/gyms`) — help text and diagnostics.

## Architecture

```
api/
  webhook.py       — Vercel serverless entry point, receives Telegram webhook POSTs
src/climb_bot/
  handlers.py      — command handler functions
  config.py        — Settings dataclass, env loading, JSON file loaders
scripts/
  set_webhook.py   — utility to register/clear webhook URL with Telegram
```

Stateless webhook architecture using `python-telegram-bot` (async). No database, no persistent process — each request is handled independently.

## Data Files

| File | Purpose |
|------|---------|
| `gyms.json` | Full reference list of Singapore climbing gyms |
| `poll_gyms.json` | Subset of gyms included in the weekly poll |
| `inspiration_quotes.json` | Quotes pool for `/inspire` |

## Configuration

Environment variables (set in Vercel dashboard for production, `.env` for local dev):
- `TELEGRAM_BOT_TOKEN` — required
- `TELEGRAM_WEBHOOK_SECRET` — optional, verifies inbound requests from Telegram

## Running Tests

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

## Conventions

- Python 3.11+, setuptools build, editable install (`pip install -e .`)
- TDD — tests in `tests/`, run with pytest
- Specs for new features go in `docs/specs/`
- Implementation plans go in `docs/superpowers/plans/`
