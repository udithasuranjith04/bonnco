from pydantic import BaseModel


class OutcomeBucketOut(BaseModel):
    resolved: int
    correct: int
    win_rate: float | None
    stopped_out: int


class ConfidenceBandBucketOut(OutcomeBucketOut):
    band: str


class SignalTypeBucketOut(OutcomeBucketOut):
    signal_type: str


class CoinBucketOut(OutcomeBucketOut):
    coin: str


class TimeframeBucketOut(OutcomeBucketOut):
    timeframe: str


class HorizonBucketOut(OutcomeBucketOut):
    horizon_hours: int


class SignalOutcomeStatsOut(BaseModel):
    overall: OutcomeBucketOut
    reliable_sample_size: int
    unresolved_count: int
    hold_count: int
    by_confidence_band: list[ConfidenceBandBucketOut]
    by_signal_type: list[SignalTypeBucketOut]
    by_coin: list[CoinBucketOut]
    by_timeframe: list[TimeframeBucketOut]
    by_horizon_hours: list[HorizonBucketOut]
