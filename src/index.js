import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createRequire } from "module";

// CommonJS Bridge with Safe Module Resolution
const require = createRequire(import.meta.url);
const metaApiModule = require("metaapi.cloud-sdk");
const MetaApi = metaApiModule.default || metaApiModule.MetaApi || metaApiModule;

// Local Imports
import { runDetection } from "./patternDetection/patternEngine.js";
import { checkTopDownAlignment } from "./patternDetection/topDownAnalysis.js";
import { PropRiskEngine } from "./risk/propRiskEngine.js";
import { canExecuteCorrelatedTrade } from "./risk/correlationGuard.js";
import { logTradeOpen, logTradeClose } from "./utils/historyLogger.js";
import { DailyCircuitBreaker } from "../propfirm.js";

dotenv.config({ path: ".env.local" });

// Asset List
const PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
  "GBPJPY", "EURJPY", "EURAUD", "GBPAUD"
];

const HISTORY_PATH = path.resolve(process.cwd(), "history.json");
const ACTIVE_PROP_FIRM = process.env.ACTIVE_PROP_FIRM || "fundingpips_50k_phase1";
const RISK_PERCENT = parseFloat(process.env.RISK_PERCENT || "1.0");
const MIN_RR = parseFloat(process.env.MIN_RR || "2.5");
const MAX_RR = parseFloat(process.env.MAX_RR || "3.0");
const MAX_CONCURRENT_TRADES = parseInt(process.env.MAX_CONCURRENT_TRADES || "2", 10);

const METAAPI_TOKEN = process.env.METAAPI_TOKEN;
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;

// Helper: Load JSON file from disk
const loadJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, "[]"); return []; }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) { return []; }
};

// Helper: Save JSON file to disk
const saveJSON = (filePath, data) => {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.error(`❌ DISK ERROR: ${e.message}`); }
};

// Helper: Map timeframe standard code to MetaApi format
function getMetaApiTimeframe(tf) {
  const map = { "1W": "1w", "1D": "1d", "4H": "4h", "1H": "1h" };
  return map[tf] || "1h";
}

// Helper: Ensure MetaApi connection is active & synchronized
async function ensureSynced(metaApiConnection, account) {
  if (account) {
    const connectionActive = typeof account.isConnectionActive === "function"
      ? await account.isConnectionActive()
      : account.isConnectionActive;

    if (connectionActive === false) {
      console.warn("🔄 [MetaApi] Account connection is inactive. Waiting for reconnection...");
      await account.waitConnected();
    }
  }

  const synchronized = typeof metaApiConnection?.isSynchronized === "function"
    ? metaApiConnection.isSynchronized()
    : metaApiConnection?.isSynchronized;

  if (synchronized === false) {
    console.warn("⚠️ [MetaApi] RPC connection desynchronized. Waiting for resynchronization...");
    await metaApiConnection.waitSynchronized();
    console.log("✅ [MetaApi] Connection resynchronized successfully.");
  }
}

// Helper: Stream historical candle data via MetaApi SDK with retry resilience
async function fetchMetaApiCandles(account, symbol, tf, count, metaApiConnection) {
  const metaApiTf = getMetaApiTimeframe(tf);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (metaApiConnection) await ensureSynced(metaApiConnection, account);
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
      if (attempt === 1) {
        console.warn(`⚠️ Candle fetch attempt 1 failed for ${symbol} (${tf}): ${err.message}. Retrying...`);
        if (metaApiConnection) await ensureSynced(metaApiConnection, account);
      } else {
        console.error(`⚠️ MetaApi candle fetch error for ${symbol} (${tf}):`, err.message);
        throw err;
      }
    }
  }
}

// Main Market Scan Cycle
async function runTradingCycle(metaApiConnection, account, riskEngine, circuitBreaker) {
  console.log(`\n==================================================`);
  console.log(`🔍 [${new Date().toISOString()}] Starting MetaApi Scan across Major FX Pairs...`);
  console.log(`==================================================`);

  if (circuitBreaker && !circuitBreaker.canExecuteNewTrade()) {
    console.warn("🛑 [Circuit Breaker] Daily trading lock active. Skipping market scan cycle.");
    return;
  }

  await ensureSynced(metaApiConnection, account);

  const history = loadJSON(HISTORY_PATH);
  let accountInformation;
  try {
    accountInformation = await metaApiConnection.getAccountInformation();
  } catch (e) {
    console.error(`❌ Failed to fetch account info: ${e.message}`);
    return;
  }

  const balance = accountInformation.balance;
  const equity = accountInformation.equity;

  if (circuitBreaker) {
    circuitBreaker.captureDailyBaseline(equity, balance);
  }

  let executedInCycle = 0;

  for (const symbol of PAIRS) {
    let finalStatus = `⏭️ [${symbol}] Status: Scan complete (No valid setup)`;
    if (executedInCycle >= MAX_CONCURRENT_TRADES) {
      console.log(`⏹️ Max concurrent trade limit (${MAX_CONCURRENT_TRADES}) reached for this cycle.`);
      finalStatus = `⏭️ [${symbol}] Status: Scan skipped (Trade limit reached)`;
      console.log(finalStatus);
      continue;
    }

    try {
      // Stage 1: Reconnect if needed, then fetch all scan timeframes.
      await ensureSynced(metaApiConnection, account);
      console.log(`📥 [${symbol}] Fetching candles: W1...`);
      const w1 = await fetchMetaApiCandles(account, symbol, "1W", 50, metaApiConnection);
      console.log(`📥 [${symbol}] Fetching candles: D1...`);
      const d1 = await fetchMetaApiCandles(account, symbol, "1D", 200, metaApiConnection);
      console.log(`📥 [${symbol}] Fetching candles: H4...`);
      const h4 = await fetchMetaApiCandles(account, symbol, "4H", 200, metaApiConnection);
      console.log(`📥 [${symbol}] Fetching candles: H1...`);
      const h1 = await fetchMetaApiCandles(account, symbol, "1H", 200, metaApiConnection);

      const candleData = { "1W": w1, "1D": d1, "4H": h4, "1H": h1 };
      const getTrend = (candles) => {
        if (!candles || candles.length < 20) return "none";
        const sma = candles.slice(0, 20).reduce((sum, candle) => sum + candle.close, 0) / 20;
        return candles[0].close > sma ? "buy" : candles[0].close < sma ? "sell" : "none";
      };
      const trends = {
        W1: getTrend(w1),
        D1: getTrend(d1),
        H4: getTrend(h4),
        H1: getTrend(h1)
      };
      const bias = checkTopDownAlignment(candleData, ["1W", "1D", "4H", "1H"]);
      console.log(
        `📡 [${symbol}] Trends | W1:${trends.W1.toUpperCase()} D1:${trends.D1.toUpperCase()} ` +
        `H4:${trends.H4.toUpperCase()} H1:${trends.H1.toUpperCase()} | Bias: ${(bias || "none").toUpperCase()}`
      );

      if (!w1 || !d1 || !h4 || !h1 || h1.length < 50) {
        console.log(`⚠️ [${symbol}] Insufficient candle history returned.`);
        console.log(`ℹ️ [${symbol}] Scan skipped: required timeframe candle data is unavailable.`);
        continue;
      }

      const currentPrice = h1[0].close;

      if (!bias) {
        console.log(`ℹ️ [${symbol}] Scan skipped: W1/D1/H4/H1 trend bias is not aligned.`);
        continue;
      }

      // Stage 3: Report structurally valid patterns, including pending breakouts.
      let patternDetected = false;
      const pattern = runDetection(candleData, symbol, bias, ({ type, activeTFs }) => {
        patternDetected = true;
        console.log(`✅ [${symbol}] H&S Pattern Detected: [${type.toUpperCase()}/${activeTFs.join("+")}]`);
      });
      if (!patternDetected) {
        console.log(
          `ℹ️ [${symbol}] No ${bias.toUpperCase()} setup passed geometry, TP/RR, ` +
          `multi-timeframe agreement, and 1H trigger checks.`
        );
      }
      if (!pattern) {
        if (patternDetected) finalStatus = `⏳ [${symbol}] Pending: Waiting for neckline break`;
        continue;
      }

      // Step 4: Pattern Fingerprint Guard
      const patternID = `${symbol}_${pattern.type}_${pattern.headTime}`;
      if (history.find(h => h.patternID === patternID)) {
        console.log(`ℹ️ [${symbol}] Pattern ${patternID} already processed.`);
        continue;
      }

      // Step 5: Distribution Guard Check
      const isJpy = symbol.includes("JPY");
      const tooFar = isJpy ? 0.20 : 0.0020;
      if (pattern.type === "sell" && currentPrice < (pattern.necklineLow - tooFar)) {
        console.log(`❌ [${symbol}] REJECTED: Setup expired below neckline | Price: ${currentPrice} | Neckline: ${pattern.necklineLow} | Allowed distance: ${tooFar}`);
        continue;
      }
      if (pattern.type === "buy" && currentPrice > (pattern.necklineHigh + tooFar)) {
        console.log(`❌ [${symbol}] REJECTED: Setup expired above neckline | Price: ${currentPrice} | Neckline: ${pattern.necklineHigh} | Allowed distance: ${tooFar}`);
        continue;
      }

      // Step 6: Breakout & Close Trigger Check
      const isBreakout = (pattern.type === "sell" && currentPrice < pattern.necklineLow) ||
                         (pattern.type === "buy" && currentPrice > pattern.necklineHigh);

      if (!isBreakout) {
        console.log(`⏳ [${symbol}] Setup Valid. Waiting for breakout close past zone [${pattern.necklineLow} - ${pattern.necklineHigh}]`);
        finalStatus = `⏳ [${symbol}] Pending: Waiting for neckline break`;
        continue;
      }

      // Step 7: Risk-to-Reward Ratio Filter
      const risk = Math.abs(currentPrice - pattern.sl);
      const reward = Math.abs(pattern.tp - currentPrice);
      const rr = reward / risk;

      if (rr < MIN_RR || rr > MAX_RR) {
        console.log(`❌ [${symbol}] REJECTED: Risk-to-reward outside allowed range | RR: ${rr.toFixed(2)} | Required: ${MIN_RR}-${MAX_RR} | Risk: ${risk} | Reward: ${reward}`);
        continue;
      }

      // Step 8: Prop Risk Engine Interceptor
      const riskValidation = riskEngine.validateOrder({
        balance,
        currentEquity: equity,
        symbol,
        entryPrice: currentPrice,
        slPrice: pattern.sl,
        riskPercent: RISK_PERCENT
      });

      if (!riskValidation.allowed) {
        console.warn(`❌ [${symbol}] REJECTED: Prop risk parameters | Reason: ${riskValidation.reason} | Equity: ${equity} | Balance: ${balance} | Risk: ${riskValidation.maxCapitalToRisk ?? "not approved"}`);
        continue;
      }

      // Step 8.5: Currency Correlation Guard Interception
      let openPositions = [];
      try {
        openPositions = await metaApiConnection.getPositions();
      } catch (posErr) {
        throw new Error(`Could not fetch positions for correlation validation: ${posErr.message || String(posErr)}`, { cause: posErr });
      }

      const correlationCheck = canExecuteCorrelatedTrade(symbol, openPositions, 2);
      if (!correlationCheck.isAllowed) {
        console.warn(`❌ [${symbol}] REJECTED: Currency correlation guard | Reason: ${correlationCheck.reason}`);
        continue;
      }

      // Step 9: Lot Sizing & MT5 Execution via MetaApi
      let lotSize;
      if (symbol.includes("JPY")) {
        lotSize = (riskValidation.maxCapitalToRisk * currentPrice) / (risk * 100000);
      } else {
        lotSize = riskValidation.maxCapitalToRisk / (risk * 100000);
      }

      lotSize = Math.max(0.01, Math.round(lotSize * 100) / 100);

      console.log(`🎯 [${symbol}] TARGET RR ACHIEVED (${rr.toFixed(2)}). Executing MetaApi MT5 Order... Lots: ${lotSize}`);

      await ensureSynced(metaApiConnection, account);
      const orderResult = await metaApiConnection.createMarketBuyOrder(
        symbol,
        lotSize,
        pattern.sl,
        pattern.tp,
        { comment: `H&S Bot - ${ACTIVE_PROP_FIRM}` }
      );

      executedInCycle++;

      const ticketId = orderResult.numericCode || orderResult.stringCode || orderResult.orderId;
      finalStatus = `🚀 [${symbol}] Action: Executing Trade / Sending Alert | Order ID: ${ticketId}`;
      await logTradeOpen({
        patternID,
        ticketId,
        symbol,
        type: pattern.type,
        entryPrice: currentPrice,
        sl: pattern.sl,
        tp: pattern.tp,
        volume: lotSize,
        rr: rr.toFixed(2),
        executionTime: new Date().toISOString(),
        status: "OPEN",
        propFirm: ACTIVE_PROP_FIRM
      });

      history.push({ patternID, ticketId, symbol });

    } catch (err) {
      const message = err?.message || String(err);
      if (finalStatus.startsWith("🚀")) {
        console.error(`❌ [${symbol}] Trade executed, but post-trade processing failed: ${message}`);
      } else {
        console.error(`❌ [${symbol}] Scan skipped due to RPC error: ${message}`);
        finalStatus = `❌ [${symbol}] Status: Scan skipped due to RPC error`;
      }
    } finally {
      console.log(finalStatus);
    }
  }
}

// Smart Hourly Scheduler: Runs at :00:05 UTC every hour
function scheduleNextHourlyScan(metaApiConnection, account, riskEngine, circuitBreaker) {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 5, 0);

  const delayMs = nextHour.getTime() - now.getTime();
  const minutesRemaining = (delayMs / 1000 / 60).toFixed(1);

  console.log(`\n⏰ Next scan scheduled in ${minutesRemaining} minutes (at ${nextHour.toLocaleTimeString()}).`);

  setTimeout(async () => {
    try {
      await ensureSynced(metaApiConnection, account);
      const currentUtc = new Date();
      if (currentUtc.getUTCHours() === 0) {
        const info = await metaApiConnection.getAccountInformation();
        riskEngine.updateStartOfDayBalance(info.balance);
        if (circuitBreaker) circuitBreaker.captureDailyBaseline(info.equity, info.balance);
      }

      await runTradingCycle(metaApiConnection, account, riskEngine, circuitBreaker);
    } catch (err) {
      console.error("❌ Scheduled cycle error:", err.message);
    } finally {
      scheduleNextHourlyScan(metaApiConnection, account, riskEngine, circuitBreaker);
    }
  }, delayMs);
}

// Engine Initialization & MetaApi Connection Sequence
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
  const circuitBreaker = new DailyCircuitBreaker(ACTIVE_PROP_FIRM);
  circuitBreaker.captureDailyBaseline(accountInfo.equity, accountInfo.balance);

  await runTradingCycle(connection, account, riskEngine, circuitBreaker);
  scheduleNextHourlyScan(connection, account, riskEngine, circuitBreaker);
}

startBot().catch((err) => {
  console.error(`❌ Fatal startup error: ${err?.message || String(err)}`);
});
