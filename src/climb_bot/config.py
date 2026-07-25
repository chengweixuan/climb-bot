from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GYMS_FILE = PROJECT_ROOT / "gyms.json"
POLL_GYMS_FILE = PROJECT_ROOT / "poll_gyms.json"
INSPIRATION_QUOTES_FILE = PROJECT_ROOT / "inspiration_quotes.json"
MAX_POLL_OPTION_LENGTH = 100


@dataclass(frozen=True)
class Settings:
    bot_token: str
    chat_id: int | None
    timezone: ZoneInfo
    poll_question: str
    poll_day_of_week: str
    poll_hour: int
    poll_minute: int
    quote_hour: int
    quote_minute: int


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")

    bot_token = required_env("TELEGRAM_BOT_TOKEN")
    chat_id = optional_int_env("TELEGRAM_CHAT_ID")

    return Settings(
        bot_token=bot_token,
        chat_id=chat_id,
        timezone=ZoneInfo(os.getenv("TIMEZONE", "Asia/Singapore")),
        poll_question=os.getenv("POLL_QUESTION", "Where are we climbing this week?"),
        poll_day_of_week=os.getenv("POLL_DAY_OF_WEEK", "sun"),
        poll_hour=int(os.getenv("POLL_HOUR", "20")),
        poll_minute=int(os.getenv("POLL_MINUTE", "0")),
        quote_hour=int(os.getenv("QUOTE_HOUR", "12")),
        quote_minute=int(os.getenv("QUOTE_MINUTE", "0")),
    )


def load_gym_options(path: Path = POLL_GYMS_FILE) -> list[str]:
    options = load_gym_names(path)

    if len(options) < 2:
        raise ValueError("Telegram polls need at least two enabled gym options.")

    too_long_options = [option for option in options if len(option) > MAX_POLL_OPTION_LENGTH]
    if too_long_options:
        raise ValueError("Telegram poll options must be 100 characters or fewer.")

    return options


def load_all_gym_options(path: Path = GYMS_FILE) -> list[str]:
    return load_gym_names(path)


def load_gym_names(path: Path) -> list[str]:
    with path.open() as file:
        gyms = json.load(file)

    options = [
        gym["name"].strip()
        for gym in gyms
        if gym.get("enabled", True) and gym.get("name", "").strip()
    ]

    return options


def load_inspiration_quotes(path: Path = INSPIRATION_QUOTES_FILE) -> list[str]:
    with path.open() as file:
        quotes = json.load(file)

    options = [quote.strip() for quote in quotes if isinstance(quote, str) and quote.strip()]

    if not options:
        raise ValueError("inspiration_quotes.json needs at least one quote.")

    return options


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def optional_int_env(name: str) -> int | None:
    value = os.getenv(name)
    if not value:
        return None
    return int(value)
