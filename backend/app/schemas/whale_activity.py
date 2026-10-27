from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WhaleActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chain: str
    asset: str
    from_address: str
    to_address: str
    amount: float
    amount_usd: float
    tx_hash: str | None
    event_time: datetime
