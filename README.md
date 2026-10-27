<div align="center">

# Bonnco

**AI-assisted crypto market analysis, signal and decision-support platform**

Streams live Binance market data, detects chart patterns, scores trade setups with an auditable decision engine, tracks its own signal accuracy, and explains everything through an AI assistant. Binance account access is strictly read-only.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?logo=sqlalchemy&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![Pandas](https://img.shields.io/badge/Pandas-150458?logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-013243?logo=numpy&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)
![MUI](https://img.shields.io/badge/MUI-9-007FFF?logo=mui&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?logo=pytest&logoColor=white)
![Binance](https://img.shields.io/badge/Binance-F0B90B?logo=binance&logoColor=black)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)

</div>

> **Disclaimer:** Bonnco is an educational and portfolio project. Its output is decision support, not financial advice. Crypto markets are volatile and signals can be wrong. Bonnco cannot place, modify or cancel orders.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database](#database)
- [Background Jobs](#background-jobs)
- [API Overview](#api-overview)
- [Frontend Pages](#frontend-pages)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Security](#security)
- [Design Principles](#design-principles)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Bonnco is a full-stack trading cockpit of roughly 10,000 lines of Python and 14,000 lines of TypeScript. The backend pulls spot and futures data from Binance, stores candles in MySQL, computes indicators and chart patterns, and turns them into BUY / SELL / HOLD signals. A decision engine then adds directional bias, confidence breakdown, trade quality, risk quality and portfolio compatibility. The React dashboard shows live charts, signals, whale activity, news sentiment and a read-only view of your Binance portfolio, with an AI assistant that answers questions using the app's real current state.

A core rule of the project is that numbers are never invented. Anything Bonnco cannot measure from real data is excluded or labelled as unresolved instead of being estimated.

## Features

**Signals and decisions**
- BUY / SELL / HOLD signal engine with confidence scoring
- Decision engine with directional bias, confidence decomposition, trade quality, risk quality, portfolio compatibility and an explicit decision lifecycle state
- Multi-timeframe hierarchy with role-based timeframes
- Market scanner that compares candidates across timeframes
- Signal outcome tracking: every directional call is later resolved against real stored candles, producing measured win-rate statistics (unresolved and HOLD calls are excluded from win rates)
- Historical similarity: market fingerprints (RSI, trend, volume, Bollinger, realised forward return) built from backfilled history are matched against the live setup

**Technical analysis**
- Indicators computed with `pandas-ta`
- Candlestick, reversal and continuation pattern detection plus swing point detection
- Pattern outcome evaluation over time

**Live market data**
- Binance spot and futures REST and WebSocket data
- Pooled kline WebSocket hub: one upstream connection per symbol, market type and timeframe, shared across all browser clients
- Live ticker stream, liquidation stream and trade delta tracking
- Liquidation cluster view

**On-chain and news**
- Whale activity tracking for Bitcoin, Solana and Ethereum (Ethereum requires an Etherscan key)
- RSS news ingestion with sentiment scoring

**AI assistant**
- Pluggable providers: OpenAI and Google Gemini
- Chat context built from the app's real current state, covered by regression tests

**Trading tools**
- Trade journal with statistics and an active position coach (hold or exit guidance grounded in current signals)
- Goal progress with automatic "nice number" milestones against your real balance
- Position size calculator and pre-trade checklist
- Session check-in, notification bell, sound and browser notifications
- Watchlist and symbol search

**Binance account (optional, read-only)**
- Spot, Simple Earn and futures portfolio value, positions, open orders
- Portfolio risk view with per-coin concentration and a correlation-weighted concentration warning
- Closed-trade reconstruction from raw fills, with import into the journal and reconciliation
- Permission check against Binance's own API restrictions endpoint on every status check

**Learning**
- Study section with beginner explainers and interactive diagrams

## Screenshots

> Add screenshots to a `docs/` folder and update the paths. Hide real balances, account IDs and keys.

| Dashboard | Coin Detail |
| --- | --- |
| ![Dashboard](docs/dashboard.png) | ![Coin detail](docs/coin-detail.png) |

| AI Chat | Trade Journal |
| --- | --- |
| ![AI chat](docs/chat.png) | ![Trade journal](docs/journal.png) |

## Tech Stack

**Backend**

| Area | Technology |
| --- | --- |
| Framework | FastAPI 0.115, Uvicorn |
| ORM and DB driver | SQLAlchemy 2.0, PyMySQL |
| Validation and config | Pydantic 2, pydantic-settings, python-dotenv |
| Data and analysis | pandas, NumPy, pandas-ta |
| HTTP and streaming | httpx, websockets |
| Scheduling | APScheduler |
| News | feedparser |
| AI | openai, google-genai |
| Security | cryptography (Fernet) |
| Testing | pytest, pytest-cov |

**Frontend**

| Area | Technology |
| --- | --- |
| Framework | React 19, TypeScript, Vite |
| UI | Material UI (MUI) 9, Emotion |
| Charts | lightweight-charts |
| Routing and HTTP | React Router 7, axios |
| Linting | oxlint |

**Infrastructure:** Docker Compose (MySQL 8.0)

## Architecture

```
                  Binance Spot / Futures
                   REST + WebSocket
                           |
                           v
   +-------------------------------------------------+
   |                  FastAPI backend                |
   |                                                 |
   |  LiveStreamHub   Ticker + Liquidation streams   |
   |  Signal engine -> Decision engine -> Scanner    |
   |  Pattern detector   Indicators (pandas-ta)      |
   |  Whale trackers (BTC / ETH / SOL)  News ingest  |
   |  Position coach   Portfolio + risk (read-only)  |
   |  AI providers (OpenAI / Gemini)                 |
   |  APScheduler background jobs                    |
   +------------+---------------------------+--------+
                |                           ^
                v                           |  REST + WebSocket
            MySQL 8.0                       |
   (candles, signals, outcomes,     +-------+--------------+
    journal, fingerprints, ...)     | React + TypeScript   |
                                    | dashboard (Vite+MUI) |
                                    +----------------------+
```

Tables are created automatically at startup (`Base.metadata.create_all`). The kline hub persists the still-forming candle at most every 2 seconds and always persists a closed candle immediately.

## Database

MySQL 8.0 with 14 tables:

`candles`, `signals`, `signal_outcomes`, `decision_states`, `pattern_history`, `market_fingerprints`, `news_sentiment`, `whale_activity`, `liquidations`, `trade_journal`, `watchlist`, `chat_messages`, `app_settings`, `binance_credentials`

Candle upserts use MySQL's `INSERT ... ON DUPLICATE KEY UPDATE` through SQLAlchemy's MySQL dialect.

## Background Jobs

Started with the app via APScheduler:

| Job | Interval |
| --- | --- |
| Refresh watchlist candles | 60 s |
| Refresh news | configurable (`news_poll_seconds`) |
| Evaluate signal outcomes | 15 min |
| Evaluate pattern outcomes | 30 min |
| Sync Binance trade history | 30 min |
| Auto-import open Binance positions | 90 s |
| Track Solana whales | configurable |
| Track Bitcoin whales | configurable |
| Track Ethereum whales | configurable (only when an Etherscan key is set) |

## API Overview

Interactive docs are served at `/docs` (Swagger UI). Routers:

| Router | Purpose |
| --- | --- |
| `health` | Health check |
| `market` | Candles, price, ticker, futures info, top and searchable symbols, historical backfill |
| `indicators`, `patterns` | Technical indicators and detected patterns |
| `signals` | Generate and list signals, outcome statistics |
| `decision`, `current_state`, `scanner` | Decision engine, aggregated app state, multi-timeframe scanner |
| `live`, `ticker` | WebSocket streams for live candles and tickers |
| `liquidations`, `whale_activity`, `news` | Market context |
| `watchlist`, `trade_journal`, `goal`, `checkin` | Personal tracking tools |
| `chat` | AI assistant |
| `settings` | App settings and AI provider selection |
| `binance_account` | Connect or disconnect, balance, wallet, positions, open orders, reconcile, portfolio, exposure history, trade history sync |

## Frontend Pages

| Route | Page |
| --- | --- |
| `/` | Dashboard |
| `/watchlist` | Watchlist |
| `/coin/:symbol` | Coin detail with live chart, indicators, patterns and signal |
| `/chat` | AI assistant |
| `/journal` | Trade journal |
| `/performance` | Signal performance and track record |
| `/news` | News feed with sentiment |
| `/whales` | Whale activity |
| `/study` | Beginner study section |
| `/settings` | Settings and Binance connection |

## Project Structure

```
Bonnco/
├── backend/
│   ├── app/
│   │   ├── core/        # settings (pydantic-settings)
│   │   ├── models/      # SQLAlchemy models
│   │   ├── routers/     # FastAPI routers
│   │   ├── schemas/     # Pydantic schemas
│   │   └── services/    # signal + decision engines, streams, scheduler,
│   │                    # Binance integration, whale trackers, AI providers
│   ├── news/            # RSS fetcher
│   ├── patterns/        # candlestick, reversal, continuation, swings
│   ├── tests/
│   ├── pytest.ini
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/         # axios client
│       ├── components/  # UI components and educational diagrams
│       ├── contexts/    # alerts, risk profile
│       ├── hooks/       # live ticker, live candle, watchers
│       ├── layouts/
│       ├── lib/         # helpers, study content, position sizing
│       ├── pages/
│       └── theme/
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 24 and npm 11 (recent LTS versions should also work)
- Docker (for the MySQL container)

### 1. Clone

```bash
git clone https://github.com/udithasuranjith04/bonnco.git
cd bonnco
```

### 2. Configure environment

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env`. No Binance key is needed for public market data.

### 3. Start MySQL

```bash
docker compose up -d
```

MySQL listens on host port `3307`. The credentials in `docker-compose.yml` are local-development defaults; change them for any real deployment.

### 4. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Open `http://localhost:8001/docs` for the API docs.

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The frontend reads the backend address from `VITE_API_BASE_URL` (`http://localhost:8001` by default).

### Optional: load historical data

Use the `market` router's backfill endpoint to pull historical Binance klines and build market fingerprints for the historical similarity feature.

## Configuration

Backend variables (`backend/.env`, never commit):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL connection string (`mysql+pymysql://...`) |
| `BINANCE_SPOT_BASE_URL`, `BINANCE_FUTURES_BASE_URL` | Binance REST base URLs |
| `BINANCE_API_KEY`, `BINANCE_API_SECRET` | Optional read-only key (or enter it in Settings) |
| `CREDENTIALS_ENCRYPTION_KEY` | Fernet key that encrypts credentials stored in the database |
| `EXCHANGE_PROVIDER` | Exchange adapter (`binance`) |
| `ETHERSCAN_API_KEY` | Enables Ethereum whale tracking |
| `AI_PROVIDER` | `openai` or `gemini` |
| `OPENAI_API_KEY`, `GOOGLE_API_KEY` | AI provider keys |
| `APP_ENV` | Environment name |
| `RISK_PROFILE` | Default risk profile |

Generate an encryption key:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Frontend (`frontend/.env`): `VITE_API_BASE_URL`.

## Running Tests

```bash
cd backend
pytest
```

Test modules cover the decision engine, current-state aggregation, signal stability and chat context regressions. Coverage is available through `pytest-cov`.

```bash
cd frontend
npm run lint
npm run build
```

## Security

- Secrets come from environment variables. `.env` files are git-ignored and only `.env.example` templates are tracked.
- Binance credentials saved through the Settings page are encrypted with Fernet. The key lives only in `.env`, and decrypted values exist only in server memory during a signed request.
- The Binance integration is strictly read-only: it calls only private account-read endpoints and cannot create, modify or cancel orders.
- Key permissions are verified live against Binance's API restrictions endpoint each time status is checked, so a key later granted trading rights is detected.
- Recommended key setup: **Enable Reading** only, withdrawals disabled, IP-restricted.
- Report security issues privately through the repository's Security tab.

## Design Principles

- **No invented numbers.** Unpriceable assets are excluded and reported separately, and unresolved outcomes stay unresolved.
- **Measured track record.** Signals are scored against real candles, so the app reports its own win rate honestly.
- **Decision support, not instructions.** Guidance text states that it is not a directive, and the app never touches real orders.
- **Freshness is explicit.** Aggregated state carries connection and freshness information per data source.

## Roadmap

- [ ] Backtesting module with documented methodology
- [ ] Additional exchange adapters (the exchange layer already has a provider interface)
- [ ] GitHub Actions CI (pytest, lint, build)
- [ ] Full-stack Docker image
- [ ] Migrations with Alembic instead of `create_all`

## License

MIT. Add a `LICENSE` file to the repository root.

---

<div align="center">

Built by [Uditha Suranjith](https://github.com/udithasuranjith04)

</div>
