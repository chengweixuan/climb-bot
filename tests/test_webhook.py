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


@pytest.mark.asyncio
async def test_webhook_dispatches_callback_query():
    from api.webhook import handler

    update_data = make_callback_update("climbwhen:next", chat_id=789, message_id=42)

    with patch("api.webhook.load_settings") as mock_settings, \
         patch("api.webhook.handle_climbwhen_callback", new_callable=AsyncMock) as mock_handler, \
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
        call_kwargs_or_args = mock_handler.call_args
        assert call_kwargs_or_args[0][1] == 789  # chat_id
        assert call_kwargs_or_args[0][3] == 42   # message_id
        assert call_kwargs_or_args[0][4] == "next"  # week


@pytest.mark.asyncio
async def test_webhook_returns_405_on_get():
    from api.webhook import handler

    with patch("api.webhook.load_settings") as mock_settings:
        mock_settings.return_value = MagicMock(bot_token="tok", webhook_secret=None)

        request = MagicMock()
        request.method = "GET"

        response = await handler(request)
        assert response.status_code == 405
