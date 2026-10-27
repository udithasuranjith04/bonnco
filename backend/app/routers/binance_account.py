from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.binance_account import (
    BinanceBalanceOut,
    BinanceConnectRequest,
    BinanceOpenOrdersOut,
    BinancePositionOut,
    BinanceStatusOut,
    ExposureHistoryPointOut,
    ImportPositionRequest,
    PortfolioOverviewOut,
    PortfolioSummaryOut,
    ReconcileOut,
    AssetHoldingOut,
    TradeHistorySyncOut,
)
from app.schemas.trade_journal import TradeJournalOut
from app.services import binance_account as binance_account_service
from app.services import (
    binance_credentials,
    binance_exposure_history,
    binance_portfolio,
    binance_portfolio_risk,
    binance_portfolio_summary,
    binance_positions,
    binance_trade_history,
)

router = APIRouter(prefix="/api/binance", tags=["binance"])


@router.get("/status", response_model=BinanceStatusOut)
def get_status(db: Session = Depends(get_db)):
    return binance_credentials.current_status(db)


@router.post("/connect", response_model=BinanceStatusOut)
def connect(payload: BinanceConnectRequest, db: Session = Depends(get_db)):
    api_key = payload.api_key.strip()
    api_secret = payload.api_secret.strip()
    if not api_key or not api_secret:
        raise HTTPException(status_code=400, detail="API key and secret are both required")

    try:
        binance_credentials.connect(db, api_key, api_secret)
    except binance_account_service.BinanceAuthError as exc:
        raise HTTPException(status_code=400, detail=f"Binance rejected this key: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Couldn't reach Binance to validate this key: {exc}") from exc

    return binance_credentials.current_status(db)


@router.delete("/disconnect", status_code=204)
def disconnect(db: Session = Depends(get_db)):
    binance_credentials.disconnect(db)


@router.get("/balance", response_model=BinanceBalanceOut)
def get_balance(db: Session = Depends(get_db)):
    return binance_portfolio.get_account_balance(db)


@router.get("/wallet", response_model=list[AssetHoldingOut])
def get_wallet(db: Session = Depends(get_db)):
    return binance_portfolio.get_all_asset_holdings(db)


@router.get("/positions", response_model=list[BinancePositionOut])
def get_positions(db: Session = Depends(get_db)):
    return binance_positions.get_open_futures_positions(db)


@router.get("/open-orders", response_model=BinanceOpenOrdersOut)
def get_open_orders(db: Session = Depends(get_db)):
    return binance_positions.get_open_orders(db)


@router.get("/reconcile", response_model=ReconcileOut)
def reconcile(db: Session = Depends(get_db)):
    return binance_positions.reconcile_positions(db)


@router.post("/import-position", response_model=TradeJournalOut, status_code=201)
def import_position(payload: ImportPositionRequest, db: Session = Depends(get_db)):
    row = binance_positions.import_position(db, payload.symbol.upper())
    if row is None:
        raise HTTPException(status_code=404, detail=f"No open Binance futures position found for {payload.symbol.upper()}")
    return row


@router.get("/portfolio/summary", response_model=PortfolioSummaryOut)
def get_portfolio_summary(db: Session = Depends(get_db)):
    return binance_portfolio_summary.get_portfolio_summary(db)


@router.get("/portfolio", response_model=PortfolioOverviewOut)
def get_portfolio(db: Session = Depends(get_db)):
    return binance_portfolio_risk.get_portfolio_overview(db)


@router.get("/portfolio/exposure-history", response_model=list[ExposureHistoryPointOut])
def get_exposure_history(hours: int = 24, db: Session = Depends(get_db)):
    return binance_exposure_history.get_exposure_history(db, hours=hours)


@router.post("/trade-history/sync", response_model=TradeHistorySyncOut)
def sync_trade_history(db: Session = Depends(get_db)):
    """One-time backfill and ongoing sync are the same operation here — every real closed spot
    trade already imported is skipped (deduped by Binance's own order id), so this is safe to call
    repeatedly.
    """
    results = binance_trade_history.sync_all_spot_trade_history(db)
    return {"imported_by_symbol": results, "total_imported": sum(results.values())}
