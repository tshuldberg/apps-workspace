"""Free trial anti-abuse middleware for mcp-apps.

Enforces per-wallet and per-IP usage limits for free-tier requests.
Checks on-chain USDC balance on Base L2 before granting free calls.
Logs abuse events to JSONL for tracking without persisting raw IP or wallet values.

Redis key patterns:
  ft:{app}:wallet:{addr}     counter   30d    Free calls per wallet per app
  ft:ip:{ip}:{date}          counter   48h    Daily calls per IP
  ft:spike:{ip}              zset      60s    Sliding window for rate spikes
  ft:balance:{addr}          string    5min   Cached USDC balance
  ft:wallets:{ip}:{date}     set       48h    Wallets seen per IP per day
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Endpoints that bypass free trial checks entirely
FREE_PATHS = frozenset({
    "/health", "/capabilities", "/", "/docs", "/privacy",
    "/openapi.json", "/redoc",
})
FREE_PREFIXES = ("/.well-known/",)

# USDC contract on Base L2
_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
_BASE_RPC_URL = "https://mainnet.base.org"
# balanceOf(address) selector
_BALANCE_OF_SELECTOR = "0x70a08231"


@dataclass
class FreeTrialConfig:
    """Configuration for free trial middleware."""
    app_name: str = ""
    max_free_calls: int = 100
    ip_daily_cap: int = 100
    spike_threshold: int = 5          # calls/minute triggers abuse flag
    min_wallet_balance: float = 1.0   # $1 USDC minimum
    abuse_log_path: str = ""          # defaults to logs/abuse.jsonl


# ---------------------------------------------------------------------------
# USDC balance check via Base L2 RPC
# ---------------------------------------------------------------------------

async def check_usdc_balance(wallet_address: str) -> float | None:
    """Call USDC balanceOf() on Base L2. Returns balance in USDC or None on error."""
    try:
        import httpx
    except ImportError:
        logger.warning("httpx not installed; skipping balance check")
        return None

    # Pad address to 32 bytes for ABI encoding
    addr_clean = wallet_address.lower().replace("0x", "").zfill(64)
    data = f"{_BALANCE_OF_SELECTOR}{addr_clean}"

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {"to": _USDC_CONTRACT, "data": data},
            "latest",
        ],
    }

    rpc_url = os.environ.get("BASE_RPC_URL", _BASE_RPC_URL)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(rpc_url, json=payload)
            resp.raise_for_status()
            result = resp.json().get("result", "0x0")
            # USDC has 6 decimals
            raw_balance = int(result, 16)
            return raw_balance / 1_000_000
    except Exception as exc:
        logger.warning("Base RPC balance check failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Abuse logger (append-only JSONL, matches metering.py pattern)
# ---------------------------------------------------------------------------

_abuse_log_path: Path | None = None


def _get_abuse_log_path(config_path: str = "") -> Path:
    """Resolve the abuse log path, creating the directory if needed."""
    global _abuse_log_path
    if _abuse_log_path is not None:
        return _abuse_log_path

    if config_path:
        log_path = Path(config_path)
    else:
        log_dir = Path(os.environ.get("ABUSE_LOG_DIR", "logs"))
        log_path = log_dir / "abuse.jsonl"

    log_path.parent.mkdir(parents=True, exist_ok=True)
    _abuse_log_path = log_path
    return _abuse_log_path


def _reset_abuse_log_path() -> None:
    """Reset cached log path (for testing)."""
    global _abuse_log_path
    _abuse_log_path = None


async def log_abuse(
    *,
    ip: str,
    wallet: str,
    reason: str,
    service: str = "",
    details: dict[str, Any] | None = None,
    config_path: str = "",
) -> None:
    """Append a privacy-safe abuse event to the JSONL log file."""
    entry: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
        "service": service,
        # Keep minimal operational context without persisting raw identifiers.
        "wallet_present": bool(wallet),
    }
    if details:
        entry.update({
            key: value
            for key, value in details.items()
            if key not in {"ip", "wallet", "wallet_address"}
        })

    try:
        log_path = _get_abuse_log_path(config_path)
        with open(log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("Failed to write abuse log entry: %s", exc)


# ---------------------------------------------------------------------------
# Free Trial Middleware
# ---------------------------------------------------------------------------

class FreeTrialMiddleware(BaseHTTPMiddleware):
    """Enforce free-tier usage limits before x402 payment gate.

    Sets ``request.state.free_trial = True`` when the request qualifies
    for a free call, allowing downstream x402 middleware to skip payment.
    """

    def __init__(
        self,
        app,
        *,
        config: FreeTrialConfig | None = None,
        redis_url: str | None = None,
    ):
        super().__init__(app)
        self.config = config or FreeTrialConfig()
        self._redis = None
        self._redis_url = redis_url or os.environ.get("REDIS_URL")

    async def _get_redis(self):
        """Lazy-init async Redis client."""
        if self._redis is not None:
            return self._redis
        if not self._redis_url:
            return None
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True,
            )
            return self._redis
        except Exception as exc:
            logger.warning("Redis unavailable for free trial: %s", exc)
            return None

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip free/discovery endpoints
        if path in FREE_PATHS or any(path.startswith(p) for p in FREE_PREFIXES):
            return await call_next(request)

        # If request already carries x402 payment, skip free trial entirely
        has_payment = bool(
            request.headers.get("X-402-Payment")
            or request.headers.get("X-PAYMENT")
            or request.headers.get("X-Payment")
        )
        if has_payment:
            request.state.free_trial = False
            return await call_next(request)

        # No Redis = no free trial tracking; fall through to x402
        r = await self._get_redis()
        if r is None:
            request.state.free_trial = False
            return await call_next(request)

        wallet = (
            request.headers.get("X-Wallet")
            or request.headers.get("X-WALLET")
            or ""
        ).strip()
        client_ip = request.client.host if request.client else "unknown"
        now_ts = time.time()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cfg = self.config

        try:
            # -- 1. IP daily cap --
            ip_key = f"ft:ip:{client_ip}:{today}"
            ip_count = await r.incr(ip_key)
            if ip_count == 1:
                await r.expire(ip_key, 48 * 3600)

            if ip_count > cfg.ip_daily_cap:
                await log_abuse(
                    ip=client_ip, wallet=wallet,
                    reason="daily_cap_exceeded",
                    service=cfg.app_name,
                    details={"daily_total": ip_count},
                    config_path=cfg.abuse_log_path,
                )
                request.state.free_trial = False
                return await call_next(request)

            # -- 2. Rate spike detection (sliding window) --
            spike_key = f"ft:spike:{client_ip}"
            await r.zadd(spike_key, {str(now_ts): now_ts})
            await r.zremrangebyscore(spike_key, 0, now_ts - 60)
            await r.expire(spike_key, 120)
            spike_count = await r.zcard(spike_key)

            if spike_count > cfg.spike_threshold:
                await log_abuse(
                    ip=client_ip, wallet=wallet,
                    reason="rate_spike",
                    service=cfg.app_name,
                    details={"calls_per_minute": spike_count},
                    config_path=cfg.abuse_log_path,
                )
                # Flag but continue (daily cap still enforced)

            # -- 3. Wallet required for free trial --
            if not wallet:
                request.state.free_trial = False
                return await call_next(request)

            wallet_lower = wallet.lower()

            # -- 4. Wallet cycling detection --
            cycle_key = f"ft:wallets:{client_ip}:{today}"
            await r.sadd(cycle_key, wallet_lower)
            await r.expire(cycle_key, 48 * 3600)
            wallets_today = await r.scard(cycle_key)

            if wallets_today > 3:
                await log_abuse(
                    ip=client_ip, wallet=wallet,
                    reason="wallet_cycling",
                    service=cfg.app_name,
                    details={"wallets_today": wallets_today},
                    config_path=cfg.abuse_log_path,
                )

            # -- 5. Check USDC balance (cached) --
            balance_key = f"ft:balance:{wallet_lower}"
            cached_balance = await r.get(balance_key)

            if cached_balance is not None:
                balance = float(cached_balance)
            else:
                balance = await check_usdc_balance(wallet)
                if balance is not None:
                    await r.setex(balance_key, 300, str(balance))
                # If RPC failed, skip balance check (graceful degradation)

            if balance is not None and balance < cfg.min_wallet_balance:
                await log_abuse(
                    ip=client_ip, wallet=wallet,
                    reason="insufficient_balance",
                    service=cfg.app_name,
                    details={"balance": balance},
                    config_path=cfg.abuse_log_path,
                )
                request.state.free_trial = False
                return await call_next(request)

            # -- 6. Per-wallet usage counter --
            wallet_key = f"ft:{cfg.app_name}:wallet:{wallet_lower}"
            wallet_count = await r.incr(wallet_key)
            if wallet_count == 1:
                await r.expire(wallet_key, 30 * 24 * 3600)  # 30 days

            if wallet_count > cfg.max_free_calls:
                request.state.free_trial = False
                return await call_next(request)

            # All checks passed -- grant free trial
            request.state.free_trial = True
            return await call_next(request)

        except Exception as exc:
            # Redis error mid-flow: disable free trial, pass to x402
            logger.warning("Free trial middleware error: %s", exc)
            request.state.free_trial = False
            return await call_next(request)
