import { detectPatterns } from "./headShoulders.js";

/**
 * Detect structure on 4H/1D and enter on the first closed 1H candle that
 * clears the sloped neckline by the configured pip buffer.
 */
export function runDetection(
  candleData,
  symbol,
  expectedBias,
  onPatternDetected,
  { breakoutBuffer = getPipSize(symbol) * 2, minimumRR = 2.5 } = {}
) {
  if (expectedBias !== "buy" && expectedBias !== "sell") {
    console.log(`⚠️ [${symbol}] Pattern detection skipped: directional trend bias is required.`);
    return null;
  }

  const detectedSetups = {};
  for (const tf of ["4H", "1D"]) {
    if (!candleData[tf] || candleData[tf].length < 200) continue;

    let geometryFound = false;
    const result = detectPatterns(candleData[tf], expectedBias, symbol, ({ type, stage }) => {
      if (stage === "geometry") {
        geometryFound = true;
        console.log(
          `🔎 [${symbol}] ${tf} ${type.toUpperCase()} geometry matches trend bias; ` +
          `calculating pattern-based trade levels.`
        );
      }
    });

    if (result) {
      detectedSetups[tf] = result;
    } else if (!geometryFound) {
      console.log(
        `ℹ️ [${symbol}] No ${expectedBias.toUpperCase()} H&S geometry found on ${tf}; ` +
        `opposite-bias patterns are ignored.`
      );
    }
  }

  const primaryPattern = detectedSetups["4H"] || detectedSetups["1D"];
  if (!primaryPattern) return null;

  if (
    detectedSetups["4H"] &&
    detectedSetups["1D"] &&
    detectedSetups["4H"].type !== detectedSetups["1D"].type
  ) {
    console.log(
      `❌ [${symbol}] Multi-TF conflict: 4H is "${detectedSetups["4H"].type}" ` +
      `but 1D is "${detectedSetups["1D"].type}". Setup rejected.`
    );
    return null;
  }

  const structuralSetup = detectedSetups["4H"] || detectedSetups["1D"];
  if (structuralSetup.type !== expectedBias) return null;

  const activeTFs = Object.keys(detectedSetups);
  const reportState = (stage) => onPatternDetected?.({
    type: structuralSetup.type,
    activeTFs,
    stage
  });

  const oneHourMs = 60 * 60 * 1000;
  const closedH1Candles = (candleData["1H"] || [])
    .filter(candle =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.close) &&
      candle.time + oneHourMs <= Date.now()
    )
    .slice(0, 200);

  if (closedH1Candles.length < 2) {
    console.log(`⏳ [${symbol}] Waiting: fewer than two fully closed 1H candles are available.`);
    reportState("waiting-data");
    return null;
  }

  const lastClosedH1 = closedH1Candles[0];
  const previousClosedH1 = closedH1Candles[1];
  const oldestClosedH1 = closedH1Candles[closedH1Candles.length - 1];
  if (structuralSetup.rightShoulderTime < oldestClosedH1.time) {
    console.log(
      `⏭️ [${symbol}] No entry: right shoulder predates available 1H breakout history; ` +
      `whether its first break was missed cannot be verified.`
    );
    reportState("breakout-history-insufficient");
    return null;
  }

  const previousBreakout = closedH1Candles.slice(1).find(candle =>
    candle.time >= structuralSetup.rightShoulderTime &&
    isBeyondNeckline(
      candle.close,
      getBreakoutLevel(structuralSetup, candle.time + oneHourMs, breakoutBuffer),
      structuralSetup.type
    )
  );
  if (previousBreakout) {
    console.log(
      `⏭️ [${symbol}] No re-entry: neckline was already broken by a closed 1H candle at ` +
      `${new Date(previousBreakout.time).toISOString()}.`
    );
    reportState("breakout-missed");
    return null;
  }

  const previousBreakoutLevel = getBreakoutLevel(
    structuralSetup,
    previousClosedH1.time + oneHourMs,
    breakoutBuffer
  );
  const breakoutLevel = getBreakoutLevel(
    structuralSetup,
    lastClosedH1.time + oneHourMs,
    breakoutBuffer
  );
  if (!checkH1NecklineBreakout(
    previousClosedH1.close,
    lastClosedH1.close,
    previousBreakoutLevel,
    breakoutLevel,
    structuralSetup.type
  )) {
    console.log(
      `⏳ [${symbol}] Waiting: no fresh 1H close cleared sloped neckline by ${breakoutBuffer} | ` +
      `Previous threshold: ${previousBreakoutLevel} | Latest threshold: ${breakoutLevel} | ` +
      `Previous close: ${previousClosedH1.close} | Latest close: ${lastClosedH1.close}.`
    );
    reportState("waiting-breakout");
    return null;
  }

  const entryPrice = lastClosedH1.close;
  const necklineAtBreakout = getNecklineAtTime(
    structuralSetup,
    lastClosedH1.time + oneHourMs
  );
  const tp = structuralSetup.type === "sell"
    ? necklineAtBreakout - structuralSetup.measuredMove
    : necklineAtBreakout + structuralSetup.measuredMove;
  const risk = structuralSetup.type === "sell"
    ? structuralSetup.sl - entryPrice
    : entryPrice - structuralSetup.sl;
  const reward = structuralSetup.type === "sell"
    ? entryPrice - tp
    : tp - entryPrice;
  const rr = risk > 0 ? reward / risk : NaN;

  if (!(risk > 0) || !(reward > 0) || !Number.isFinite(rr)) {
    console.log(
      `❌ [${symbol}] REJECTED: Invalid measured-move levels | ` +
      `Entry: ${entryPrice} | SL: ${structuralSetup.sl} | TP: ${tp}.`
    );
    reportState("invalid-levels");
    return null;
  }
  if (rr < minimumRR) {
    console.log(
      `❌ [${symbol}] REJECTED: Breakout is overextended; measured-move RR ${rr.toFixed(2)} ` +
      `is below configured minimum ${minimumRR}.`
    );
    reportState("rr-rejected");
    return null;
  }

  reportState("breakout-confirmed");
  console.log(
    `✅ [${symbol}] First 1H close beyond sloped neckline by ${breakoutBuffer} | ` +
    `Structure: ${activeTFs.join(" + ")} | Entry: ${entryPrice} | ` +
    `SL: ${structuralSetup.sl} | TP: ${tp} | RR: ${rr.toFixed(2)}`
  );

  return {
    type: structuralSetup.type,
    label: `${structuralSetup.label} (${activeTFs.join("+")} / 1H trigger)`,
    pair: symbol,
    sl: structuralSetup.sl,
    tp,
    entryPrice,
    breakoutNeckline: breakoutLevel,
    targetRR: rr,
    necklineHigh: structuralSetup.necklineHigh,
    necklineLow: structuralSetup.necklineLow,
    headTime: structuralSetup.headTime,
    activeTFs,
    timestamp: Date.now()
  };
}

function checkH1NecklineBreakout(previousClose, latestClose, previousBoundary, latestBoundary, type) {
  return type === "sell"
    ? previousClose >= previousBoundary && latestClose < latestBoundary
    : previousClose <= previousBoundary && latestClose > latestBoundary;
}

function isBeyondNeckline(close, boundary, type) {
  return type === "sell" ? close < boundary : close > boundary;
}

function getBreakoutLevel(setup, time, breakoutBuffer) {
  const neckline = getNecklineAtTime(setup, time);
  return setup.type === "sell"
    ? neckline - breakoutBuffer
    : neckline + breakoutBuffer;
}

function getNecklineAtTime(setup, time) {
  const elapsed = setup.necklineEndTime - setup.necklineStartTime;
  if (!(elapsed > 0)) return setup.necklineEndPrice;

  const progress = (time - setup.necklineStartTime) / elapsed;
  return setup.necklineStartPrice +
    (setup.necklineEndPrice - setup.necklineStartPrice) * progress;
}

function getPipSize(symbol) {
  if (symbol.includes("JPY")) return 0.01;
  if (symbol.includes("XAU") || symbol.includes("GOLD")) return 0.01;
  return 0.0001;
}
