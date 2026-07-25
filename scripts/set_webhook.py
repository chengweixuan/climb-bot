#!/usr/bin/env python3
"""Register a Telegram webhook URL for the bot.

Usage:
    python scripts/set_webhook.py https://your-app.vercel.app/api/webhook

To clear the webhook (revert to polling mode for local dev):
    python scripts/set_webhook.py --clear
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from telegram import Bot
from climb_bot.config import load_settings


async def set_webhook(url: str, secret: str | None) -> None:
    settings = load_settings()
    bot = Bot(settings.bot_token)

    async with bot:
        if url == "--clear":
            await bot.delete_webhook()
            print("Webhook cleared. Bot will not receive updates until a new webhook is set.")
        else:
            await bot.set_webhook(url=url, secret_token=secret)
            info = await bot.get_webhook_info()
            print(f"Webhook set to: {info.url}")
            print(f"Secret token: {'configured' if secret else 'none'}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    url = sys.argv[1]
    settings = load_settings()
    asyncio.run(set_webhook(url, settings.webhook_secret))


if __name__ == "__main__":
    main()
