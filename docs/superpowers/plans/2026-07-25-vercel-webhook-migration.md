# Vercel Webhook Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long-polling Python bot with a Vercel serverless function that handles Telegram webhooks.

**Architecture:** A single Vercel Python serverless function (`api/webhook.py`) receives Telegram webhook POSTs, verifies the secret token, dispatches to command handlers, and returns HTTP 200. Handler logic is extracted into `src/climb_bot/handlers.py`. All scheduling code is removed.

**Tech Stack:** Python 3.11+, python-telegram-bot (async), Vercel Python runtime, python-dotenv

## Global Constraints

- Python >=3.11
- `python-telegram-bot>=21,<23`
- `python-dotenv>=1.0,<2`
- No APScheduler or any scheduling dependency
- No persistent process — each invocation is stateless
- JSON data files (`gyms.json`, `poll_gyms.json`, `inspiration_quotes.json`) remain at project root
- Vercel Python functions must export a handler that accepts `(request)` from `http.server.BaseHTTPRequestHandler` pattern — Vercel uses ASGI/WSGI-style handlers

---

### Task 1: Simplify config.py — Remove Scheduling Config

**Files:**
- Modify: `src/climb_bot/config.py`
- Test: `tests/test_config.py`

**Interfaces:**
- Consumes: environment variables `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- Produces: `Settings` dataclass with fields `bot_token: str`, `webhook_secret: str | None`; `load_settings() -> Settings`; `load_gym_options(path?) -> list[str]`; `load_all_gym_options(path?) -> list[str]`; `load_inspiration_quotes(path?) -> list[str]`

- [ ] **Step 1: Write failing test for simplified Settings**

```python
# tests/test_config.py
import os
from unittest.mock import patch
from climb_bot.config import Settings, load_settings


def test_load_settings_returns_bot_token_and_webhook_secret(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token-123")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "secret-abc")
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)

    settings = load_settings()

    assert settings.bot_token == "test-token-123"
    assert settings.webhook_secret == "secret-abc"


def test_load_settings_webhook_secret_optional(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token-123")
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)

    settings = load_settings()

    assert settings.bot_token == "test-token-123"
    assert settings.webhook_secret is None


def test_load_settings_missing_token_raises(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)

    import pytest
    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        load_settings()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_config.py -v`
Expected: FAIL (tests directory doesn't exist yet, or Settings has extra fields)

- [ ] **Step 3: Rewrite config.py — remove scheduler fields, add webhook_secret**

```python
# src/climb_bot/config.py
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GYMS_FILE = PROJECT_ROOT / "gyms.json"
POLL_GYMS_FILE = PROJECT_ROOT / "poll_gyms.json"
INSPIRATION_QUOTES_FILE = PROJECT_ROOT / "inspiration_quotes.json"
MAX_POLL_OPTION_LENGTH = 100


@dataclass(frozen=True)
class Settings:
    bot_token: str
    webhook_secret: str | None


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")

    bot_token = required_env("TELEGRAM_BOT_TOKEN")
    webhook_secret = os.getenv("TELEGRAM_WEBHOOK_SECRET") or None

    return Settings(bot_token=bot_token, webhook_secret=webhook_secret)


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_config.py -v`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/climb_bot/config.py tests/test_config.py
git commit -m "refactor: simplify config — remove scheduler fields, add webhook_secret"
```

---

### Task 2: Extract Command Handlers into handlers.py

**Files:**
- Create: `src/climb_bot/handlers.py`
- Test: `tests/test_handlers.py`

**Interfaces:**
- Consumes: `load_gym_options()`, `load_all_gym_options()`, `load_inspiration_quotes()` from `climb_bot.config`
- Produces:
  - `handle_info(bot: Bot, chat_id: int) -> None` — sends help text
  - `handle_chatid(bot: Bot, chat_id: int) -> None` — sends chat ID
  - `handle_gyms(bot: Bot, chat_id: int) -> None` — sends full gym list
  - `handle_climbwhere(bot: Bot, chat_id: int) -> None` — sends gym poll(s)
  - `handle_climbwhen(bot: Bot, chat_id: int) -> None` — sends inline keyboard
  - `handle_climbwhen_callback(bot: Bot, chat_id: int, callback_query_id: str, message_id: int, week: str) -> None` — edits message + sends availability poll
  - `handle_inspire(bot: Bot, chat_id: int) -> None` — sends random quote
  - `split_poll_options(options: list[str]) -> list[list[str]]`
  - `build_poll_question(question: str, index: int, total: int) -> str`

- [ ] **Step 1: Write failing tests for handlers**

```python
# tests/test_handlers.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from climb_bot.handlers import (
    handle_info,
    handle_chatid,
    handle_gyms,
    handle_climbwhere,
    handle_climbwhen,
    handle_climbwhen_callback,
    handle_inspire,
    split_poll_options,
    build_poll_question,
)


def test_split_poll_options_single_group():
    options = ["Gym A", "Gym B", "Gym C"]
    result = split_poll_options(options)
    assert result == [["Gym A", "Gym B", "Gym C"]]


def test_split_poll_options_multiple_groups():
    options = [f"Gym {i}" for i in range(12)]
    result = split_poll_options(options)
    assert len(result) == 2
    assert len(result[0]) == 10
    assert len(result[1]) == 2


def test_split_poll_options_avoids_single_item_last_group():
    options = [f"Gym {i}" for i in range(11)]
    result = split_poll_options(options)
    assert len(result) == 2
    assert len(result[0]) == 9
    assert len(result[1]) == 2


def test_build_poll_question_single():
    assert build_poll_question("Where?", 1, 1) == "Where?"


def test_build_poll_question_multi():
    assert build_poll_question("Where?", 2, 3) == "Where? (2/3)"


@pytest.mark.asyncio
async def test_handle_info_sends_help_text():
    bot = AsyncMock()
    await handle_info(bot, 123)
    bot.send_message.assert_called_once()
    args = bot.send_message.call_args
    assert args.kwargs["chat_id"] == 123
    assert "Commands" in args.kwargs["text"]


@pytest.mark.asyncio
async def test_handle_chatid_sends_chat_id():
    bot = AsyncMock()
    await handle_chatid(bot, 456)
    bot.send_message.assert_called_once()
    assert "456" in bot.send_message.call_args.kwargs["text"]


@pytest.mark.asyncio
async def test_handle_inspire_sends_a_quote():
    bot = AsyncMock()
    with patch("climb_bot.handlers.load_inspiration_quotes", return_value=["Test quote"]):
        await handle_inspire(bot, 123)
    bot.send_message.assert_called_once()
    assert bot.send_message.call_args.kwargs["text"] == "Test quote"


@pytest.mark.asyncio
async def test_handle_gyms_sends_gym_list():
    bot = AsyncMock()
    with patch("climb_bot.handlers.load_all_gym_options", return_value=["Gym A", "Gym B"]):
        await handle_gyms(bot, 123)
    bot.send_message.assert_called_once()
    text = bot.send_message.call_args.kwargs["text"]
    assert "Gym A" in text
    assert "Gym B" in text


@pytest.mark.asyncio
async def test_handle_climbwhere_sends_poll():
    bot = AsyncMock()
    with patch("climb_bot.handlers.load_gym_options", return_value=["Gym A", "Gym B", "Gym C"]):
        await handle_climbwhere(bot, 123)
    bot.send_poll.assert_called_once()
    call_kwargs = bot.send_poll.call_args.kwargs
    assert call_kwargs["chat_id"] == 123
    assert call_kwargs["options"] == ["Gym A", "Gym B", "Gym C"]


@pytest.mark.asyncio
async def test_handle_climbwhen_sends_inline_keyboard():
    bot = AsyncMock()
    await handle_climbwhen(bot, 123)
    bot.send_message.assert_called_once()
    call_kwargs = bot.send_message.call_args.kwargs
    assert call_kwargs["chat_id"] == 123
    assert call_kwargs["reply_markup"] is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_handlers.py -v`
Expected: FAIL — `climb_bot.handlers` does not exist

- [ ] **Step 3: Implement handlers.py**

```python
# src/climb_bot/handlers.py
from __future__ import annotations

import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

from climb_bot.config import load_all_gym_options, load_gym_options, load_inspiration_quotes


MAX_POLL_OPTIONS = 10
POLL_QUESTION = "Where are we climbing this week?"
CLIMB_WHEN_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "I can't make it this week :("]
CLIMB_WHEN_QUESTION = "Which days are you free to climb?"
TIMEZONE = ZoneInfo("Asia/Singapore")

INFO_TEXT = (
    "I help this group coordinate climbing plans.\n\n"
    "Commands:\n"
    "/info - show this help message\n"
    "/chatid - show this chat ID\n"
    "/gyms - list all known gyms\n"
    "/climbwhere - vote on where to climb\n"
    "/climbwhen - vote on which days people are free\n"
    "/inspire - receive questionable climbing wisdom"
)


async def handle_info(bot: Bot, chat_id: int) -> None:
    await bot.send_message(chat_id=chat_id, text=INFO_TEXT)


async def handle_chatid(bot: Bot, chat_id: int) -> None:
    await bot.send_message(chat_id=chat_id, text=f"Chat ID: {chat_id}")


async def handle_gyms(bot: Bot, chat_id: int) -> None:
    options = load_all_gym_options()
    text = "Gym options:\n" + "\n".join(f"- {option}" for option in options)
    await bot.send_message(chat_id=chat_id, text=text)


async def handle_climbwhere(bot: Bot, chat_id: int) -> None:
    options = load_gym_options()
    option_groups = split_poll_options(options)

    for index, group in enumerate(option_groups, start=1):
        await bot.send_poll(
            chat_id=chat_id,
            question=build_poll_question(POLL_QUESTION, index, len(option_groups)),
            options=group,
            is_anonymous=False,
            allows_multiple_answers=False,
        )


async def handle_climbwhen(bot: Bot, chat_id: int) -> None:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("This week", callback_data="climbwhen:this"),
            InlineKeyboardButton("Next week", callback_data="climbwhen:next"),
        ]
    ])
    await bot.send_message(
        chat_id=chat_id,
        text="Which week are you planning for?",
        reply_markup=keyboard,
    )


async def handle_climbwhen_callback(
    bot: Bot,
    chat_id: int,
    callback_query_id: str,
    message_id: int,
    week: str,
) -> None:
    await bot.answer_callback_query(callback_query_id)

    now = datetime.now(TIMEZONE)
    monday = now.date() - timedelta(days=now.weekday())

    if week == "next":
        monday += timedelta(days=7)

    sunday = monday + timedelta(days=6)
    week_label = f"{monday.strftime('%-d %b')} - {sunday.strftime('%-d %b')}"
    question = f"{CLIMB_WHEN_QUESTION} (Week of {week_label})"

    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=f"Poll posted for week of {week_label}",
    )
    await bot.send_poll(
        chat_id=chat_id,
        question=question,
        options=CLIMB_WHEN_OPTIONS,
        is_anonymous=False,
        allows_multiple_answers=True,
    )


async def handle_inspire(bot: Bot, chat_id: int) -> None:
    quote = random.choice(load_inspiration_quotes())
    await bot.send_message(chat_id=chat_id, text=quote)


def split_poll_options(options: list[str]) -> list[list[str]]:
    groups = [options[i : i + MAX_POLL_OPTIONS] for i in range(0, len(options), MAX_POLL_OPTIONS)]

    if len(groups) > 1 and len(groups[-1]) == 1:
        groups[-1].insert(0, groups[-2].pop())

    return groups


def build_poll_question(question: str, index: int, total: int) -> str:
    if total == 1:
        return question
    return f"{question} ({index}/{total})"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_handlers.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/climb_bot/handlers.py tests/test_handlers.py
git commit -m "feat: extract command handlers into handlers.py"
```

---

### Task 3: Create Webhook Entry Point (api/webhook.py)

**Files:**
- Create: `api/webhook.py`
- Test: `tests/test_webhook.py`

**Interfaces:**
- Consumes: `load_settings()` from `climb_bot.config`; all `handle_*` functions from `climb_bot.handlers`
- Produces: Vercel-compatible handler function — `async def handler(request: Request) -> Response` (using Vercel's Python ASGI convention via `from http.server import BaseHTTPRequestHandler` or the newer Starlette-style)

Note: Vercel Python runtime supports a function that takes a Starlette `Request` and returns a `Response` when using the `@app.route` pattern, or a simpler WSGI handler. We'll use the modern ASGI approach with a plain function.

- [ ] **Step 1: Write failing tests for webhook handler**

```python
# tests/test_webhook.py
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


def make_command_update(command: str, chat_id: int = 123) -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "date": 1700000000,
            "chat": {"id": chat_id, "type": "group"},
            "from": {"id": 1, "is_bot": False, "first_name": "Test"},
            "text": command,
            "entities": [{"type": "bot_command", "offset": 0, "length": len(command)}],
        },
    }


def make_callback_update(data: str, chat_id: int = 123, message_id: int = 10) -> dict:
    return {
        "update_id": 2,
        "callback_query": {
            "id": "cb-1",
            "from": {"id": 1, "is_bot": False, "first_name": "Test"},
            "chat_instance": "test",
            "data": data,
            "message": {
                "message_id": message_id,
                "date": 1700000000,
                "chat": {"id": chat_id, "type": "group"},
                "text": "Which week?",
            },
        },
    }


@pytest.mark.asyncio
async def test_webhook_rejects_missing_secret():
    from api.webhook import handler

    with patch("api.webhook.load_settings") as mock_settings:
        mock_settings.return_value = MagicMock(bot_token="tok", webhook_secret="my-secret")

        request = MagicMock()
        request.headers = {}
        request.method = "POST"

        response = await handler(request)
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_webhook_rejects_wrong_secret():
    from api.webhook import handler

    with patch("api.webhook.load_settings") as mock_settings:
        mock_settings.return_value = MagicMock(bot_token="tok", webhook_secret="my-secret")

        request = MagicMock()
        request.headers = {"x-telegram-bot-api-secret-token": "wrong"}
        request.method = "POST"

        response = await handler(request)
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_webhook_accepts_valid_secret_and_dispatches_command():
    from api.webhook import handler

    update_data = make_command_update("/chatid")

    with patch("api.webhook.load_settings") as mock_settings, \
         patch("api.webhook.handle_chatid", new_callable=AsyncMock) as mock_handler, \
         patch("api.webhook.Bot") as MockBot:
        mock_settings.return_value = MagicMock(bot_token="tok", webhook_secret="my-secret")
        MockBot.return_value = AsyncMock()

        request = MagicMock()
        request.headers = {"x-telegram-bot-api-secret-token": "my-secret"}
        request.method = "POST"
        request.body = json.dumps(update_data).encode()

        response = await handler(request)
        assert response.status_code == 200
        mock_handler.assert_called_once()


@pytest.mark.asyncio
async def test_webhook_no_secret_configured_allows_all():
    from api.webhook import handler

    update_data = make_command_update("/inspire")

    with patch("api.webhook.load_settings") as mock_settings, \
         patch("api.webhook.handle_inspire", new_callable=AsyncMock) as mock_handler, \
         patch("api.webhook.Bot") as MockBot:
        mock_settings.return_value = MagicMock(bot_token="tok", webhook_secret=None)
        MockBot.return_value = AsyncMock()

        request = MagicMock()
        request.headers = {}
        request.method = "POST"
        request.body = json.dumps(update_data).encode()

        response = await handler(request)
        assert response.status_code == 200
        mock_handler.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_webhook.py -v`
Expected: FAIL — `api.webhook` does not exist

- [ ] **Step 3: Implement api/webhook.py**

```python
# api/webhook.py
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Add src to path so Vercel can find climb_bot package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from telegram import Bot

from climb_bot.config import load_settings
from climb_bot.handlers import (
    handle_chatid,
    handle_climbwhen,
    handle_climbwhen_callback,
    handle_climbwhere,
    handle_gyms,
    handle_info,
    handle_inspire,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COMMAND_HANDLERS = {
    "/start": handle_info,
    "/info": handle_info,
    "/chatid": handle_chatid,
    "/gyms": handle_gyms,
    "/climbwhere": handle_climbwhere,
    "/climbwhen": handle_climbwhen,
    "/inspire": handle_inspire,
}


class Response:
    def __init__(self, status_code: int = 200, body: str = ""):
        self.status_code = status_code
        self.body = body


async def handler(request) -> Response:
    if request.method != "POST":
        return Response(status_code=405, body="Method not allowed")

    settings = load_settings()

    if settings.webhook_secret:
        token = request.headers.get("x-telegram-bot-api-secret-token", "")
        if token != settings.webhook_secret:
            return Response(status_code=401, body="Unauthorized")

    try:
        body = request.body if isinstance(request.body, bytes) else request.body.encode()
        update_data = json.loads(body)
    except (json.JSONDecodeError, AttributeError):
        return Response(status_code=400, body="Invalid JSON")

    try:
        bot = Bot(settings.bot_token)

        if "callback_query" in update_data:
            await dispatch_callback(bot, update_data["callback_query"])
        elif "message" in update_data:
            await dispatch_command(bot, update_data["message"])

    except Exception:
        logger.exception("Error handling update")

    return Response(status_code=200, body="ok")


async def dispatch_command(bot: Bot, message: dict) -> None:
    text = message.get("text", "")
    chat_id = message["chat"]["id"]

    command = text.split()[0].split("@")[0] if text else ""

    handler_fn = COMMAND_HANDLERS.get(command)
    if handler_fn:
        await handler_fn(bot, chat_id)


async def dispatch_callback(bot: Bot, callback_query: dict) -> None:
    data = callback_query.get("data", "")
    chat_id = callback_query["message"]["chat"]["id"]
    message_id = callback_query["message"]["message_id"]
    callback_query_id = callback_query["id"]

    if data.startswith("climbwhen:"):
        week = data.split(":")[1]
        await handle_climbwhen_callback(bot, chat_id, callback_query_id, message_id, week)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/test_webhook.py -v`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add api/webhook.py tests/test_webhook.py
git commit -m "feat: add Vercel webhook entry point with command dispatch"
```

---

### Task 4: Add Vercel Config and Requirements

**Files:**
- Create: `vercel.json`
- Create: `requirements.txt`
- Modify: `pyproject.toml` (remove APScheduler dep, add test deps)

**Interfaces:**
- Consumes: nothing
- Produces: Vercel deployment configuration, pip requirements for Vercel runtime

- [ ] **Step 1: Create vercel.json**

```json
{
  "builds": [{ "src": "api/webhook.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/api/webhook", "dest": "/api/webhook.py" }]
}
```

- [ ] **Step 2: Create requirements.txt**

```
python-telegram-bot>=21,<23
python-dotenv>=1.0,<2
```

- [ ] **Step 3: Update pyproject.toml — remove APScheduler, remove CLI entrypoints, add test deps**

```toml
[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[project]
name = "climb-bot"
version = "0.2.0"
description = "Telegram bot for climbing gym coordination — deployed on Vercel."
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "python-dotenv>=1.0,<2",
  "python-telegram-bot>=21,<23"
]

[project.optional-dependencies]
dev = [
  "pytest>=7",
  "pytest-asyncio>=0.21",
]

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 4: Install dev dependencies and verify pytest runs**

Run: `cd /Users/chengweixuan/personal/climb-bot && pip install -e ".[dev]" && python -m pytest tests/ -v`
Expected: All tests from Tasks 1-3 pass

- [ ] **Step 5: Commit**

```bash
git add vercel.json requirements.txt pyproject.toml
git commit -m "chore: add Vercel config, requirements.txt, update pyproject.toml"
```

---

### Task 5: Create Webhook Registration Script

**Files:**
- Create: `scripts/set_webhook.py`

**Interfaces:**
- Consumes: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` env vars (from `.env`); webhook URL as CLI argument
- Produces: Script that registers webhook URL with Telegram's `setWebhook` API

- [ ] **Step 1: Create scripts/set_webhook.py**

```python
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
```

- [ ] **Step 2: Verify script parses without errors**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -c "import ast; ast.parse(open('scripts/set_webhook.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/set_webhook.py
git commit -m "feat: add webhook registration script"
```

---

### Task 6: Remove Old Code and Clean Up

**Files:**
- Delete: `.github/workflows/weekly-climbing-poll.yml`
- Modify: `src/climb_bot/main.py` → delete entirely (replaced by `api/webhook.py` + `handlers.py`)
- Modify: `.env.example` — update to reflect new env vars
- Modify: `README.md` — update setup/usage instructions

**Interfaces:**
- Consumes: nothing
- Produces: Clean project without dead code

- [ ] **Step 1: Delete the GitHub Action workflow**

```bash
rm .github/workflows/weekly-climbing-poll.yml
rmdir .github/workflows .github 2>/dev/null || true
```

- [ ] **Step 2: Delete src/climb_bot/main.py**

```bash
rm src/climb_bot/main.py
```

- [ ] **Step 3: Update .env.example**

```env
# Required
TELEGRAM_BOT_TOKEN=your-bot-token-here

# Optional — secret token for webhook verification
TELEGRAM_WEBHOOK_SECRET=your-secret-here
```

- [ ] **Step 4: Update README.md**

```markdown
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
```

- [ ] **Step 5: Update src/climb_bot/__init__.py if it imports from main**

Check and clear the `__init__.py` if needed:

```python
# src/climb_bot/__init__.py
```

- [ ] **Step 6: Run full test suite to confirm nothing is broken**

Run: `cd /Users/chengweixuan/personal/climb-bot && python -m pytest tests/ -v`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove polling mode, scheduler, GitHub Action — webhook only"
```

---

### Task 7: End-to-End Verification with ngrok

**Files:** None (manual verification)

**Interfaces:**
- Consumes: deployed webhook (local via ngrok or on Vercel)
- Produces: confirmation that all commands work

- [ ] **Step 1: Start ngrok tunnel**

```bash
ngrok http 8000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`).

- [ ] **Step 2: Register webhook with ngrok URL**

```bash
python scripts/set_webhook.py https://abc123.ngrok.io/api/webhook
```

- [ ] **Step 3: Run the function locally (simulating Vercel)**

For local testing, create a small test server:

```bash
python -c "
import asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, sys
sys.path.insert(0, 'src')
sys.path.insert(0, '.')
from api.webhook import handler

class Request:
    def __init__(self, method, headers, body):
        self.method = method
        self.headers = headers
        self.body = body

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        headers = {k.lower(): v for k, v in self.headers.items()}
        req = Request('POST', headers, body)
        resp = asyncio.run(handler(req))
        self.send_response(resp.status_code)
        self.end_headers()
        self.wfile.write(resp.body.encode())

print('Listening on :8000')
HTTPServer(('', 8000), Handler).serve_forever()
"
```

- [ ] **Step 4: Test each command in Telegram**

In your Telegram group, send each command and verify:
- `/start` → help text appears
- `/info` → help text appears
- `/chatid` → shows the chat ID
- `/gyms` → lists all gyms from gyms.json
- `/climbwhere` → poll(s) appear
- `/climbwhen` → inline buttons appear; pressing one sends the availability poll
- `/inspire` → random quote appears

- [ ] **Step 5: Clear webhook when done testing locally**

```bash
python scripts/set_webhook.py --clear
```

---
