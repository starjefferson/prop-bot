/**
 * Top-Down Trend Alignment (3/4 SMA Rule)
 * Requires at least 3 out of 4 timeframes (W1, D1, H4, H1) to align.
 */
export function checkTopDownAlignment(candleData, topDownTFs = ["1W", "1D", "4H", "1H"]) {
  let votes = { buy: 0, sell: 0 };
  let evaluatedCount = 0;

  for (let tf of topDownTFs) {
    const candles = candleData[tf];
    if (!candles || candles.length < 20) continue;

    evaluatedCount++;
    // Detect trend using a 20-candle SMA comparison
    const sma = candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / 20;
    const currentPrice = candles[0].close;

    if (currentPrice > sma) votes.buy++;
    if (currentPrice < sma) votes.sell++;
  }

  if (evaluatedCount === 0) return null;

  // Requires 3 out of 4 (or unanimous if <= 3 evaluated)
  const threshold = evaluatedCount >= 4 ? 3 : Math.max(2, evaluatedCount);

  if (votes.buy >= threshold) return "buy";
  if (votes.sell >= threshold) return "sell";

  return null;
}