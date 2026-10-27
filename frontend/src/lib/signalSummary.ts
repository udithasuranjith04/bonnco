interface IndicatorReading {
  label: string;
  interpretation: string;
}

interface IndicatorSnapshot {
  rsi: IndicatorReading;
  macd: IndicatorReading;
  ema: IndicatorReading;
  bollinger: IndicatorReading;
  volume: IndicatorReading;
  support_resistance: IndicatorReading;
}

export function summarizeSignal(snapshot: IndicatorSnapshot): { label: string; value: string }[] {
  return [
    { label: "Trend", value: snapshot.ema.interpretation },
    { label: "Momentum", value: snapshot.macd.interpretation },
    { label: "Volume", value: snapshot.volume.interpretation },
  ];
}
