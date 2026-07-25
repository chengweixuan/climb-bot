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
    monkeypatch.setattr("climb_bot.config.load_dotenv", lambda *a, **kw: None)

    import pytest
    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        load_settings()
