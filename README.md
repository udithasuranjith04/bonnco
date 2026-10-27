<div align="center">

# Bonnco

**AI-assisted crypto market analysis and signal system**

Streams live Binance market data, detects chart patterns, scores trade setups with a decision engine, and explains them through an AI assistant.

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?logo=mysql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?logo=pytest&logoColor=white)
![Binance](https://img.shields.io/badge/Binance-F0B90B?logo=binance&logoColor=black)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)

</div>

> **Disclaimer:** Bonnco is an educational and portfolio project. Nothing it produces is financial advice. Crypto markets are volatile and signals can be wrong. Never trade money you cannot afford to lose.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Bonnco combines live market data, technical analysis, pattern detection and an AI assistant in one dashboard. It pulls spot and futures data from Binance, runs a signal and decision engine across multiple timeframes, and presents the result with a confidence score and a plain-language explanation. It also includes a trade journal, goal tracking and an educational Study section so beginners can learn why a signal appears, not just what it says.

## Features

**Market data and signals**
- Live Binance kline and ticker streams over WebSockets, pooled so many clients share one upstream connection
- Signal engine with confidence scoring and a decision engine
- Multi-timeframe hierarchy analysis
- Technical indicators computed on the backend and client side
- Historical similarity matching against past market fingerprints
- Signal outcome tracking and performance statistics

**Pattern detection**
- Candlestick patterns
- Reversal and continuation chart patterns
- Swing point detection
- Support/resistance, trend line and Fibonacci visual diagrams

**On-chain and market context**
- Whale activity tracking for Bitcoin, Ethereum and Solana
- Liquidation stream and liquidation cluster view
- News ingestion from RSS feeds with sentiment scoring

**AI assistant**
- Chat assistant with pluggable providers (OpenAI and Google Gemini)
- Context builder that feeds current market state into the conversation
- Regression tests for chat context

**Trading tools**
- Trade journal with statistics
- Goal progress tracking
- Position size calculator and pre-trade checklist
- Position coach and portfolio risk summary
- Session check-in and in-app notifications with sound and browser alerts
- Watchlist and symbol search

**Binance account (optional, read-only)**
- Portfolio, positions, exposure history and trade history views
- Credentials encrypted at rest with Fernet

**Learning**
- Study section with beginner explainers, diagrams and a guided stepper

## Screenshots

> Add your own screenshots to a `docs/` folder and update the paths below. Hide any real balances, account IDs or keys.

| Dashboard | Coin Detail |
| --- | --- |
| ![Dashboard](docs/dashboard.png) | ![Coin detail](docs/coin-detail.png) |

| AI Chat | Trade Journal |
| --- | --- |
| ![AI chat](docs/chat.png) | ![Trade journal](docs/journal.png) |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, PyMySQL |
| Database | MySQL 8.0 |
| Frontend | React, TypeScript, Vite |
| Real-time | Binance WebSocket streams |
| AI | OpenAI, Google Gemini |
| Infrastructure | Docker Compose |
| Testing | pytest |
| Linting | oxlint |

## Architecture

```
                 Binance Spot / Futures
                  REST + WebSocket
                          |
                          v
        +-------------------------------------+
        |           FastAPI backend           |
        |                                     |
        |  LiveStreamHub   Ticker / Liquidation streams
        |  Signal engine   Decision engine    |
        |  Pattern detector  Indicators       |
        |  Whale + News ingest  Scheduler     |
        |  AI providers (OpenAI / Gemini)     |
        +------------+------------------------+
                     |                 ^
                     v                 |  REST + WebSocket
                 MySQL 8.0             |
        (candles, signals,       +-----+---------------+
         journal, settings)      |  React + TypeScript |
                                 |  dashboard (Vite)   |
                                 +---------------------+
```

A single upstream Binance kline connection is shared per `(symbol, market_type, timeframe)`, so any number of browser clients watching the same chart use one connection. The upstream socket closes when the last subscriber disconnects. Still-forming candles are written to MySQL on a throttle, and closed candles are always persisted immediately.

## Project Structure

```
Bonnco/
├── backend/
│   ├── app/
│   │   ├── core/          # configuration
│   │   ├── models/        # SQLAlchemy models
│   │   ├── routers/       # FastAPI endpoints
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # signal engine, streams, AI, exchange adapters
│   ├── news/              # RSS fetcher
│   ├── patterns/          # candlestick, reversal, continuation, swings
│   ├── tests/             # pytest suite
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/           # API client
│       ├── components/    # UI components and diagrams
│       ├── contexts/      # alerts, risk profile
│       ├── hooks/         # live ticker, live candle, watchers
│       ├── lib/           # helpers and study content
│       ├── pages/         # dashboard, coin detail, chat, journal, ...
│       └── layouts/
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Docker and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/udithasuranjith04/bonnco.git
cd bonnco
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your own values (see [Configuration](#configuration)). No Binance key is needed for public market data.

### 3. Start the database

```bash
docker compose up -d
```

This starts MySQL 8.0 on port `3307`. The credentials in `docker-compose.yml` are local development defaults. Change them for any real deployment.

### 4. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

The interactive API docs are available at `http://localhost:8001/docs`.

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Configuration

All backend settings live in `backend/.env`. Never commit this file.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL connection string |
| `BINANCE_SPOT_BASE_URL` | Binance spot REST base URL |
| `BINANCE_FUTURES_BASE_URL` | Binance futures REST base URL |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | Optional read-only account key |
| `CREDENTIALS_ENCRYPTION_KEY` | Fernet key used to encrypt stored credentials |
| `EXCHANGE_PROVIDER` | Exchange adapter (`binance`) |
| `ETHERSCAN_API_KEY` | Enables Ethereum whale tracking |
| `AI_PROVIDER` | `openai` or `gemini` |
| `OPENAI_API_KEY` / `GOOGLE_API_KEY` | AI provider keys |
| `APP_ENV` | `development` or `production` |
| `RISK_PROFILE` | Default risk profile |

Generate an encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Frontend (`frontend/.env`):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend URL, for example `http://localhost:8001` |

## Running Tests

```bash
cd backend
pytest
```

The suite covers the decision engine, current-state logic, signal stability and chat context regressions.

## Security

- Secrets are read from environment variables, and `.env` files are git-ignored. Only `.env.example` templates are tracked.
- Exchange credentials stored through the app are encrypted with Fernet before being saved.
- If you connect a Binance account, create the key with **Enable Reading only**, disable withdrawals, and restrict it to your IP address.
- Please report security issues privately through GitHub's **Security** tab rather than opening a public issue.

## Roadmap

- [ ] Backtesting results page with documented methodology
- [ ] Additional exchange adapters (for example Bybit)
- [ ] GitHub Actions CI for backend tests and frontend build
- [ ] Docker image for the full stack
- [ ] More chart pattern coverage

## Contributing

This is a personal portfolio project, but feedback is welcome.

1. Fork the repository
2. Create a branch: `git switch -c feature/your-feature`
3. Commit using clear messages, for example `feat: add new pattern`
4. Push and open a Pull Request

## License

Released under the MIT License. Add a `LICENSE` file to the repository root to match.

---

<div align="center">

Built by [Uditha Suranjith](https://github.com/udithasuranjith04)

</div>
