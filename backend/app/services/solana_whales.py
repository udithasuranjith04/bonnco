import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.whale_activity import WhaleActivity

logger = logging.getLogger("bonnco.solana_whales")

# Free, public, no API key required.
SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
LAMPORTS_PER_SOL = 1_000_000_000
WHALE_THRESHOLD_USD = 1_000_000

# A single Solana block's full parsed transaction data runs 15+ MB and can contain 1,000+
# transactions — the free public RPC isn't built for continuously polling every block at that
# size, and doing so risks rate-limiting or an IP ban. This samples one recent block per interval
# instead, which means most individual transfers between samples are never seen. That coverage gap
# is a real, disclosed limitation of the free tier, not a bug to be hidden.
POLL_INTERVAL_SECONDS = 120


class SolanaRpcError(Exception):
    pass


def _rpc_call(client: httpx.Client, method: str, params: list) -> dict:
    resp = client.post(
        SOLANA_RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise SolanaRpcError(str(data["error"]))
    return data["result"]


def scan_latest_block(sol_price_usd: float) -> int:
    """Fetches the current slot's block and scans its native SOL transfer instructions for
    anything at or above the whale threshold. Returns how many were found and stored — a real
    count from real on-chain data, not an estimate.
    """
    if sol_price_usd <= 0:
        return 0

    with httpx.Client() as client:
        slot = _rpc_call(client, "getSlot", [])
        block = _rpc_call(
            client,
            "getBlock",
            [
                slot,
                {
                    "encoding": "jsonParsed",
                    "transactionDetails": "full",
                    "maxSupportedTransactionVersion": 0,
                    "rewards": False,
                },
            ],
        )

    block_time = block.get("blockTime")
    event_time = (
        datetime.fromtimestamp(block_time, tz=timezone.utc).replace(tzinfo=None) if block_time else datetime.utcnow()
    )
    threshold_lamports = (WHALE_THRESHOLD_USD / sol_price_usd) * LAMPORTS_PER_SOL

    found = 0
    db: Session = SessionLocal()
    try:
        for tx in block.get("transactions", []):
            try:
                instructions = tx["transaction"]["message"]["instructions"]
                signature = tx["transaction"]["signatures"][0]
            except (KeyError, TypeError, IndexError):
                continue

            for ins in instructions:
                parsed = ins.get("parsed") if isinstance(ins, dict) else None
                if not isinstance(parsed, dict) or parsed.get("type") != "transfer" or ins.get("program") != "system":
                    continue
                info = parsed.get("info", {})
                lamports = info.get("lamports", 0)
                if lamports < threshold_lamports:
                    continue

                sol_amount = lamports / LAMPORTS_PER_SOL
                db.add(
                    WhaleActivity(
                        chain="solana",
                        asset="SOL",
                        from_address=info.get("source", ""),
                        to_address=info.get("destination", ""),
                        amount=round(sol_amount, 4),
                        amount_usd=round(sol_amount * sol_price_usd, 2),
                        tx_hash=signature,
                        event_time=event_time,
                    )
                )
                found += 1

        if found:
            db.commit()
    except Exception:
        logger.exception("Failed to store Solana whale transfers")
        db.rollback()
    finally:
        db.close()

    return found
