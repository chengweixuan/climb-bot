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
  webhook.ts       — Vercel serverless entry point (grammY webhookCallback)
src/
  bot.ts           — bot setup, command registration
  handlers.ts      — command handler implementations
  config.ts        — JSON file loaders
scripts/
  set-webhook.ts   — register/clear webhook URL with Telegram
```

Stateless webhook architecture using grammY. No database, no persistent process — each request is handled independently.

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
- `KV_REST_API_URL` — Vercel KV endpoint (set automatically by Vercel KV integration)
- `KV_REST_API_TOKEN` — Vercel KV auth token (set automatically by Vercel KV integration)

## Running Tests

```bash
npm test           # vitest
npx tsc --noEmit   # type check
```

## Conventions

- TypeScript, ESM-style imports, strict mode
- grammY as Telegram bot framework
- vitest for unit tests
- Specs for new features go in `docs/specs/`
- Implementation plans go in `docs/superpowers/plans/`
