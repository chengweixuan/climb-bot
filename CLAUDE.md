# Climb Bot

Telegram bot that helps a climbing group in Singapore coordinate weekly sessions. Deployed as a Vercel serverless function.

## Capabilities

- **Gym preferences** (`/setgyms`) — multi-step inline button flow for each group to choose which gyms they frequent.
- **Gym poll** (`/climbwhere`) — polls using the group's configured gyms. Splits into multiple polls if >10 options.
- **Availability poll** (`/climbwhen`) — asks which days people are free. Supports "this week" or "next week" via inline buttons.
- **Inspiration quotes** (`/inspire`) — sends a random climbing quote.
- **Info commands** (`/start`, `/info`, `/chatid`, `/gyms`) — help text and diagnostics.

## Architecture

```
api/
  webhook.ts            — Vercel serverless entry point (grammY webhookCallback)
src/
  bot.ts                — bot setup, command registration
  handlers.ts           — command handler implementations (climbwhen, inspire, info, gyms)
  climbwhere-handler.ts — /climbwhere poll using group preferences from KV
  setgyms-handler.ts    — /setgyms multi-step configuration flow
  gym-groups.ts         — groups gyms by brand for the selection UI
  kv.ts                 — Vercel KV (Upstash Redis) storage layer
  config.ts             — JSON file loaders
scripts/
  set-webhook.ts        — register/clear webhook URL with Telegram
```

Webhook architecture using grammY. Per-group gym preferences stored in Vercel KV (Upstash Redis).

## Data Files

| File | Purpose |
|------|---------|
| `gyms.json` | Full reference list of Singapore climbing gyms |
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
