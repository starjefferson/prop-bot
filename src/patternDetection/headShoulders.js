/**
 * headShoulders.js
 * Flexible structural detection for H&S and Inverted H&S patterns.
 * Scans 200 candles for local extrema, sets SL at Right Shoulder (s2) + 5-pip buffer,
 * and dynamically projects TP using historical Support & Resistance zones (2.5 - 3.0 RR).
 */

export function detectPatterns(candles, symbol = "") {
  if (!candles || candles.length < 50) return null;

  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);

  // 1. Scan for Head and Shoulders (SELL)
  const hs = findHS(highs, lows, "sell", candles, symbol);
  if (hs) return hs;

  // 2. Scan for Inverted Head and Shoulders (BUY)
  const ihs = findHS(lows, highs, "buy", candles, symbol);
  if (ihs) return ihs;

  return null;
}

function getPipBuffer(val, symbol = "") {
  if (symbol.includes("JPY") || (val > 50 && val < 500)) return 0.05;
  if (symbol.includes("XAU") || symbol.includes("GOLD") || val >= 500) return 0.50;
  return 0.0005;
}

function findHS(mainData, supportData, type, candles, symbol = "") {
  let extrema = [];
  const radius = 5;
  const limit  = mainData.length - radius;

  // Identify local peaks or valleys across bars with spacing
  for (let i = radius; i < limit; i++) {
    const window = mainData.slice(i - radius, i + radius + 1);
    const isExtremum = type === "sell"
      ? (mainData[i] === Math.max(...window))
      : (mainData[i] === Math.min(...window));

    if (isExtremum) {
      const last = extrema[extrema.length - 1];
      if (!last || Math.abs(i - last.idx) >= radius) {
        extrema.push({ val: mainData[i], idx: i });
      } else if (
        (type === "sell" && mainData[i] > last.val) ||
        (type === "buy" && mainData[i] < last.val)
      ) {
        extrema[extrema.length - 1] = { val: mainData[i], idx: i };
      }
    }
  }

  if (extrema.length < 3) return null;

  // Search recent extrema triplets: s2 (Right Shoulder), head, s1 (Left Shoulder)
  const maxSearch = Math.min(extrema.length - 2, 4);

  for (let k = 0; k < maxSearch; k++) {
    const s2   = extrema[k];
    const head = extrema[k + 1];
    const s1   = extrema[k + 2];

    if (head.idx - s2.idx < 3 || s1.idx - head.idx < 3) continue;

    const buffer = getPipBuffer(s2.val, symbol);
    const headTime = candles?.[head.idx]?.time ?? head.idx;

    if (type === "sell") {
      if (head.val > s1.val && head.val > s2.val) {
        const slice1 = supportData.slice(head.idx, s1.idx);
        const slice2 = supportData.slice(s2.idx, head.idx);
        if (slice1.length === 0 || slice2.length === 0) continue;

        const trough1 = Math.min(...slice1);
        const trough2 = Math.min(...slice2);

        const nHigh = Math.max(trough1, trough2);
        const nLow  = Math.min(trough1, trough2);

        // Structural validity: shoulders must be above neckline
        if (s1.val <= nHigh || s2.val <= nHigh) continue;

        // SL placed 5 pips above Right Shoulder (s2)
        const slPrice = s2.val + buffer;
        const entryPrice = nLow; // Breakout level at neckline zone

        // Calculate TP based on Historical Support Zones & RR Rules
        const tpResult = calculateHistoricalTP(candles, entryPrice, slPrice, "sell", s1.idx);
        if (!tpResult) continue; // Rejected if Key Support blocks trade before 2.5 RR

        return {
          type: "sell",
          label: "Head and Shoulders",
          necklineHigh: nHigh,
          necklineLow:  nLow,
          sl: slPrice,
          tp: tpResult.tp,
          targetRR: tpResult.rr,
          headTime
        };
      }
    } else {
      if (head.val < s1.val && head.val < s2.val) {
        const slice1 = supportData.slice(head.idx, s1.idx);
        const slice2 = supportData.slice(s2.idx, head.idx);
        if (slice1.length === 0 || slice2.length === 0) continue;

        const peak1 = Math.max(...slice1);
        const peak2 = Math.max(...slice2);

        const nHigh = Math.max(peak1, peak2);
        const nLow  = Math.min(peak1, peak2);

        // Structural validity: shoulders must be below neckline
        if (s1.val >= nLow || s2.val >= nLow) continue;

        // SL placed 5 pips below Right Shoulder (s2)
        const slPrice = s2.val - buffer;
        const entryPrice = nHigh; // Breakout level at neckline zone

        // Calculate TP based on Historical Resistance Zones & RR Rules
        const tpResult = calculateHistoricalTP(candles, entryPrice, slPrice, "buy", s1.idx);
        if (!tpResult) continue; // Rejected if Key Resistance blocks trade before 2.5 RR

        return {
          type: "buy",
          label: "Inverted Head and Shoulders",
          necklineHigh: nHigh,
          necklineLow:  nLow,
          sl: slPrice,
          tp: tpResult.tp,
          targetRR: tpResult.rr,
          headTime
        };
      }
    }
  }

  return null;
}

/**
 * Historical Support & Resistance TP Calculation:
 * Caps at 3.0 RR max, rejects if nearest support/resistance blocks the trade before 2.5 RR.
 * Searches historical bars prior to current pattern formation (i >= s1Idx).
 */
function calculateHistoricalTP(candles, entryPrice, slPrice, type, s1Idx = 0) {
  const risk = Math.abs(entryPrice - slPrice);
  if (risk <= 0) return null;

  const minRR = 2.5;
  const maxRR = 3.0;
  const radius = 5;

  const startIdx = Math.max(s1Idx, radius);
  const endIdx = candles.length - radius;

  if (type === "sell") {
    const minRewardTarget = entryPrice - (risk * minRR);
    const maxRewardTarget = entryPrice - (risk * maxRR);

    const supportZones = [];
    for (let i = startIdx; i < endIdx; i++) {
      const windowLows = candles.slice(i - radius, i + radius + 1).map(c => c.low);
      if (candles[i].low === Math.min(...windowLows)) {
        supportZones.push(candles[i].low);
      }
    }

    // Check if any key support blocks trade before reaching 2.5 RR
    const blockingSupport = supportZones.find(s => s < entryPrice && s > minRewardTarget);
    if (blockingSupport !== undefined) {
      return null; // Blocked by support before 2.5 RR
    }

    // Find support zones within the [2.5, 3.0] RR window
    const validTargets = supportZones.filter(s => s <= minRewardTarget && s >= maxRewardTarget);

    let targetTP;
    let rr;

    if (validTargets.length > 0) {
      targetTP = Math.max(...validTargets);
      rr = (entryPrice - targetTP) / risk;
    } else {
      targetTP = maxRewardTarget;
      rr = maxRR;
    }

    return { tp: targetTP, rr: Math.min(maxRR, Math.max(minRR, rr)) };

  } else {
    // Buy
    const minRewardTarget = entryPrice + (risk * minRR);
    const maxRewardTarget = entryPrice + (risk * maxRR);

    const resistanceZones = [];
    for (let i = startIdx; i < endIdx; i++) {
      const windowHighs = candles.slice(i - radius, i + radius + 1).map(c => c.high);
      if (candles[i].high === Math.max(...windowHighs)) {
        resistanceZones.push(candles[i].high);
      }
    }

    // Check if any key resistance blocks trade before reaching 2.5 RR
    const blockingResistance = resistanceZones.find(r => r > entryPrice && r < minRewardTarget);
    if (blockingResistance !== undefined) {
      return null; // Blocked by resistance before 2.5 RR
    }

    // Find resistance zones within the [2.5, 3.0] RR window
    const validTargets = resistanceZones.filter(r => r >= minRewardTarget && r <= maxRewardTarget);

    let targetTP;
    let rr;

    if (validTargets.length > 0) {
      targetTP = Math.min(...validTargets);
      rr = (targetTP - entryPrice) / risk;
    } else {
      targetTP = maxRewardTarget;
      rr = maxRR;
    }

    return { tp: targetTP, rr: Math.min(maxRR, Math.max(minRR, rr)) };
  }
}