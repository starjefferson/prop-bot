/**
 * src/utils/historyLogger.js
 * 
 * Asynchronous Closed Trade Logger
 * Manages history.json records using fs/promises with an asynchronous lock/queue to prevent concurrency race conditions.
 */

import fs from "fs/promises";
import path from "path";

const HISTORY_PATH = path.resolve(process.cwd(), "history.json");

// FIFO Promise Queue for atomic file write operations
let queue = Promise.resolve();

function withLock(operation) {
  const next = queue.then(async () => {
    return await operation();
  }).catch(async (err) => {
    throw err;
  });

  queue = next.catch(() => {});
  return next;
}

/**
 * Ensures history.json exists at project root with a valid JSON array.
 */
async function ensureHistoryFile() {
  try {
    await fs.access(HISTORY_PATH);
  } catch {
    await fs.writeFile(HISTORY_PATH, "[]\n", "utf-8");
  }
}

/**
 * Reads and parses history.json.
 * @returns {Promise<Array>}
 */
async function readHistory() {
  await ensureHistoryFile();
  try {
    const raw = await fs.readFile(HISTORY_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`⚠️ [History Logger] Corrupted history.json detected: ${err.message}. Initializing empty array.`);
    return [];
  }
}

/**
 * Writes history array to history.json.
 * @param {Array} data 
 */
async function writeHistory(data) {
  const content = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(HISTORY_PATH, content, "utf-8");
}

/**
 * Appends a new open trade record to history.json.
 * 
 * @param {object} tradePayload
 * @param {string} tradePayload.patternID
 * @param {string|number} tradePayload.ticketId
 * @param {string} tradePayload.symbol
 * @param {string} tradePayload.type
 * @param {number} tradePayload.entryPrice
 * @param {number} tradePayload.sl
 * @param {number} tradePayload.tp
 * @param {number} tradePayload.volume
 * @param {number|string} tradePayload.rr
 * @param {string} [tradePayload.executionTime]
 * @returns {Promise<object>} The logged trade object
 */
export async function logTradeOpen(tradePayload) {
  return withLock(async () => {
    const history = await readHistory();

    const record = {
      patternID: tradePayload.patternID,
      ticketId: tradePayload.ticketId,
      symbol: tradePayload.symbol,
      type: tradePayload.type,
      entryPrice: tradePayload.entryPrice,
      sl: tradePayload.sl,
      tp: tradePayload.tp,
      volume: tradePayload.volume,
      rr: tradePayload.rr,
      executionTime: tradePayload.executionTime || new Date().toISOString(),
      status: "OPEN",
      ...tradePayload
    };
    record.status = "OPEN"; // Guarantee OPEN status

    history.push(record);
    await writeHistory(history);
    console.log(`📝 [History Logger] Logged OPEN trade for ${record.symbol} (Ticket: ${record.ticketId || record.patternID})`);
    return record;
  });
}

/**
 * Updates an existing open trade in history.json with close details.
 * 
 * @param {string|number} ticketIdOrPatternId - The ticketId or patternID matching the trade.
 * @param {object} closeData
 * @param {number} closeData.closePrice
 * @param {string} [closeData.closeTime] - ISO string timestamp
 * @param {number} closeData.realizedPnL - Realized profit/loss in USD
 * @param {number} closeData.pipsGained - Pips gained or lost
 * @param {"TAKE_PROFIT_HIT" | "STOP_LOSS_HIT" | "MANUAL_CLOSE" | "PRE_NEWS_FLATTEN"} closeData.closeReason
 * @returns {Promise<object|null>} The updated trade object, or null if not found
 */
export async function logTradeClose(ticketIdOrPatternId, closeData = {}) {
  return withLock(async () => {
    const history = await readHistory();

    const targetKey = String(ticketIdOrPatternId);
    const trade = history.find(item => 
      (item.ticketId !== undefined && String(item.ticketId) === targetKey) ||
      (item.patternID !== undefined && String(item.patternID) === targetKey)
    );

    if (!trade) {
      console.warn(`⚠️ [History Logger] Trade not found for identifier: ${ticketIdOrPatternId}`);
      return null;
    }

    trade.status = "CLOSED";
    trade.closePrice = closeData.closePrice;
    trade.closeTime = closeData.closeTime || new Date().toISOString();
    trade.realizedPnL = closeData.realizedPnL;
    trade.pipsGained = closeData.pipsGained;
    trade.closeReason = closeData.closeReason;

    await writeHistory(history);
    console.log(`📝 [History Logger] Logged CLOSED trade for ${trade.symbol} (Ticket: ${trade.ticketId || trade.patternID}) | PnL: $${closeData.realizedPnL} | Reason: ${closeData.closeReason}`);
    return trade;
  });
}

/**
 * Returns current trade records from history.json.
 * @returns {Promise<Array>}
 */
export async function getTradeHistory() {
  return withLock(async () => {
    return await readHistory();
  });
}
