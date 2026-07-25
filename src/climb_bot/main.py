from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes

from climb_bot.config import Settings, load_all_gym_options, load_gym_options, load_inspiration_quotes, load_settings


MAX_POLL_OPTIONS = 10
CLIMB_WHEN_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "I can't make it this week :("]
CLIMB_WHEN_QUESTION = "Which days are you free to climb?"

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(build_info_message(context.application.bot_data["settings"]))


async def info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(build_info_message(context.application.bot_data["settings"]))


def build_info_message(settings: Settings) -> str:
    quote_schedule = f"Automatic quotes: daily at {settings.quote_hour:02d}:{settings.quote_minute:02d}"

    return (
        "I help this group coordinate climbing plans.\n\n"
        "Commands:\n"
        "/info - show this help message\n"
        "/chatid - show this chat ID\n"
        "/gyms - list all known gyms\n"
        "/climbwhere - vote on where to climb\n"
        "/climbwhen - vote on which days people are free\n"
        "/inspire - receive questionable climbing wisdom\n\n"
        "Automatic behavior:\n"
        f"- Weekly gym poll: {settings.poll_day_of_week} {settings.poll_hour:02d}:{settings.poll_minute:02d} {settings.timezone.key}\n"
        f"- {quote_schedule}"
    )


async def chat_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    await update.message.reply_text(f"Chat ID: {chat.id}")


async def gyms(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    options = load_all_gym_options()
    await update.message.reply_text("Gym options:\n" + "\n".join(f"- {option}" for option in options))


async def poll(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings: Settings = context.application.bot_data["settings"]
    await send_climbing_poll(context.application.bot, update.effective_chat.id, settings)


async def climb_when(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("This week", callback_data="climbwhen:this"),
            InlineKeyboardButton("Next week", callback_data="climbwhen:next"),
        ]
    ])
    await update.message.reply_text("Which week are you planning for?", reply_markup=keyboard)


async def climb_when_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    settings: Settings = context.application.bot_data["settings"]
    now = datetime.now(settings.timezone)
    monday = now.date() - timedelta(days=now.weekday())

    if query.data == "climbwhen:next":
        monday += timedelta(days=7)

    sunday = monday + timedelta(days=6)
    week_label = f"{monday.strftime('%-d %b')} - {sunday.strftime('%-d %b')}"
    question = f"{CLIMB_WHEN_QUESTION} (Week of {week_label})"

    await query.edit_message_text(f"Poll posted for week of {week_label}")
    await context.application.bot.send_poll(
        chat_id=query.message.chat_id,
        question=question,
        options=CLIMB_WHEN_OPTIONS,
        is_anonymous=False,
        allows_multiple_answers=True,
    )
    logger.info("Sent climb-when poll for week of %s to chat %s", week_label, query.message.chat_id)


async def inspire(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(random_inspiration_quote())


def random_inspiration_quote() -> str:
    return random.choice(load_inspiration_quotes())


async def send_climbing_poll(bot: Bot, chat_id: int, settings: Settings) -> None:
    options = load_gym_options()
    option_groups = split_poll_options(options)

    for index, group in enumerate(option_groups, start=1):
        await bot.send_poll(
            chat_id=chat_id,
            question=build_poll_question(settings.poll_question, index, len(option_groups)),
            options=group,
            is_anonymous=False,
            allows_multiple_answers=False,
        )

    logger.info("Sent %s climbing poll(s) to chat %s", len(option_groups), chat_id)


def split_poll_options(options: list[str]) -> list[list[str]]:
    groups = [options[index : index + MAX_POLL_OPTIONS] for index in range(0, len(options), MAX_POLL_OPTIONS)]

    if len(groups) > 1 and len(groups[-1]) == 1:
        groups[-1].insert(0, groups[-2].pop())

    return groups


def build_poll_question(question: str, index: int, total: int) -> str:
    if total == 1:
        return question
    return f"{question} ({index}/{total})"


async def scheduled_poll(application: Application) -> None:
    settings: Settings = application.bot_data["settings"]
    if settings.chat_id is None:
        logger.info("Skipping scheduled poll because TELEGRAM_CHAT_ID is not set")
        return

    await send_climbing_poll(application.bot, settings.chat_id, settings)


async def scheduled_inspiration(application: Application) -> None:
    settings: Settings = application.bot_data["settings"]
    if settings.chat_id is None:
        logger.info("Skipping scheduled inspiration because TELEGRAM_CHAT_ID is not set")
        return

    await application.bot.send_message(chat_id=settings.chat_id, text=random_inspiration_quote())
    logger.info("Sent scheduled inspiration to chat %s", settings.chat_id)


async def post_init(application: Application) -> None:
    settings: Settings = application.bot_data["settings"]

    scheduler = AsyncIOScheduler(timezone=settings.timezone)
    scheduler.add_job(
        scheduled_poll,
        "cron",
        args=[application],
        day_of_week=settings.poll_day_of_week,
        hour=settings.poll_hour,
        minute=settings.poll_minute,
        id="weekly_climbing_poll",
        replace_existing=True,
    )

    scheduler.add_job(
        scheduled_inspiration,
        "cron",
        args=[application],
        hour=settings.quote_hour,
        minute=settings.quote_minute,
        id="scheduled_inspiration",
        replace_existing=True,
    )

    scheduler.start()
    application.bot_data["scheduler"] = scheduler

    logger.info(
        "Scheduled poll for %s %02d:%02d %s",
        settings.poll_day_of_week,
        settings.poll_hour,
        settings.poll_minute,
        settings.timezone.key,
    )

    logger.info(
        "Scheduled inspiration daily at %02d:%02d %s",
        settings.quote_hour,
        settings.quote_minute,
        settings.timezone.key,
    )


async def post_shutdown(application: Application) -> None:
    scheduler = application.bot_data.get("scheduler")
    if scheduler is not None:
        scheduler.shutdown(wait=False)


def build_application(settings: Settings) -> Application:
    application = (
        Application.builder()
        .token(settings.bot_token)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    application.bot_data["settings"] = settings
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("info", info))
    application.add_handler(CommandHandler("chatid", chat_id))
    application.add_handler(CommandHandler("gyms", gyms))
    application.add_handler(CommandHandler("climbwhere", poll))
    application.add_handler(CommandHandler("climbwhen", climb_when))
    application.add_handler(CallbackQueryHandler(climb_when_callback, pattern=r"^climbwhen:"))
    application.add_handler(CommandHandler("inspire", inspire))
    return application


def main() -> None:
    settings = load_settings()
    application = build_application(settings)
    application.run_polling(allowed_updates=Update.ALL_TYPES)


async def send_poll_once_async(settings: Settings) -> None:
    if settings.chat_id is None:
        raise RuntimeError("Missing required environment variable: TELEGRAM_CHAT_ID")

    async with Bot(settings.bot_token) as bot:
        await send_climbing_poll(bot, settings.chat_id, settings)


def send_poll_once() -> None:
    settings = load_settings()
    asyncio.run(send_poll_once_async(settings))


if __name__ == "__main__":
    main()
