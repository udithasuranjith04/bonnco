import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.whale_activity import WhaleActivity

logger = logging.getLogger("bonnco.bitcoin_whales")

# mempool.space's public Esplora-compatible API — free, no key required.
MEMPOOL_API_URL = "https://mempool.space/api"
SATS_PER_BTC = 100_000_000
WHALE_THRESHOLD_USD = 1_000_000
TXS_PER_PAGE = 25
# A new Bitcoin block lands roughly every 10 minutes. Checking the tip height every 60s is one
# cheap request; the expensive part (paging through every transaction in a block, which can mean
# 100+ requests for a large block) only runs once per actual new block, never on every check.
POLL_INTERVAL_SECONDS = 60

_last_scanned_height: int | None = None


def _get(client: httpx.Client, path: str) -> httpx.Response:
    resp = client.get(f"{MEMPOOL_API_URL}{path}", timeout=30)
    resp.raise_for_status()
    return resp


def _input_address(tx: dict) -> str:
    """Bitcoin transactions can have multiple inputs from different addresses — there's no single
    clean "from" the way account-based chains have. This uses the first input as a representative
    sender rather than claiming false precision.
    """
    vin = tx.get("vin") or []
    if vin and vin[0].get("prevout"):
        return vin[0]["prevout"].get("scriptpubkey_address") or "(non-standard input)"
    return "(unknown)"


def scan_latest_block(btc_price_usd: float) -> int:
    """Checks whether a new Bitcoin block has landed since the last scan and, if so, pages through
    its full transaction list looking for outputs at or above the whale threshold. Every value read
    is a real on-chain output amount, never estimated. Returns how many were found and stored.
    """
    global _last_scanned_height
    if btc_price_usd <= 0:
        return 0

    with httpx.Client() as client:
        height = int(_get(client, "/blocks/tip/height").text)
        if height == _last_scanned_height:
            return 0

        block_hash = _get(client, f"/block-height/{height}").text
        block_meta = _get(client, f"/block/{block_hash}").json()
        tx_count = block_meta["tx_count"]
        event_time = datetime.fromtimestamp(block_meta["timestamp"], tz=timezone.utc).replace(tzinfo=None)
        threshold_sats = (WHALE_THRESHOLD_USD / btc_price_usd) * SATS_PER_BTC

        entries: list[WhaleActivity] = []
        for start in range(0, tx_count, TXS_PER_PAGE):
            try:
                txs = _get(client, f"/block/{block_hash}/txs/{start}").json()
            except Exception:
                logger.exception("Failed to fetch BTC block %s page starting at %d", block_hash, start)
                continue

            for tx in txs:
                for vout in tx.get("vout", []):
                    value_sats = vout.get("value", 0)
                    if value_sats < threshold_sats:
                        continue
                    btc_amount = value_sats / SATS_PER_BTC
                    entries.append(
                        WhaleActivity(
                            chain="bitcoin",
                            asset="BTC",
                            from_address=_input_address(tx),
                            to_address=vout.get("scriptpubkey_address") or "(non-standard output)",
                            amount=round(btc_amount, 8),
                            amount_usd=round(btc_amount * btc_price_usd, 2),
                            tx_hash=tx.get("txid"),
                            event_time=event_time,
                        )
                    )

    _last_scanned_height = height
    if not entries:
        return 0

    db: Session = SessionLocal()
    try:
        db.add_all(entries)
        db.commit()
    except Exception:
        logger.exception("Failed to store Bitcoin whale transfers")
        db.rollback()
        return 0
    finally:
        db.close()

    return len(entries)
