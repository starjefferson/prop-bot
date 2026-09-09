import { detectPatterns } from "./headShoulders.js";

/**
 * Enhanced Detection Hub
 * Scans D1, H4, and H1. Requires H1 structure and multi-TF alignment.
 */
export function runDetection(candleData, symbol) {
  const timeframes = ["1D", "4H", "1H"];
  let detectedSetups = {};

  // 1. Scan timeframes for valid structural patterns
  for (const tf of timeframes) {
    if (candleData[tf] && candleData[tf].length >= 50) {
      const result = detectPatterns(candleData[tf], symbol);
      if (result) {
        detectedSetups[tf] = result;
      }
    }
  }

  // 2. Must have H1 structure
  const h1Pattern = detectedSetups["1H"];
  if (!h1Pattern) return null;

  // 3. Directional Alignment Check
  if (detectedSetups["1D"] && detectedSetups["1D"].type !== h1Pattern.type) return null;
  if (detectedSetups["4H"] && detectedSetups["4H"].type !== h1Pattern.type) return null;

  // 4. Structural Integrity Guard
  const isSell = h1Pattern.type === "sell";
  if (isSell && h1Pattern.tp >= h1Pattern.necklineLow) {
    console.log(`❌ [${symbol}] Logic Error: Sell TP is above Neckline. Pattern rejected.`);
    return null;
  }
  if (!isSell && h1Pattern.tp <= h1Pattern.necklineHigh) {
    console.log(`❌ [${symbol}] Logic Error: Buy TP is below Neckline. Pattern rejected.`);
    return null;
  }

  return {
    type: h1Pattern.type,
    label: `${h1Pattern.label} (Multi-TF)`,
    pair: symbol,
    sl: h1Pattern.sl,
    tp: h1Pattern.tp,
    necklineHigh: h1Pattern.necklineHigh,
    necklineLow: h1Pattern.necklineLow,
    headTime: h1Pattern.headTime || Date.now(),
    activeTFs: Object.keys(detectedSetups),
    timestamp: Date.now()
  };
}