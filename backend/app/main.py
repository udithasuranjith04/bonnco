from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db import Base, engine
from app.routers import binance_account, chat, checkin, current_state, decision, goal, health, indicators, liquidations, live, market, news, patterns, scanner, signals, ticker, trade_journal, watchlist, whale_activity
from app.routers import settings as settings_router
from app.services.liquidation_stream import start_liquidation_listener, stop_liquidation_listener
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.trade_delta import start_delta_tracking, stop_delta_tracking

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401 ensures all models are registered before create_all

    Base.metadata.create_all(bind=engine)
    start_scheduler()
    start_liquidation_listener()
    start_delta_tracking()
    yield
    stop_delta_tracking()
    stop_liquidation_listener()
    stop_scheduler()


app = FastAPI(title="Bonnco API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(watchlist.router)
app.include_router(market.router)
app.include_router(indicators.router)
app.include_router(news.router)
app.include_router(signals.router)
app.include_router(settings_router.router)
app.include_router(chat.router)
app.include_router(trade_journal.router)
app.include_router(live.router)
app.include_router(ticker.router)
app.include_router(patterns.router)
app.include_router(liquidations.router)
app.include_router(whale_activity.router)
app.include_router(binance_account.router)
app.include_router(goal.router)
app.include_router(checkin.router)
app.include_router(current_state.router)
app.include_router(decision.router)
app.include_router(scanner.router)


@app.get("/")
def root():
    return {"name": "Bonnco API", "status": "running"}
