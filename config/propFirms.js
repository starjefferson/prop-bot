export const PROP_FIRM_PROFILES = {
  // Alpha Capital Group Profile (Default Target)
  alpha_capital: {
    name: "Alpha Capital Group",
    dailyLossPercent: 5.0,           // 5% max daily loss
    maxDrawdownPercent: 10.0,        // 10% max drawdown
    drawdownType: "static",          // 'static' (anchored to starting balance)
    dailyResetTimeUTC: "00:00",      // Broker reset time in UTC
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