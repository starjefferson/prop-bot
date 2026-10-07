/**
 * headShoulders.js
 * Flexible structural detection for H&S and Inverted H&S patterns.
 * Scans 200 candles for local extrema, sets SL at Right Shoulder (s2) + pip buffer,
 * and dynamically projects TP using historical Support & Resistance zones (2.5 - 3.0 RR).
 *
 * HTF Confluence Rules:
 *  - HEAD must originate near a 1D/1W Resistance (SELL) or Support (BUY) zone.
 *  - The breakout path must have >= 1.0x SL distance of clearance before the
 *    nearest opposing HTF zone.
 */

// ─── HTF Zone Generation ────────────────────────────────────────────────────

/**
 * Generates HTF Support & Resistance zones from a candle array.
 * Uses a wider pivot radius (10 bars) suitable for daily/weekly candles.
 *
 * @param {Array} candles  - Array of candle objects { high, low, close, ... }
 * @returns {{ resistances: number[], supports: number[] }}
 */
export function generateHTFZones(candles) {
  if (!candles || candles.length < 20) return { resistances: [], supports: [] };

  const radius = 10;
  const limit  = candles.length - radius;
  const resistances = [];
  const supports    = [];

  for (let i = radius; i < limit; i++) {
    const window      = candles.slice(i - radius, i + radius + 1);
    const windowHighs = window.map(c => c.high);
    const windowLows  = window.map(c => c.low);

    // Swing high → Resistance zone
    if (candles[i].high === Math.max(...windowHighs)) {
      resistances.push(candles[i].high);
    }

    // Swing low → Support zone
    if (candles[i].low === Math.min(...windowLows)) {
      supports.push(candles[i].low);
    }
  }

  return { resistances, supports };
}

// ─── HTF Catalyst Confluence (Head Position) ────────────────────────────────

/**
 * Checks whether a Head peak or valley originated at a qualifying HTF zone.
 * Proximity tolerance: within 0.3% of the HTF zone level.
 *
 * @param {number}   headVal    - The head's extreme price (high for sell, low for buy)
 * @param {number[]} htfLevels  - Array of HTF resistance (sell) or support (buy) prices
 * @param {"sell"|"buy"} type
 * @returns {boolean}
 */
function isHeadAtHTFZone(headVal, htfLevels, type) {
  if (!htfLevels || htfLevels.length === 0) return false;
  const tolerancePct = 0.003; // 0.3%

  for (const level of htfLevels) {
    const tolerance = level * tolerancePct;
    if (type === "sell") {
      // Head peak should be at or just below a resistance level
      if (headVal >= level - tolerance && headVal <= level + tolerance) return true;
    } else {
      // Head valley should be at or just above a support level
      if (headVal >= level - tolerance && headVal <= level + tolerance) return true;
    }
  }
  return false;
}

// ─── Path Clearance Guard (Obstacle at Breakout Entry) ──────────────────────

/**
 * Determines whether there is sufficient clearance between the neckline entry
 * and the nearest opposing HTF zone in the direction of the trade.
 * Rule: clearance must be >= 1.0x the SL distance; otherwise reject.
 *
 * @param {number}   entryPrice   - Neckline breakout price
 * @param {number}   slDistance   - Absolute distance from entry to SL
 * @param {number[]} htfLevels    - Opposing HTF zone levels
 * @param {"sell"|"buy"} type
 * @returns {{ clear: boolean, nearestLevel: number|null, clearance: number }}
 */
function getPathClearance(entryPrice, slDistance, htfLevels, type) {
  if (!htfLevels || htfLevels.length === 0) {
    return { clear: true, nearestLevel: null, clearance: Infinity };
  }

  let nearestLevel = null;
  let clearance    = Infinity;

  if (type === "sell") {
    // For SELL: find nearest HTF Support BELOW entry
    const below = htfLevels.filter(l => l < entryPrice);
    if (below.length > 0) {
      nearestLevel = Math.max(...below);
      clearance    = entryPrice - nearestLevel;
    }
  } else {
    // For BUY: find nearest HTF Resistance ABOVE entry
    const above = htfLevels.filter(l => l > entryPrice);
    if (above.length > 0) {
      nearestLevel = Math.min(...above);
      clearance    = nearestLevel - entryPrice;
    }
  }

  const clear = clearance >= slDistance * 1.0;
  return { clear, nearestLevel, clearance };
}

// ─── Pip Buffer Helper ───────────────────────────────────────────────────────

function getPipBuffer(val, symbol = "") {
  if (symbol.includes("JPY") || (val > 50 && val < 500)) return 0.05;
  if (symbol.includes("XAU") || symbol.includes("GOLD") || val >= 500) return 0.50;
  return 0.0005;
}

// ─── Public Detection Entry Point ────────────────────────────────────────────

/**
 * Detects H&S / Inverted H&S patterns on the supplied candle array.
 *
 * HTF confluence filters are applied here using 1D and 1W candle data:
 *   1. Head must be at a qualifying HTF Resistance (sell) or Support (buy) zone.
 *   2. Breakout path must clear the nearest opposing HTF zone by >= 1.0x SL distance.
 *
 * @param {Array}  candles        - Structural candles (4H or 1D timeframe)
 * @param {Array}  htf1DCandles   - Daily candles for HTF zone generation
 * @param {Array}  htf1WCandles   - Weekly candles for HTF zone generation
 * @param {string} [symbol]       - Symbol string for logging
 * @returns {Object|null}
 */
export function detectPatterns(candles, htf1DCandles, htf1WCandles, symbol = "") {
  if (!candles || candles.length < 50) return null;

  // Build combined HTF zones from 1D and 1W candles
  const zones1D = generateHTFZones(htf1DCandles || []);
  const zones1W = generateHTFZones(htf1WCandles || []);

  const htfResistances = [...zones1D.resistances, ...zones1W.resistances];
  const htfSupports    = [...zones1D.supports,    ...zones1W.supports];

  // 1. Scan for Head and Shoulders (SELL)
  const hs = findHS(candles, "sell", symbol, htfResistances, htfSupports);
  if (hs?.rejected) return hs;
  if (hs) return hs;

  // 2. Scan for Inverted Head and Shoulders (BUY)
  const ihs = findHS(candles, "buy", symbol, htfResistances, htfSupports);
  if (ihs?.rejected) return ihs;
  if (ihs) return ihs;

  return null;
}

// ─── Internal Pattern Finder ─────────────────────────────────────────────────

/**
 * Core H&S / Inverted H&S structural finder.
 *
 * @param {Array}    candles         - Structural candles (4H or 1D)
 * @param {"sell"|"buy"} type
 * @param {string}   symbol          - For logging
 * @param {number[]} htfResistances  - Combined 1D+1W resistance levels
 * @param {number[]} htfSupports     - Combined 1D+1W support levels
 * @returns {Object|null}
 */
function findHS(candles, type, symbol, htfResistances, htfSupports) {
  const mainData    = type === "sell" ? candles.map(c => c.high) : candles.map(c => c.low);
  const supportData = type === "sell" ? candles.map(c => c.low)  : candles.map(c => c.high);

  let extrema = [];
  const radius = 5;
  const limit  = mainData.length - radius;

  // Identify local peaks (sell) or valleys (buy) with spacing deduplication
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
        (type === "buy"  && mainData[i] < last.val)
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

    const buffer   = getPipBuffer(s2.val, symbol);
    const headTime = candles?.[head.idx]?.time ?? head.idx;

    if (type === "sell") {
      if (!(head.val > s1.val && head.val > s2.val)) continue;

      const slice1 = supportData.slice(head.idx, s1.idx);
      const slice2 = supportData.slice(s2.idx, head.idx);
      if (slice1.length === 0 || slice2.length === 0) continue;

      const trough1 = Math.min(...slice1);
      const trough2 = Math.min(...slice2);
      const nHigh   = Math.max(trough1, trough2);
      const nLow    = Math.min(trough1, trough2);

      // Structural validity: shoulders must be above neckline
      if (s1.val <= nHigh || s2.val <= nHigh) continue;

      const slPrice    = s2.val + buffer;
      const entryPrice = nLow; // Neckline breakout level

      // ── Rule 1: HTF Catalyst Confluence — Head at HTF Resistance ───────────
      if (!isHeadAtHTFZone(head.val, htfResistances, "sell")) {
        console.log(`❌ [${symbol}] REJECTED: Head did not form at HTF Resistance.`);
        return { rejected: true };
      }

      // ── Rule 2: Path Clearance — No HTF Support blocking the sell path ─────
      const slDistance = Math.abs(entryPrice - slPrice);
      const pathCheck  = getPathClearance(entryPrice, slDistance, htfSupports, "sell");
      if (!pathCheck.clear) {
        console.log(
          `❌ [${symbol}] REJECTED: Insufficient clearance to opposing HTF Zone ` +
          `(Requires >= 1.0x SL distance). ` +
          `Clearance: ${pathCheck.clearance.toFixed(5)} | SL Distance: ${slDistance.toFixed(5)} | ` +
          `Nearest HTF Support: ${pathCheck.nearestLevel}`
        );
        return { rejected: true };
      }

      // ── TP Calculation ──────────────────────────────────────────────────────
      const tpResult = calculateHistoricalTP(candles, entryPrice, slPrice, "sell", s1.idx);
      if (!tpResult) continue; // Rejected if key support blocks trade before 2.5 RR

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

    } else {
      if (!(head.val < s1.val && head.val < s2.val)) continue;

      const slice1 = supportData.slice(head.idx, s1.idx);
      const slice2 = supportData.slice(s2.idx, head.idx);
      if (slice1.length === 0 || slice2.length === 0) continue;

      const peak1 = Math.max(...slice1);
      const peak2 = Math.max(...slice2);
      const nHigh = Math.max(peak1, peak2);
      const nLow  = Math.min(peak1, peak2);

      // Structural validity: shoulders must be below neckline
      if (s1.val >= nLow || s2.val >= nLow) continue;

      const slPrice    = s2.val - buffer;
      const entryPrice = nHigh; // Neckline breakout level

      // ── Rule 1: HTF Catalyst Confluence — Head at HTF Support ──────────────
      if (!isHeadAtHTFZone(head.val, htfSupports, "buy")) {
        console.log(`❌ [${symbol}] REJECTED: Head did not form at HTF Support.`);
        return { rejected: true };
      }

      // ── Rule 2: Path Clearance — No HTF Resistance blocking the buy path ───
      const slDistance = Math.abs(entryPrice - slPrice);
      const pathCheck  = getPathClearance(entryPrice, slDistance, htfResistances, "buy");
      if (!pathCheck.clear) {
        console.log(
          `❌ [${symbol}] REJECTED: Insufficient clearance to opposing HTF Zone ` +
          `(Requires >= 1.0x SL distance). ` +
          `Clearance: ${pathCheck.clearance.toFixed(5)} | SL Distance: ${slDistance.toFixed(5)} | ` +
          `Nearest HTF Resistance: ${pathCheck.nearestLevel}`
        );
        return { rejected: true };
      }

      // ── TP Calculation ──────────────────────────────────────────────────────
      const tpResult = calculateHistoricalTP(candles, entryPrice, slPrice, "buy", s1.idx);
      if (!tpResult) continue; // Rejected if key resistance blocks trade before 2.5 RR

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

  return null;
}

// ─── Historical TP Calculation ───────────────────────────────────────────────

/**
 * Historical Support & Resistance TP Calculation:
 * Caps at 3.0 RR max, rejects if nearest support/resistance blocks the trade before 2.5 RR.
 * Searches historical bars prior to current pattern formation (i >= s1Idx).
 */
function calculateHistoricalTP(candles, entryPrice, slPrice, type, s1Idx = 0) {
  const risk = Math.abs(entryPrice - slPrice);
  if (risk <= 0) return null;

  const minRR  = 2.5;
  const maxRR  = 3.0;
  const radius = 5;

  const startIdx = Math.max(s1Idx, radius);
  const endIdx   = candles.length - radius;

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
    if (blockingSupport !== undefined) return null;

    // Find support zones within the [2.5, 3.0] RR window
    const validTargets = supportZones.filter(s => s <= minRewardTarget && s >= maxRewardTarget);

    let targetTP, rr;
    if (validTargets.length > 0) {
      targetTP = Math.max(...validTargets);
      rr       = (entryPrice - targetTP) / risk;
    } else {
      targetTP = maxRewardTarget;
      rr       = maxRR;
    }

    return { tp: targetTP, rr: Math.min(maxRR, Math.max(minRR, rr)) };

  } else {
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
    if (blockingResistance !== undefined) return null;

    // Find resistance zones within the [2.5, 3.0] RR window
    const validTargets = resistanceZones.filter(r => r >= minRewardTarget && r <= maxRewardTarget);

    let targetTP, rr;
    if (validTargets.length > 0) {
      targetTP = Math.min(...validTargets);
      rr       = (targetTP - entryPrice) / risk;
    } else {
      targetTP = maxRewardTarget;
      rr       = maxRR;
    }

    return { tp: targetTP, rr: Math.min(maxRR, Math.max(minRR, rr)) };
  }
}