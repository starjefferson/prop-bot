import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initializeFixClient, getCandles, getAccountBalance, placeFixOrder } from "./api/ctraderFixClient.js";
import { runDetection } from "./patternDetection/patternEngine.js";
import { checkTopDownAlignment } from "./patternDetection/topDownAnalysis.js";
import { PropRiskEngine } from "./risk/propRiskEngine.js";
import { config as defaultConfig } from "../config/default.js";

dotenv.config({ path: ".env.local" });

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD"];
const HISTORY_PATH = path.resolve(process.cwd(), "history.json");
const ACTIVE_PROP_FIRM = process.env.ACTIVE_PROP_FIRM || "alpha_capital";
const RISK_PERCENT = parseFloat(process.env.RISK_PERCENT || "2.0");
const MIN_RR = parseFloat(process.env.MIN_RR || "2.5");
const MAX_RR = parseFloat(process.env.MAX_RR || "3.0");
const MAX_CONCURRENT_TRADES = parseInt(process.env.MAX_CONCURRENT_TRADES || String(defaultConfig.maxConcurrentTrades || 3), 10);

const loadJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, "[]"); return []; }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) { return []; }
};

const saveJSON = (filePath, data) => {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.error(`❌ DISK ERROR: ${e.message}`); }
};

async function runTradingCycle(riskEngine) {
  console.log(`\n==================================================`);
  console.log(`🔍 [${new Date().toISOString()}] Starting cTrader FIX Market Scan...`);
  console.log(`==================================================`);

  const history = loadJSON(HISTORY_PATH);
  const balance = await getAccountBalance();
  let executedInCycle = 0;

  for (const symbol of PAIRS) {
    if (executedInCycle >= MAX_CONCURRENT_TRADES) {
      console.log(`⏹️ Max concurrent trade limit (${MAX_CONCURRENT_TRADES}) reached for this cycle.`);
      break;
    }

    try {
      // 1. Fetch Candle History across 1W, 1D, 4H, and 1H
      const w1 = await getCandles(symbol, "1W", 50);
      const d1 = await getCandles(symbol, "1D", 200);
      const h4 = await getCandles(symbol, "4H", 200);
      const h1 = await getCandles(symbol, "1H", 200);

      if (!w1 || !d1 || !h4 || !h1 || h1.length < 50) {
        console.log(`⚠️ [${symbol}] Insufficient candle history returned.`);
        continue;
      }

      const candleData = { "1W": w1, "1D": d1, "4H": h4, "1H": h1 };
      const currentPrice = h1[0].close;

      // 2. Trend Bias Check (3/4 SMA Rule)
      const bias = checkTopDownAlignment(candleData, ["1W", "1D", "4H", "1H"]);
      console.log(`📡 [${symbol}] Price: ${currentPrice} | 3/4 SMA Trend Bias: ${bias ? bias.toUpperCase() : "NONE"}`);

      if (!bias) continue;

      // 3. Structural Pattern Detection
      const pattern = runDetection(candleData, symbol);
      if (!pattern) continue;

      if (pattern.type !== bias) {
        console.log(`⚠️ [${symbol}] Pattern (${pattern.type.toUpperCase()}) conflicts with Trend Bias (${bias.toUpperCase()})`);
        continue;
      }

      // 4. Pattern Fingerprinting Guard (One & Done)
      const patternID = `${symbol}_${pattern.type}_${pattern.headTime}`;
      if (history.find(h => h.patternID === patternID)) {
        console.log(`ℹ️ [${symbol}] Pattern ${patternID} already processed.`);
        continue;
      }

      // 5. Distribution Guard (Prevents chasing late moves)
      const isJpy = symbol.includes("JPY");
      const isGold = symbol.includes("XAU");
      const tooFar = isGold ? 2.0 : (isJpy ? 0.20 : 0.0020);
      if (pattern.type === "sell" && currentPrice < (pattern.necklineLow - tooFar)) {
        console.log(`❌ [${symbol}] Setup Expired: Price already distributed past neckline.`);
        continue;
      }
      if (pattern.type === "buy" && currentPrice > (pattern.necklineHigh + tooFar)) {
        console.log(`❌ [${symbol}] Setup Expired: Price already distributed past neckline.`);
        continue;
      }

      // 6. Breakout & Close Trigger Check
      const isBreakout = (pattern.type === "sell" && currentPrice < pattern.necklineLow) ||
                         (pattern.type === "buy" && currentPrice > pattern.necklineHigh);

      if (!isBreakout) {
        console.log(`⏳ [${symbol}] Setup Valid. Waiting for breakout close past zone [${pattern.necklineLow} - ${pattern.necklineHigh}]`);
        continue;
      }

      // 7. Risk-to-Reward (RR) Filter
      const risk = Math.abs(currentPrice - pattern.sl);
      const reward = Math.abs(pattern.tp - currentPrice);
      const rr = reward / risk;

      if (rr < MIN_RR || rr > MAX_RR) {
        console.log(`⚠️ [${symbol}] Rejected RR: ${rr.toFixed(2)} (Target: ${MIN_RR} - ${MAX_RR})`);
        continue;
      }

      // 8. Prop Firm Compliance Interceptor
      const riskValidation = riskEngine.validateOrder({
        balance,
        currentEquity: balance,
        symbol,
        entryPrice: currentPrice,
        slPrice: pattern.sl,
        riskPercent: RISK_PERCENT
      });

      if (!riskValidation.allowed) {
        console.warn(`🛑 [Risk Engine] Trade blocked for ${symbol}: ${riskValidation.reason}`);
        continue;
      }

      // 9. Position Sizing & Direct FIX Order Execution
      let unitsToTrade;
      if (symbol.includes("JPY")) {
        unitsToTrade = Math.round((riskValidation.maxCapitalToRisk * currentPrice) / risk);
      } else if (symbol.endsWith("USD")) {
        unitsToTrade = Math.round(riskValidation.maxCapitalToRisk / risk);
      } else {
        unitsToTrade = Math.round((riskValidation.maxCapitalToRisk * currentPrice) / risk);
      }

      const minUnits = symbol.includes("XAU") ? 1 : 1000;
      unitsToTrade = Math.max(minUnits, unitsToTrade);

      console.log(`🎯 [${symbol}] TARGET RR ACHIEVED (${rr.toFixed(2)}). Executing cTrader FIX Order... Units: ${unitsToTrade}`);

      const orderResult = await placeFixOrder({
        symbol,
        units: unitsToTrade,
        side: pattern.type,
        sl: pattern.sl,
        tp: pattern.tp
      });

      executedInCycle++;

      // Log trade to history.json
      history.push({
        patternID,
        symbol,
        type: pattern.type,
        entryPrice: currentPrice,
        sl: pattern.sl,
        tp: pattern.tp,
        units: unitsToTrade,
        rr: rr.toFixed(2),
        propFirm: ACTIVE_PROP_FIRM,
        orderId: orderResult.clOrdId,
        executionTime: new Date().toISOString()
      });
      saveJSON(HISTORY_PATH, history);

    } catch (err) {
      console.error(`❌ Scan error for ${symbol}:`, err.message);
    }
  }
}

/**
 * Smart Hourly Scheduler (Runs at :00:05 UTC every hour)
 */
function scheduleNextHourlyScan(riskEngine) {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 5, 0);

  const delayMs = nextHour.getTime() - now.getTime();
  const minutesRemaining = (delayMs / 1000 / 60).toFixed(1);

  console.log(`\n⏰ Next cTrader scan scheduled in ${minutesRemaining} minutes (at ${nextHour.toLocaleTimeString()}).`);

  setTimeout(async () => {
    // Check if new UTC day for daily drawdown baseline reset (00:00 UTC)
    const currentUtc = new Date();
    if (currentUtc.getUTCHours() === 0) {
      const freshBalance = await getAccountBalance();
      riskEngine.updateStartOfDayBalance(freshBalance);
    }

    await runTradingCycle(riskEngine);
    scheduleNextHourlyScan(riskEngine);
  }, delayMs);
}

// Engine Startup
async function startBot() {
  console.log("🚀 Initializing Autonomous cTrader FIX Engine...");
  try {
    await initializeFixClient();
  } catch (e) {
    console.warn("⚠️ [cTrader FIX] Could not establish live SSL session on startup. Continuing in diagnostic/dry-run mode.");
  }

  const balance = await getAccountBalance();
  const riskEngine = new PropRiskEngine(ACTIVE_PROP_FIRM, balance, balance);

  await runTradingCycle(riskEngine);
  scheduleNextHourlyScan(riskEngine);
}

startBot();