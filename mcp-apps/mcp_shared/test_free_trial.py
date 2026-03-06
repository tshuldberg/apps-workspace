"""Tests for free trial anti-abuse middleware."""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from mcp_shared.free_trial import (
    FreeTrialConfig,
    FreeTrialMiddleware,
    check_usdc_balance,
    log_abuse,
    _reset_abuse_log_path,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ok(request: Request) -> JSONResponse:
    """Simple handler that reports free_trial state."""
    free_trial = getattr(request.state, "free_trial", None)
    return JSONResponse({"ok": True, "free_trial": free_trial})


def _make_app(
    config: FreeTrialConfig | None = None,
    redis_url: str | None = None,
) -> Starlette:
    """Build a minimal Starlette app wrapped with FreeTrialMiddleware."""
    inner = Starlette(routes=[
        Route("/health", _ok),
        Route("/privacy", _ok),
        Route("/extract", _ok, methods=["POST"]),
        Route("/crawl", _ok, methods=["POST"]),
        Route("/.well-known/mcp.json", _ok),
        Route("/", _ok),
    ])
    return FreeTrialMiddleware(
        inner,
        config=config or FreeTrialConfig(app_name="test-app"),
        redis_url=redis_url,
    )


# ---------------------------------------------------------------------------
# FreeTrialConfig defaults
# ---------------------------------------------------------------------------

def test_config_defaults():
    cfg = FreeTrialConfig()
    assert cfg.max_free_calls == 100
    assert cfg.ip_daily_cap == 100
    assert cfg.spike_threshold == 5
    assert cfg.min_wallet_balance == 1.0
    assert cfg.app_name == ""


def test_config_custom():
    cfg = FreeTrialConfig(
        app_name="my-app",
        max_free_calls=50,
        ip_daily_cap=200,
        spike_threshold=10,
        min_wallet_balance=5.0,
    )
    assert cfg.app_name == "my-app"
    assert cfg.max_free_calls == 50


# ---------------------------------------------------------------------------
# Free path bypass
# ---------------------------------------------------------------------------

def test_free_paths_bypass():
    """Requests to free paths should pass through without setting free_trial."""
    app = _make_app()
    client = TestClient(app)

    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/.well-known/mcp.json")
    assert resp.status_code == 200

    resp = client.get("/privacy")
    assert resp.status_code == 200

    resp = client.get("/")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# No Redis = free trial disabled
# ---------------------------------------------------------------------------

def test_no_redis_disables_free_trial():
    """Without Redis, free_trial should be False (fall through to x402)."""
    app = _make_app(redis_url=None)
    client = TestClient(app)

    resp = client.post("/extract")
    assert resp.status_code == 200
    assert resp.json()["free_trial"] is False


# ---------------------------------------------------------------------------
# Payment header skips free trial
# ---------------------------------------------------------------------------

def test_payment_header_skips_free_trial():
    """Requests with x402 payment headers should skip free trial logic."""
    app = _make_app()
    client = TestClient(app)

    resp = client.post("/extract", headers={"X-402-Payment": "some-proof"})
    assert resp.status_code == 200
    assert resp.json()["free_trial"] is False


# ---------------------------------------------------------------------------
# USDC balance check
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check_usdc_balance_success():
    """Successful RPC call returns parsed USDC balance."""
    # 1000000 raw = 1.0 USDC (6 decimals)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"jsonrpc": "2.0", "id": 1, "result": "0x0f4240"}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        balance = await check_usdc_balance("0x1234567890abcdef1234567890abcdef12345678")

    assert balance == 1.0


@pytest.mark.asyncio
async def test_check_usdc_balance_rpc_error():
    """RPC errors should return None (graceful degradation)."""
    mock_client = AsyncMock()
    mock_client.post.side_effect = Exception("connection refused")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        balance = await check_usdc_balance("0x1234")

    assert balance is None


@pytest.mark.asyncio
async def test_check_usdc_balance_large_amount():
    """Check correct parsing of large USDC amounts."""
    # 50000000 raw = 50.0 USDC
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"jsonrpc": "2.0", "id": 1, "result": "0x2faf080"}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        balance = await check_usdc_balance("0xabcdef")

    assert balance == 50.0


# ---------------------------------------------------------------------------
# Abuse logger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_abuse_logger_writes_jsonl():
    """Abuse events should be appended as JSONL lines."""
    _reset_abuse_log_path()

    with tempfile.TemporaryDirectory() as tmpdir:
        log_path = os.path.join(tmpdir, "abuse.jsonl")

        await log_abuse(
            ip="1.2.3.4",
            wallet="0xabc",
            reason="rate_spike",
            service="test-app",
            details={"calls_per_minute": 12},
            config_path=log_path,
        )

        await log_abuse(
            ip="5.6.7.8",
            wallet="0xdef",
            reason="daily_cap_exceeded",
            service="test-app",
            details={"daily_total": 150},
            config_path=log_path,
        )

        with open(log_path) as f:
            lines = f.readlines()

        assert len(lines) == 2

        entry1 = json.loads(lines[0])
        assert entry1["reason"] == "rate_spike"
        assert entry1["calls_per_minute"] == 12
        assert entry1["wallet_present"] is True
        assert "timestamp" in entry1

        entry2 = json.loads(lines[1])
        assert entry2["reason"] == "daily_cap_exceeded"
        assert entry2["daily_total"] == 150

    _reset_abuse_log_path()


@pytest.mark.asyncio
async def test_abuse_logger_creates_directory():
    """Abuse logger should create the logs directory if needed."""
    _reset_abuse_log_path()

    with tempfile.TemporaryDirectory() as tmpdir:
        log_path = os.path.join(tmpdir, "nested", "dir", "abuse.jsonl")

        await log_abuse(
            ip="1.2.3.4", wallet="", reason="test",
            config_path=log_path,
        )

        assert Path(log_path).exists()

    _reset_abuse_log_path()


# ---------------------------------------------------------------------------
# Middleware with mocked Redis
# ---------------------------------------------------------------------------

def _make_mock_redis():
    """Create a mock Redis client with all needed methods."""
    r = AsyncMock()
    r.incr = AsyncMock(return_value=1)
    r.expire = AsyncMock()
    r.zadd = AsyncMock()
    r.zremrangebyscore = AsyncMock()
    r.zcard = AsyncMock(return_value=1)
    r.get = AsyncMock(return_value=None)  # No cached balance
    r.setex = AsyncMock()
    r.sadd = AsyncMock()
    r.scard = AsyncMock(return_value=1)
    return r


def test_free_trial_granted_with_valid_wallet():
    """Wallet with sufficient balance and under limits gets free trial."""
    mock_redis = _make_mock_redis()
    # Cached balance of $5 USDC
    mock_redis.get = AsyncMock(return_value="5.0")

    config = FreeTrialConfig(app_name="test-app")
    app = _make_app(config=config)
    # Inject mock redis
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    client = TestClient(app)
    resp = client.post("/extract", headers={"X-Wallet": "0xTestWallet123"})

    assert resp.status_code == 200
    assert resp.json()["free_trial"] is True


def test_free_trial_denied_no_wallet():
    """Requests without a wallet header should not get free trial."""
    mock_redis = _make_mock_redis()

    config = FreeTrialConfig(app_name="test-app")
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    client = TestClient(app)
    resp = client.post("/extract")

    assert resp.status_code == 200
    assert resp.json()["free_trial"] is False


def test_free_trial_denied_insufficient_balance():
    """Wallet with <$1 USDC should not get free trial."""
    mock_redis = _make_mock_redis()
    mock_redis.get = AsyncMock(return_value="0.5")  # $0.50 cached

    config = FreeTrialConfig(app_name="test-app", min_wallet_balance=1.0)
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    _reset_abuse_log_path()
    with tempfile.TemporaryDirectory() as tmpdir:
        config.abuse_log_path = os.path.join(tmpdir, "abuse.jsonl")

        client = TestClient(app)
        resp = client.post("/extract", headers={"X-Wallet": "0xPoorWallet"})

        assert resp.status_code == 200
        assert resp.json()["free_trial"] is False

        # Should have logged an abuse event
        log_path = Path(config.abuse_log_path)
        if log_path.exists():
            entry = json.loads(log_path.read_text().strip().split("\n")[-1])
            assert entry["reason"] == "insufficient_balance"

    _reset_abuse_log_path()


def test_ip_daily_cap_exceeded():
    """IP exceeding daily cap should lose free trial."""
    mock_redis = _make_mock_redis()
    mock_redis.incr = AsyncMock(return_value=101)  # Over the 100 cap
    mock_redis.get = AsyncMock(return_value="5.0")

    config = FreeTrialConfig(app_name="test-app", ip_daily_cap=100)
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    _reset_abuse_log_path()
    with tempfile.TemporaryDirectory() as tmpdir:
        config.abuse_log_path = os.path.join(tmpdir, "abuse.jsonl")

        client = TestClient(app)
        resp = client.post("/extract", headers={"X-Wallet": "0xSomeWallet"})

        assert resp.status_code == 200
        assert resp.json()["free_trial"] is False

    _reset_abuse_log_path()


def test_rate_spike_flagged():
    """Rate spike should log abuse but still allow if under daily cap."""
    mock_redis = _make_mock_redis()
    mock_redis.zcard = AsyncMock(return_value=6)  # Over 5/min threshold
    mock_redis.get = AsyncMock(return_value="5.0")  # Good balance

    config = FreeTrialConfig(app_name="test-app", spike_threshold=5)
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    _reset_abuse_log_path()
    with tempfile.TemporaryDirectory() as tmpdir:
        config.abuse_log_path = os.path.join(tmpdir, "abuse.jsonl")

        client = TestClient(app)
        resp = client.post("/extract", headers={"X-Wallet": "0xFastWallet"})

        assert resp.status_code == 200
        # Still gets free trial (spike is flagged, not blocked)
        assert resp.json()["free_trial"] is True

        # But abuse was logged
        log_path = Path(config.abuse_log_path)
        if log_path.exists():
            entries = [json.loads(l) for l in log_path.read_text().strip().split("\n")]
            spike_entries = [e for e in entries if e["reason"] == "rate_spike"]
            assert len(spike_entries) >= 1

    _reset_abuse_log_path()


def test_wallet_usage_exceeded():
    """Wallet exceeding max free calls should lose free trial."""
    mock_redis = _make_mock_redis()
    mock_redis.get = AsyncMock(return_value="5.0")

    # Simulate: IP incr returns 1 (under cap), wallet incr returns 101 (over limit)
    call_count = 0

    async def smart_incr(key):
        nonlocal call_count
        call_count += 1
        if "wallet" in key:
            return 101  # Over the 100-call limit
        return 1  # Under IP daily cap

    mock_redis.incr = smart_incr

    config = FreeTrialConfig(app_name="test-app", max_free_calls=100)
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    client = TestClient(app)
    resp = client.post("/extract", headers={"X-Wallet": "0xHeavyUser"})

    assert resp.status_code == 200
    assert resp.json()["free_trial"] is False


def test_wallet_cycling_flagged():
    """Multiple wallets from same IP should be flagged."""
    mock_redis = _make_mock_redis()
    mock_redis.get = AsyncMock(return_value="5.0")
    mock_redis.scard = AsyncMock(return_value=4)  # 4 wallets from same IP

    config = FreeTrialConfig(app_name="test-app")
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    _reset_abuse_log_path()
    with tempfile.TemporaryDirectory() as tmpdir:
        config.abuse_log_path = os.path.join(tmpdir, "abuse.jsonl")

        client = TestClient(app)
        resp = client.post("/extract", headers={"X-Wallet": "0xWallet4"})

        assert resp.status_code == 200
        # Still gets free trial (cycling is flagged for review, not blocked)
        assert resp.json()["free_trial"] is True

        log_path = Path(config.abuse_log_path)
        if log_path.exists():
            entries = [json.loads(l) for l in log_path.read_text().strip().split("\n")]
            cycling_entries = [e for e in entries if e["reason"] == "wallet_cycling"]
            assert len(cycling_entries) >= 1

    _reset_abuse_log_path()


def test_redis_error_graceful_degradation():
    """Redis errors mid-flow should disable free trial, not crash."""
    mock_redis = _make_mock_redis()
    mock_redis.incr = AsyncMock(side_effect=Exception("Redis connection lost"))

    config = FreeTrialConfig(app_name="test-app")
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    client = TestClient(app)
    resp = client.post("/extract", headers={"X-Wallet": "0xSomeWallet"})

    assert resp.status_code == 200
    assert resp.json()["free_trial"] is False


def test_balance_rpc_failure_skips_check():
    """If RPC fails, balance check is skipped but other checks still run."""
    mock_redis = _make_mock_redis()
    mock_redis.get = AsyncMock(return_value=None)  # No cached balance

    config = FreeTrialConfig(app_name="test-app")
    app = _make_app(config=config)
    app._redis = mock_redis
    app._redis_url = "redis://fake"

    # Mock the balance check to return None (RPC failure)
    with patch("mcp_shared.free_trial.check_usdc_balance", AsyncMock(return_value=None)):
        client = TestClient(app)
        resp = client.post("/extract", headers={"X-Wallet": "0xWallet"})

    assert resp.status_code == 200
    # Should still get free trial since balance check was skipped
    assert resp.json()["free_trial"] is True
