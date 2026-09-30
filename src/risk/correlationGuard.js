/**
 * src/risk/correlationGuard.js
 * 
 * Currency Correlation Guard
 * Prevents over-leveraging a single currency across multiple active trade setups.
 */

/**
 * Decomposes a trading symbol into base and quote currency components.
 * Handles standard Forex (EURUSD), metals/commodities (XAUUSD),
 * exotics/crosses (USDZAR, GBPJPY), symbol delimiters (EUR/USD, EUR_USD),
 * and standard broker suffixes/prefixes (e.g. EURUSD.a, EURUSD.m, EURUSDpro, EURUSD+).
 * 
 * @param {string} symbol
 * @returns {{ base: string, quote: string } | null}
 */
export function parseCurrencyPair(symbol) {
  if (!symbol || typeof symbol !== "string") {
    return null;
  }

  const raw = symbol.trim().toUpperCase();

  // Handle explicit delimiters such as EUR/USD, EUR_USD, USD-ZAR
  const delimiterMatch = raw.match(/^([A-Z]{3,4})[\/\-_]([A-Z]{3,4})/);
  if (delimiterMatch) {
    return {
      base: delimiterMatch[1],
      quote: delimiterMatch[2]
    };
  }

  // Remove common punctuation-delimited suffixes like .a, .m, .raw, _i, +, #
  const withoutDelimitedSuffix = raw.split(/[._\+#]/)[0];

  // Strip non-letter characters
  const clean = withoutDelimitedSuffix.replace(/[^A-Z]/g, "");

  // Standard 6-character currency pairs (e.g., EURUSD, XAUUSD, USDZAR, GBPJPY)
  // or suffixes attached without delimiter (e.g. EURUSDPRO -> EUR, USD)
  if (clean.length >= 6) {
    return {
      base: clean.substring(0, 3),
      quote: clean.substring(3, 6)
    };
  }

  return null;
}

/**
 * Evaluates whether a new candidate trade is permitted based on active currency exposure.
 *
 * @param {string} candidateSymbol - The ticker symbol of the potential new trade.
 * @param {Array<object>} openPositions - Active open positions from the broker/account API.
 * @param {number} [maxPerCurrency=2] - Maximum allowed active exposures for any single currency.
 * @returns {{ isAllowed: boolean, reason: string | null }}
 */
export function canExecuteCorrelatedTrade(candidateSymbol, openPositions = [], maxPerCurrency = 2) {
  const candidate = parseCurrencyPair(candidateSymbol);

  if (!candidate) {
    return {
      isAllowed: true,
      reason: null
    };
  }

  // Tally active exposures for each currency across all open positions
  const currencyCounts = {};

  if (Array.isArray(openPositions)) {
    for (const position of openPositions) {
      if (!position || !position.symbol) continue;

      const parsed = parseCurrencyPair(position.symbol);
      if (!parsed) continue;

      currencyCounts[parsed.base] = (currencyCounts[parsed.base] || 0) + 1;
      currencyCounts[parsed.quote] = (currencyCounts[parsed.quote] || 0) + 1;
    }
  }

  // Rule: Reject if EITHER base or quote currency exceeds maxPerCurrency
  const baseCount = currencyCounts[candidate.base] || 0;
  if (baseCount >= maxPerCurrency) {
    return {
      isAllowed: false,
      reason: `Correlation limit reached: ${candidate.base} already has ${baseCount} active open positions.`
    };
  }

  const quoteCount = currencyCounts[candidate.quote] || 0;
  if (quoteCount >= maxPerCurrency) {
    return {
      isAllowed: false,
      reason: `Correlation limit reached: ${candidate.quote} already has ${quoteCount} active open positions.`
    };
  }

  return {
    isAllowed: true,
    reason: null
  };
}
