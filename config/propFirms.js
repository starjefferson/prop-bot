// [File: config/propFirms.js]

export const PROP_FIRM_PROFILES = {
  // ==========================================
  // EVALUATION ACCOUNTS (Step 1 / Challenge Phase)
  // ==========================================

  // [Atlas 2-Step Evaluation Profile]
  atlas_2step_eval: {
    name: "Atlas 2-Step Evaluation",
    dailyLossPercent: 5.0,           // [5% daily loss limit reset at 00:00 UTC]
    maxDrawdownPercent: 10.0,        // [10% static max drawdown]
    drawdownType: "static",          // [Anchored to initial starting balance]
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // [Atlas 1-Step Evaluation Profile]
  atlas_1step_eval: {
    name: "Atlas 1-Step Evaluation",
    dailyLossPercent: 5.0,           // [5% daily loss limit]
    maxDrawdownPercent: 7.0,         // [7% static max drawdown]
    drawdownType: "static",          // [Anchored to initial starting balance]
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // ==========================================
  // FUNDED ACCOUNTS (Live / Payout Eligible Phase)
  // ==========================================

  // [Atlas 1-Step Funded Profile]
  atlas_1step_funded: {
    name: "Atlas 1-Step Funded",
    dailyLossPercent: 3.0,           // [Enforces tighter 3% daily loss limit on Live Funded stage]
    maxDrawdownPercent: 6.0,         // [Enforces tighter 6% static max drawdown on Live Funded stage]
    drawdownType: "static",          // [Anchored to initial starting balance]
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // [Atlas 2-Step Funded Profile]
  atlas_2step_funded: {
    name: "Atlas 2-Step Funded",
    dailyLossPercent: 5.0,           // [5% daily loss limit]
    maxDrawdownPercent: 10.0,        // [10% static max drawdown]
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // [Atlas Instant Funded Profile]
  atlas_instant_funded: {
    name: "Atlas Instant Funded",
    dailyLossPercent: 3.0,           // [3% daily loss limit]
    maxDrawdownPercent: 5.0,         // [5% trailing max drawdown]
    drawdownType: "trailing",        // [Follows account equity high-water mark]
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 0,
    weekendHoldingAllowed: true
  },

  // ==========================================
  // OTHER PROP FIRMS
  // ==========================================

  // [Alpha Capital Group Profile]
  alpha_capital: {
    name: "Alpha Capital Group",
    dailyLossPercent: 5.0,
    maxDrawdownPercent: 10.0,
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 120,    // [2-minute minimum average trade duration rule]
    newsHoldWindowMinutes: 2,
    weekendHoldingAllowed: true
  },

  // [FTMO Standard Profile]
  ftmo: {
    name: "FTMO Standard",
    dailyLossPercent: 5.0,
    maxDrawdownPercent: 10.0,
    drawdownType: "static",
    dailyResetTimeUTC: "00:00",
    minTradeDurationSeconds: 0,
    newsHoldWindowMinutes: 2,
    weekendHoldingAllowed: false     // [Weekend holding restricted]
  }
};