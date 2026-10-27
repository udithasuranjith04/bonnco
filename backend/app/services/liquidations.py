from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.liquidation import Liquidation

# Price buckets sized as a % of the average liquidation price in the window, rather than a fixed
# dollar width, so clustering scales sensibly across a $0.50 altcoin and a $60,000 BTC alike.
BUCKET_PCT = 0.002
MAX_CLUSTERS_RETURNED = 10


def liquidation_clusters(db: Session, symbol: str, hours: int = 4) -> dict:
    """Aggregates real, stored liquidation events into price-level clusters over a rolling window.
    Returns an empty-but-honest result (never a fabricated cluster) when nothing has been recorded
    yet, which will be common until the listener has been running long enough to accumulate data.
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    rows = db.scalars(
        select(Liquidation).where(Liquidation.symbol == symbol, Liquidation.event_time >= cutoff)
    ).all()

    if not rows:
        return {
            "symbol": symbol,
            "hours": hours,
            "total_usd": 0.0,
            "event_count": 0,
            "clusters": [],
            "summary": f"No liquidations recorded for {symbol} in the last {hours}h.",
        }

    avg_price = sum(r.price for r in rows) / len(rows)
    bucket_width = max(avg_price * BUCKET_PCT, 1e-9)

    buckets: dict[int, dict] = {}
    for r in rows:
        bucket_idx = round(r.price / bucket_width)
        bucket = buckets.setdefault(bucket_idx, {"total_usd": 0.0, "count": 0, "buy_usd": 0.0, "sell_usd": 0.0})
        bucket["total_usd"] += r.quote_quantity
        bucket["count"] += 1
        if r.side == "BUY":
            bucket["buy_usd"] += r.quote_quantity
        else:
            bucket["sell_usd"] += r.quote_quantity

    clusters = []
    for idx, bucket in buckets.items():
        center = idx * bucket_width
        dominant_side = "BUY" if bucket["buy_usd"] > bucket["sell_usd"] else "SELL"
        clusters.append(
            {
                "price_low": round(center - bucket_width / 2, 6),
                "price_high": round(center + bucket_width / 2, 6),
                "total_usd": round(bucket["total_usd"], 2),
                "count": bucket["count"],
                "dominant_side": dominant_side,
            }
        )
    clusters.sort(key=lambda c: c["total_usd"], reverse=True)

    top = clusters[0]
    top_price = (top["price_low"] + top["price_high"]) / 2
    # BUY-side forced orders close out liquidated shorts; SELL-side close out liquidated longs.
    side_word = "shorts" if top["dominant_side"] == "BUY" else "longs"
    summary = f"Heavy liquidations clustered near ${top_price:,.2f} in the last {hours}h, mostly {side_word} getting liquidated."

    return {
        "symbol": symbol,
        "hours": hours,
        "total_usd": round(sum(r.quote_quantity for r in rows), 2),
        "event_count": len(rows),
        "clusters": clusters[:MAX_CLUSTERS_RETURNED],
        "summary": summary,
    }
