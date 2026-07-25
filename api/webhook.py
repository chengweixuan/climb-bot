from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

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

COMMAND_HANDLER_NAMES = {
    "/start": "handle_info",
    "/info": "handle_info",
    "/chatid": "handle_chatid",
    "/gyms": "handle_gyms",
    "/climbwhere": "handle_climbwhere",
    "/climbwhen": "handle_climbwhen",
    "/inspire": "handle_inspire",
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


import sys as _sys


async def dispatch_command(bot: Bot, message: dict) -> None:
    text = message.get("text", "")
    chat_id = message["chat"]["id"]

    command = text.split()[0].split("@")[0] if text else ""

    handler_name = COMMAND_HANDLER_NAMES.get(command)
    if handler_name:
        _module = _sys.modules[__name__]
        handler_fn = getattr(_module, handler_name)
        await handler_fn(bot, chat_id)


async def dispatch_callback(bot: Bot, callback_query: dict) -> None:
    data = callback_query.get("data", "")
    chat_id = callback_query["message"]["chat"]["id"]
    message_id = callback_query["message"]["message_id"]
    callback_query_id = callback_query["id"]

    if data.startswith("climbwhen:"):
        week = data.split(":")[1]
        _module = _sys.modules[__name__]
        _handler = getattr(_module, "handle_climbwhen_callback")
        await _handler(bot, chat_id, callback_query_id, message_id, week)
