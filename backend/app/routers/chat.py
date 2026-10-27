import time
from collections import deque

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatMessageOut, ChatReplyOut, ChatRequest
from app.services.chat_service import ask_bonnco

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Every real chat call spends real OpenAI/Gemini credits, so a runaway loop or accidental
# rapid-fire (a stuck key, a retry bug in some future integration) shouldn't be able to burn
# through cost unbounded even for a single trusted local user. Simple in-process sliding window —
# no auth/multi-user concept exists here, so this is deliberately not per-IP/per-session, just a
# hard ceiling on the whole endpoint.
CHAT_RATE_LIMIT_PER_MINUTE = 20
_recent_request_times: deque[float] = deque()


def _enforce_chat_rate_limit() -> None:
    now = time.monotonic()
    while _recent_request_times and now - _recent_request_times[0] > 60:
        _recent_request_times.popleft()
    if len(_recent_request_times) >= CHAT_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail=f"Too many chat requests — max {CHAT_RATE_LIMIT_PER_MINUTE} per minute. Wait a moment and try again.",
        )
    _recent_request_times.append(now)


@router.post("", response_model=ChatReplyOut)
def post_chat_message(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    _enforce_chat_rate_limit()

    try:
        reply, provider = ask_bonnco(
            db,
            payload.session_id,
            payload.message.strip(),
            payload.symbol,
            payload.market_type,
            payload.timeframe,
            payload.page,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ChatReplyOut(reply=reply, provider=provider)


@router.get("/history", response_model=list[ChatMessageOut])
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    ).all()
