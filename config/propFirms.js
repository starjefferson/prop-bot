export const PROP_FIRM_PROFILES = {
  // Atlas Funded - 2-Step Standard (Most Popular Model)
  atlas_funded_2step: {
    name: "Atlas Funded (2-Step Standard)",
    dailyLossPercent: 5.0,           // 5% daily loss limit (recalculated at 00:00 UTC)
    maxDrawdownPercent: 10.0,        // 10% max static drawdown
    drawdownType: "static",          // Anchored strictly to starting balance
    dailyResetTimeUTC: "00:00",      // Midnight UTC reset
    minTradeDurationSeconds: 0,      // No minimum trade duration restriction
    newsHoldWindowMinutes: 0,        // News trading fully permitted
    weekendHoldingAllowed: true      // Holding trades over weekends permitted
  },

  // Atlas Funded - 1-Step Standard
  atlas_funded_1step: {
    name: "Atlas Funded (1-Step Standard)",
    dailyLossPercent: 4.0,           // 4% daily loss limit
    maxDrawdownPercent: 7.0,         // 7% max static drawdown
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // Atlas Funded - Instant Funded
  atlas_funded_instant: {
    name: "Atlas Funded (Instant)",
    dailyLossPercent: 3.0,           // 3% daily loss limit
    maxDrawdownPercent: 5.0,         // 5% trailing max drawdown
    drawdownType: "trailing",        // Trailing drawdown model
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // Alpha Capital Group Profile
  alpha_capital: {
    name: "Alpha Capital Group",
    dailyLossPercent: 5.0,           // 5% max daily loss
    maxDrawdownPercent: 10.0,        // 10% max static drawdown
    drawdownType: "static",          // Anchored to starting balance
    dailyResetTimeUTC: "00:00",      // Reset at Midnight UTC
    minTradeDurationSeconds: 120,    // Alpha Capital > 2-minute average duration rule
    newsHoldWindowMinutes: 2,        // 2 mins before/after news window
    weekendHoldingAllowed: true
  },

  // The5ers High Stakes Profile
  the5ers_high_stakes: {
    name: "The5ers High Stakes",
    dailyLossPercent: 5.0,
    maxDrawdownPercent: 10.0,
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,      // No minimum duration rule
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // FTMO Challenge Profile
  ftmo: {
    name: "FTMO Standard",
    dailyLossPercent: 5.0,
    maxDrawdownPercent: 10.0,
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 2,
    weekendHoldingAllowed: false     // Closed on weekends unless swing account
  }
};