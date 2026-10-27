// Shared position-sizing math, used by both the Study page's PositionSizeCalculator and the
// compact calculator embedded in the Trade Journal's "Log a trade" form. The logic: decide how
// much you're willing to lose in dollars first (account x risk%), then work backward to the
// position size that makes your stop-loss distance equal exactly that dollar amount.
export interface PositionSizeResult {
  riskAmount: number;
  stopDistancePct: number;
  positionSizeUsd: number;
  positionSizeCoin: number;
  leverageNeeded: number;
}

export function computePositionSize(account: number, riskPct: number, entry: number, stopLoss: number): PositionSizeResult {
  const riskAmount = account * (riskPct / 100);
  const stopDistancePct = entry > 0 ? Math.abs(entry - stopLoss) / entry : 0;
  const positionSizeUsd = stopDistancePct > 0 ? riskAmount / stopDistancePct : 0;
  const positionSizeCoin = entry > 0 ? positionSizeUsd / entry : 0;
  const leverageNeeded = account > 0 ? positionSizeUsd / account : 0;

  return { riskAmount, stopDistancePct, positionSizeUsd, positionSizeCoin, leverageNeeded };
}
