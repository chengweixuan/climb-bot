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
