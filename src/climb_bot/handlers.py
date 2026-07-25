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
