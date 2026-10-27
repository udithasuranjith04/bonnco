from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

Sentiment = Literal["bullish", "bearish", "neutral"]


@dataclass
class SentimentResult:
    sentiment: Sentiment
    confidence: float
    related_symbols: list[str]
    reason: str
    provider: str


class SentimentProvider(ABC):
    @abstractmethod
    def score_headline(self, title: str, summary: str) -> SentimentResult:
        ...
