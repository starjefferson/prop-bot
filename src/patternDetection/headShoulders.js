/**
 * Flexible structural detection for H&S and Inverted H&S patterns.
 */

export function detectPatterns(candles, expectedType, symbol = "", onDiagnostic) {
  if (!candles || candles.length < 200) return null;

  return findHS(candles, expectedType, symbol, onDiagnostic);
}

function findHS(candles, type, symbol, onDiagnostic) {
  const pivots = findAlternatingPivots(candles, 5);
  if (pivots.length < 5) return null;

  const expectedPivotTypes = type === "sell"
    ? ["high", "low", "high", "low", "high"]
    : ["low", "high", "low", "high", "low"];
  const maxCandidates = Math.min(pivots.length - 4, 12);

  for (let start = 0; start < maxCandidates; start++) {
    const candidate = pivots.slice(start, start + 5);
    if (candidate.some((pivot, index) => pivot.type !== expectedPivotTypes[index])) continue;

    const [rightShoulder, rightNeck, head, leftNeck, leftShoulder] = candidate;
    const gaps = candidate.slice(1).map((pivot, index) => pivot.idx - candidate[index].idx);
    if (gaps.some(gap => gap < 3 || gap > 60)) continue;
    if (leftShoulder.idx - rightShoulder.idx > 120) continue;

    const atr = calculatePatternATR(candles, rightShoulder.idx, leftShoulder.idx);
    if (!Number.isFinite(atr) || atr <= 0) continue;

    const shoulderDifference = Math.abs(leftShoulder.val - rightShoulder.val);
    const necklineDifference = Math.abs(leftNeck.val - rightNeck.val);
    const headProminence = type === "sell"
      ? head.val - Math.max(leftShoulder.val, rightShoulder.val)
      : Math.min(leftShoulder.val, rightShoulder.val) - head.val;
    const necklineMidpoint = (leftNeck.val + rightNeck.val) / 2;
    const headToNeckline = type === "sell"
      ? head.val - necklineMidpoint
      : necklineMidpoint - head.val;

    if (shoulderDifference > atr * 2) continue;
    if (necklineDifference > atr * 2) continue;
    if (headProminence < atr * 0.5 || headToNeckline < atr) continue;

    const headTime = candles[head.idx]?.time ?? head.idx;
    const rightShoulderTime = candles[rightShoulder.idx]?.time;
    const necklineStartTime = candles[leftNeck.idx]?.time;
    const necklineEndTime = candles[rightNeck.idx]?.time;
    if (![headTime, rightShoulderTime, necklineStartTime, necklineEndTime].every(Number.isFinite)) continue;

    const measuredMove = Math.abs(head.val - necklineMidpoint);
    if (!Number.isFinite(measuredMove) || measuredMove <= 0) continue;

    const slBuffer = atr * 0.25;
    const sl = type === "sell"
      ? rightShoulder.val + slBuffer
      : rightShoulder.val - slBuffer;

    onDiagnostic?.({ type, stage: "geometry" });

    return {
      type,
      label: type === "sell" ? "Head and Shoulders" : "Inverted Head and Shoulders",
      symbol,
      necklineHigh: Math.max(leftNeck.val, rightNeck.val),
      necklineLow: Math.min(leftNeck.val, rightNeck.val),
      necklineStartTime,
      necklineStartPrice: leftNeck.val,
      necklineEndTime,
      necklineEndPrice: rightNeck.val,
      measuredMove,
      sl,
      headTime,
      rightShoulderTime
    };
  }

  return null;
}

function findAlternatingPivots(candles, radius) {
  const rawPivots = [];

  for (let i = radius; i < candles.length - radius; i++) {
    const window = candles.slice(i - radius, i + radius + 1);
    const isHigh = candles[i].high === Math.max(...window.map(candle => candle.high));
    const isLow = candles[i].low === Math.min(...window.map(candle => candle.low));
    if (isHigh === isLow) continue;

    rawPivots.push({
      type: isHigh ? "high" : "low",
      val: isHigh ? candles[i].high : candles[i].low,
      idx: i
    });
  }

  const pivots = [];
  for (const pivot of rawPivots) {
    const previous = pivots[pivots.length - 1];
    if (!previous || previous.type !== pivot.type) {
      pivots.push(pivot);
      continue;
    }

    const isMoreExtreme = pivot.type === "high"
      ? pivot.val > previous.val
      : pivot.val < previous.val;
    if (isMoreExtreme) pivots[pivots.length - 1] = pivot;
  }

  return pivots;
}

function calculatePatternATR(candles, newestIdx, oldestIdx, period = 14) {
  const trueRanges = [];
  const start = Math.max(newestIdx, 1);
  const end = Math.min(oldestIdx, start + period);

  for (let i = start; i < end; i++) {
    const candle = candles[i];
    const previousClose = candles[i + 1]?.close;
    const trueRange = Number.isFinite(previousClose)
      ? Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose)
      )
      : candle.high - candle.low;
    trueRanges.push(trueRange);
  }

  if (trueRanges.length === 0) return NaN;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
}
