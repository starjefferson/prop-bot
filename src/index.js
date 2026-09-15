// [File: index.js]
// [File: src/index.js]

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import MetaApi from "metaapi.cloud-sdk";
import { runDetection } from "./patternDetection/patternEngine.js";
import { checkTopDownAlignment } from "./patternDetection/topDownAnalysis.js";
import { PropRiskEngine } from "./risk/propRiskEngine.js";

dotenv.config({ path: ".env.local" });

// [Target Asset List: All 7 Major FX Pairs]

// [Expanded Asset List for Fast Demo Verification]
const PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
  "GBPJPY", "EURJPY", "EURAUD", "GBPAUD", "XAUUSD"
];

const HISTORY_PATH = path.resolve(process.cwd(), "history.json");
const ACTIVE_PROP_FIRM = process.env.ACTIVE_PROP_FIRM || "atlas_2step_eval";
const RISK_PERCENT = parseFloat(process.env.RISK_PERCENT || "1.0");
const MIN_RR = parseFloat(process.env.MIN_RR || "2.5");
const MAX_RR = parseFloat(process.env.MAX_RR || "3.0");
const MAX_CONCURRENT_TRADES = parseInt(process.env.MAX_CONCURRENT_TRADES || "2", 10);

const METAAPI_TOKEN = process.env.METAAPI_TOKEN;
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;

// [Helper: Load JSON file from disk]
const loadJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, "[]"); return []; }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) { return []; }
};

// [Helper: Save JSON file to disk]
const saveJSON = (filePath, data) => {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.error(`❌ DISK ERROR: ${e.message}`); }
};

// [Helper: Map timeframe standard code to MetaApi format]
function getMetaApiTimeframe(tf) {
  const map = { "1W": "1w", "1D": "1d", "4H": "4h", "1H": "1h" };
  return map[tf] || "1h";
}

// [Helper: Stream historical candle data via MetaApi SDK]
async function fetchMetaApiCandles(account, symbol, tf, count) {
  try {
    const metaApiTf = getMetaApiTimeframe(tf);
    const candles = await account.getHistoricalCandles(symbol, metaApiTf, null, count);
    if (!candles || candles.length === 0) return null;

    return candles.map(c => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      time: new Date(c.time).getTime()
    })).reverse();
  } catch (err) {
    console.error(`⚠️ MetaApi candle fetch error for ${symbol} (${tf}):`, err.message);
    return null;
  }
}

// [Main Market Scan Cycle]
async function runTradingCycle(metaApiConnection, account, riskEngine) {
  console.log(`\n==================================================`);
  console.log(`🔍 [${new Date().toISOString()}] Starting MetaApi Scan across Major FX Pairs...`);
  console.log(`==================================================`);

  const history = loadJSON(HISTORY_PATH);
  const accountInformation = await metaApiConnection.getAccountInformation();
  const balance = accountInformation.balance;
  const equity = accountInformation.equity;

  let executedInCycle = 0;

  for (const symbol of PAIRS) {
    if (executedInCycle >= MAX_CONCURRENT_TRADES) {
      console.log(`⏹️ Max concurrent trade limit (${MAX_CONCURRENT_TRADES}) reached for this cycle.`);
      break;
    }

    try {
      // [Step 1: Fetch Candle History across 1W, 1D, 4H, and 1H]
      const w1 = await fetchMetaApiCandles(account, symbol, "1W", 50);
      const d1 = await fetchMetaApiCandles(account, symbol, "1D", 200);
      const h4 = await fetchMetaApiCandles(account, symbol, "4H", 200);
      const h1 = await fetchMetaApiCandles(account, symbol, "1H", 200);

      if (!w1 || !d1 || !h4 || !h1 || h1.length < 50) {
        console.log(`⚠️ [${symbol}] Insufficient candle history returned.`);
        continue;
      }

      const candleData = { "1W": w1, "1D": d1, "4H": h4, "1H": h1 };
      const currentPrice = h1[0].close;

      // [Step 2: Trend Bias Evaluation via 3/4 SMA Rule]
      const bias = checkTopDownAlignment(candleData, ["1W", "1D", "4H", "1H"]);
      console.log(`📡 [${symbol}] Price: ${currentPrice} | 3/4 SMA Trend Bias: ${bias ? bias.toUpperCase() : "NONE"}`);

      if (!bias) continue;

      // [Step 3: Structural Pattern Detection]
      const pattern = runDetection(candleData, symbol);
      if (!pattern) continue;

      if (pattern.type !== bias) {
        console.log(`⚠️ [${symbol}] Pattern (${pattern.type.toUpperCase()}) conflicts with Trend Bias (${bias.toUpperCase()})`);
        continue;
      }

      // [Step 4: Pattern Fingerprint Guard]
      const patternID = `${symbol}_${pattern.type}_${pattern.headTime}`;
      if (history.find(h => h.patternID === patternID)) {
        console.log(`ℹ️ [${symbol}] Pattern ${patternID} already processed.`);
        continue;
      }

      // [Step 5: Distribution Guard Check]
      const isJpy = symbol.includes("JPY");
      const tooFar = isJpy ? 0.20 : 0.0020;
      if (pattern.type === "sell" && currentPrice < (pattern.necklineLow - tooFar)) {
        console.log(`❌ [${symbol}] Setup Expired: Price already distributed past neckline.`);
        continue;
      }
      if (pattern.type === "buy" && currentPrice > (pattern.necklineHigh + tooFar)) {
        console.log(`❌ [${symbol}] Setup Expired: Price already distributed past neckline.`);
        continue;
      }

      // [Step 6: Breakout & Close Trigger Check]
      const isBreakout = (pattern.type === "sell" && currentPrice < pattern.necklineLow) ||
                         (pattern.type === "buy" && currentPrice > pattern.necklineHigh);

      if (!isBreakout) {
        console.log(`⏳ [${symbol}] Setup Valid. Waiting for breakout close past zone [${pattern.necklineLow} - ${pattern.necklineHigh}]`);
        continue;
      }

      // [Step 7: Risk-to-Reward Ratio Filter]
      const risk = Math.abs(currentPrice - pattern.sl);
      const reward = Math.abs(pattern.tp - currentPrice);
      const rr = reward / risk;

      if (rr < MIN_RR || rr > MAX_RR) {
        console.log(`⚠️ [${symbol}] Rejected RR: ${rr.toFixed(2)} (Target: ${MIN_RR} - ${MAX_RR})`);
        continue;
      }

      // [Step 8: Prop Risk Engine Interceptor]
      const riskValidation = riskEngine.validateOrder({
        balance,
        currentEquity: equity,
        symbol,
        entryPrice: currentPrice,
        slPrice: pattern.sl,
        riskPercent: RISK_PERCENT
      });

      if (!riskValidation.allowed) {
        console.warn(`🛑 [Risk Engine] Trade blocked for ${symbol}: ${riskValidation.reason}`);
        continue;
      }

      // [Step 9: Lot Sizing & MT5 Execution via MetaApi]
      let lotSize;
      if (symbol.includes("JPY")) {
        lotSize = (riskValidation.maxCapitalToRisk * currentPrice) / (risk * 100000);
      } else {
        lotSize = riskValidation.maxCapitalToRisk / (risk * 100000);
      }

      lotSize = Math.max(0.01, Math.round(lotSize * 100) / 100);

      console.log(`🎯 [${symbol}] TARGET RR ACHIEVED (${rr.toFixed(2)}). Executing MetaApi MT5 Order... Lots: ${lotSize}`);

      const orderResult = await metaApiConnection.createMarketBuyOrder(
        symbol,
        lotSize,
        pattern.sl,
        pattern.tp,
        { comment: `H&S Bot - ${ACTIVE_PROP_FIRM}` }
      );

      executedInCycle++;

      history.push({
        patternID,
        symbol,
        type: pattern.type,
        entryPrice: currentPrice,
        sl: pattern.sl,
        tp: pattern.tp,
        lots: lotSize,
        rr: rr.toFixed(2),
        propFirm: ACTIVE_PROP_FIRM,
        orderId: orderResult.numericCode || orderResult.stringCode,
        executionTime: new Date().toISOString()
      });
      saveJSON(HISTORY_PATH, history);

    } catch (err) {
      console.error(`❌ Scan error for ${symbol}:`, err.message);
    }
  }
}

// [Smart Hourly Scheduler: Runs at :00:05 UTC every hour]
function scheduleNextHourlyScan(metaApiConnection, account, riskEngine) {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 5, 0);

  const delayMs = nextHour.getTime() - now.getTime();
  const minutesRemaining = (delayMs / 1000 / 60).toFixed(1);

  console.log(`\n⏰ Next scan scheduled in ${minutesRemaining} minutes (at ${nextHour.toLocaleTimeString()}).`);

  setTimeout(async () => {
    const currentUtc = new Date();
    if (currentUtc.getUTCHours() === 0) {
      const info = await metaApiConnection.getAccountInformation();
      riskEngine.updateStartOfDayBalance(info.balance);
    }

    await runTradingCycle(metaApiConnection, account, riskEngine);
    scheduleNextHourlyScan(metaApiConnection, account, riskEngine);
  }, delayMs);
}

// [Engine Initialization & MetaApi Connection Sequence]
async function startBot() {
  console.log("🚀 Initializing Standalone MetaApi FX Engine...");

  if (!METAAPI_TOKEN || !METAAPI_ACCOUNT_ID) {
    console.error("❌ ERROR: Missing METAAPI_TOKEN or METAAPI_ACCOUNT_ID in .env.local file.");
    process.exit(1);
  }

  const api = new MetaApi(METAAPI_TOKEN);
  const account = await api.metatraderAccountApi.getAccount(METAAPI_ACCOUNT_ID);

  console.log("🔌 [MetaApi] Connecting to MT5 Account...");
  await account.waitConnected();

  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();

  console.log("✅ [MetaApi] Connected and synchronized successfully!");

  const accountInfo = await connection.getAccountInformation();
  const riskEngine = new PropRiskEngine(ACTIVE_PROP_FIRM, accountInfo.balance, accountInfo.balance);

  await runTradingCycle(connection, account, riskEngine);
  scheduleNextHourlyScan(connection, account, riskEngine);
}

startBot();