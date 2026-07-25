# Spec: TypeScript Rewrite

**Date:** 2026-07-25
**Status:** Approved

## Summary

Rewrite climb-bot from Python to TypeScript, deployed on Vercel with grammY as the Telegram bot framework.

## Rationale

The webhook migration (previous spec) exposed friction in Vercel's Python runtime:
- Requires `BaseHTTPRequestHandler` class pattern — awkward for async Telegram bot logic
- Needs `asyncio.run()` bridging between sync handler and async bot calls
- `sys.path.insert` hacks to resolve the `src/` package from `api/`
- Python is not Vercel's first-class runtime — TypeScript is

Additionally:
- The developer's primary language is TypeScript
- grammY provides `webhookCallback(bot, "https")` — a single line that produces a Vercel-compatible handler, eliminating all dispatch/routing boilerplate
- TypeScript's type system catches more errors at dev time
- Vercel natively transpiles `.ts` files in `api/` — zero build config

## Scope

### What changes

- Complete language rewrite: Python → TypeScript
- Bot framework: `python-telegram-bot` → `grammY`
- Project tooling: `pyproject.toml` + pytest → `package.json` + vitest
- Entry point: `BaseHTTPRequestHandler` class → `webhookCallback(bot, "https")` default export

### What stays the same

- All 7 interactive commands with identical behavior
- JSON data files unchanged (`gyms.json`, `poll_gyms.json`, `inspiration_quotes.json`)
- Vercel deployment target
- Environment variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`)
- Webhook registration script functionality

### Success criteria

- All commands respond identically to the Python version
- Callback queries for `/climbwhen` inline buttons work
- Unit tests pass (`npm test`)
- Bot deploys automatically on push to main
- Webhook secret verification works

## Out of Scope

- New features (this is a pure language port)
- Database or persistent state
- Scheduled functionality (removed in previous spec)
