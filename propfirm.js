/**
 * propfirm.js - Dedicated FundingPips Flex Engine & Dynamic Stage Circuit Breaker
 *
 * Account Keys for .env.local (ACTIVE_PROP_FIRM):
 * - fundingpips_50k_phase1 | fundingpips_50k_phase2 | fundingpips_50k_master
 * - fundingpips_100k_phase1 | fundingpips_100k_phase2 | fundingpips_100k_master
 * - fundingpips_200k_phase1 | fundingpips_200k_phase2 | fundingpips_200k_master
 */
export const PROP_FIRM_CONFIGS = {
  // ==========================================
  // $50K FUNDINGPIPS FLEX PROFILES
  // ==========================================
  fundingpips_50k_phase1: {
    name: "FundingPips $50k - Phase 1 (Eval)",
    firmId: "fundingpips",
    accountSize: "50k",
    stage: "phase1",
    startingBalance: 50000,
    targetPct: 0.10, // $5,000 Target (10%)
    targetDollars: 5000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($2,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($1,600)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($5,000)
    riskPerTradePct: 0.018, // 1.80% Risk ($900) -> Max 2.5 RR Win ($2,250) < 60% Cap ($3,000)
    riskPerTradeDollars: 900.00,
    maxAllowedLosingTradesPerDay: 2, // Max 2 full stop losses per day
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true, // News trading restriction removed
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_50k_phase2: {
    name: "FundingPips $50k - Phase 2 (Eval)",
    firmId: "fundingpips",
    accountSize: "50k",
    stage: "phase2",
    startingBalance: 50000,
    targetPct: 0.08, // $4,000 Target (8%)
    targetDollars: 4000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($2,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($1,600)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($5,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($750) -> Max 2.5 RR Win ($1,875) < 60% Cap ($2,400)
    riskPerTradeDollars: 750.00,
    maxAllowedLosingTradesPerDay: 2, // Max 2 full stop losses per day
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true, // News trading restriction removed
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_50k_master: {
    name: "FundingPips $50k - Master (Funded)",
    firmId: "fundingpips",
    accountSize: "50k",
    stage: "master",
    startingBalance: 50000,
    targetPct: 0.00, // Live Payout Stage
    targetDollars: 0,
    minTradingDays: 0, // No minimum days on master
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($2,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($1,600)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($5,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($750) -> 2 Losses = 3.0% total ($1,500)
    riskPerTradeDollars: 750.00,
    maxAllowedLosingTradesPerDay: 2, // Max 2 full stop losses per day
    newsTradingAllowed: true, // News trading restriction removed
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },

  // ==========================================
  // $100K FUNDINGPIPS FLEX PROFILES
  // ==========================================
  fundingpips_100k_phase1: {
    name: "FundingPips $100k - Phase 1 (Eval)",
    firmId: "fundingpips",
    accountSize: "100k",
    stage: "phase1",
    startingBalance: 100000,
    targetPct: 0.10, // $10,000 Target (10%)
    targetDollars: 10000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($4,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($3,200)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($10,000)
    riskPerTradePct: 0.018, // 1.80% Risk ($1,800)
    riskPerTradeDollars: 1800.00,
    maxAllowedLosingTradesPerDay: 2,
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_100k_phase2: {
    name: "FundingPips $100k - Phase 2 (Eval)",
    firmId: "fundingpips",
    accountSize: "100k",
    stage: "phase2",
    startingBalance: 100000,
    targetPct: 0.08, // $8,000 Target (8%)
    targetDollars: 8000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($4,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($3,200)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($10,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($1,500)
    riskPerTradeDollars: 1500.00,
    maxAllowedLosingTradesPerDay: 2,
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_100k_master: {
    name: "FundingPips $100k - Master (Funded)",
    firmId: "fundingpips",
    accountSize: "100k",
    stage: "master",
    startingBalance: 100000,
    targetPct: 0.00,
    targetDollars: 0,
    minTradingDays: 0,
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($4,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($3,200)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($10,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($1,500)
    riskPerTradeDollars: 1500.00,
    maxAllowedLosingTradesPerDay: 2,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },

  // ==========================================
  // $200K FUNDINGPIPS FLEX PROFILES
  // ==========================================
  fundingpips_200k_phase1: {
    name: "FundingPips $200k - Phase 1 (Eval)",
    firmId: "fundingpips",
    accountSize: "200k",
    stage: "phase1",
    startingBalance: 200000,
    targetPct: 0.10, // $20,000 Target (10%)
    targetDollars: 20000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($8,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($6,400)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($20,000)
    riskPerTradePct: 0.018, // 1.80% Risk ($3,600)
    riskPerTradeDollars: 3600.00,
    maxAllowedLosingTradesPerDay: 2,
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_200k_phase2: {
    name: "FundingPips $200k - Phase 2 (Eval)",
    firmId: "fundingpips",
    accountSize: "200k",
    stage: "phase2",
    startingBalance: 200000,
    targetPct: 0.08, // $16,000 Target (8%)
    targetDollars: 16000,
    minTradingDays: 3, // Minimum 3 trading days
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($8,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($6,400)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($20,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($3,000)
    riskPerTradeDollars: 3000.00,
    maxAllowedLosingTradesPerDay: 2,
    maxProfitConcentrationPct: 0.60,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  },
  fundingpips_200k_master: {
    name: "FundingPips $200k - Master (Funded)",
    firmId: "fundingpips",
    accountSize: "200k",
    stage: "master",
    startingBalance: 200000,
    targetPct: 0.00,
    targetDollars: 0,
    minTradingDays: 0,
    officialDailyLossPct: 0.04, // 4.0% Official Daily Limit ($8,000)
    emergencyCircuitBreakerLimitPct: 0.032, // 3.2% Emergency Lockout ($6,400)
    maxOverallLossPct: 0.10, // 10.0% Static Max Drawdown ($20,000)
    riskPerTradePct: 0.015, // 1.50% Risk ($3,000)
    riskPerTradeDollars: 3000.00,
    maxAllowedLosingTradesPerDay: 2,
    newsTradingAllowed: true,
    newsRestrictedWindowMinutes: 0,
    allowWeekendHolding: true,
    allowOvernightHolding: true
  }
};

// Normalize properties for PropRiskEngine compatibility
for (const key of Object.keys(PROP_FIRM_CONFIGS)) {
  const conf = PROP_FIRM_CONFIGS[key];
  if (conf.dailyLossPercent === undefined && conf.officialDailyLossPct !== undefined) {
    conf.dailyLossPercent = conf.officialDailyLossPct * 100;
  }
  if (conf.maxDrawdownPercent === undefined && conf.maxOverallLossPct !== undefined) {
    conf.maxDrawdownPercent = conf.maxOverallLossPct * 100;
  }
  if (!conf.drawdownType) {
    conf.drawdownType = "static";
  }
  if (conf.weekendHoldingAllowed === undefined && conf.allowWeekendHolding !== undefined) {
    conf.weekendHoldingAllowed = conf.allowWeekendHolding;
  }
}

export const PROP_FIRM_PROFILES = PROP_FIRM_CONFIGS;

/**
 * Stage-Aware Daily Emergency Circuit Breaker Module
 */
export class DailyCircuitBreaker {
  constructor(accountProfileKey = process.env.ACTIVE_PROP_FIRM || "fundingpips_50k_phase1") {
    this.profile = PROP_FIRM_CONFIGS[accountProfileKey] || PROP_FIRM_CONFIGS["fundingpips_50k_phase1"];
    if (!PROP_FIRM_CONFIGS[accountProfileKey]) {
      console.warn(`⚠️ [CIRCUIT BREAKER] Key '${accountProfileKey}' not found in PROP_FIRM_CONFIGS. Defaulting to 'fundingpips_50k_phase1'.`);
    }

    this.maxDailyLossLimitPct = this.profile.emergencyCircuitBreakerLimitPct;
    this.dailyStartingEquity = null;
    this.isDailyTradingHalted = false;
    this.lastResetDateUTC = null;
    this.dailyLosingTradesCount = 0;
    this.maxAllowedLosses = this.profile.maxAllowedLosingTradesPerDay || 2;
  }

  captureDailyBaseline(currentEquity, currentBalance) {
    const todayUTC = new Date().toISOString().split('T')[0];
    if (this.lastResetDateUTC !== todayUTC) {
      this.dailyStartingEquity = Math.max(currentEquity, currentBalance);
      this.isDailyTradingHalted = false;
      this.dailyLosingTradesCount = 0;
      this.lastResetDateUTC = todayUTC;
      console.log(`[CIRCUIT BREAKER] Reset at 00:00 UTC. Profile: ${this.profile.name} | Baseline Equity: $${this.dailyStartingEquity.toFixed(2)} | Emergency Lockout: ${(this.maxDailyLossLimitPct * 100).toFixed(1)}% | Min Days: ${this.profile.minTradingDays}`);
    }
  }

  recordClosedTradeResult(isLoss) {
    if (isLoss) {
      this.dailyLosingTradesCount += 1;
      console.log(`[CIRCUIT BREAKER] Loss recorded. Total daily losses today: ${this.dailyLosingTradesCount}/${this.maxAllowedLosses}`);
      if (this.dailyLosingTradesCount >= this.maxAllowedLosses) {
        this.isDailyTradingHalted = true;
        console.warn(`[CIRCUIT BREAKER] Reached maximum allowed losing trades for today (${this.maxAllowedLosses}). Trading halted until 00:00 UTC reset.`);
      }
    }
  }

  /**
   * Checks if current execution time is within news blackout window.
   * Disabled - returns false to allow trading through news events.
   */
  isTradeWithinNewsBlackoutWindow(newsEventsList = [], tradeTime = new Date()) {
    return false; // News guard removed/disabled
  }

  async evaluateTick(currentEquity, currentBalance, positionManagerApi) {
    if (!this.dailyStartingEquity) {
      this.captureDailyBaseline(currentEquity, currentBalance);
    }
    this.captureDailyBaseline(currentEquity, currentBalance);

    if (this.isDailyTradingHalted) {
      return { status: "HALTED", message: "Daily trading halted until 00:00 UTC reset." };
    }

    const currentDailyLossPct = (this.dailyStartingEquity - currentEquity) / this.dailyStartingEquity;

    if (currentDailyLossPct >= this.maxDailyLossLimitPct) {
      await this.triggerEmergencyCircuitBreaker(currentDailyLossPct, positionManagerApi);
      return {
        status: "BREACHED",
        currentDailyLossPct,
        message: `CRITICAL: Daily emergency threshold hit (${(this.maxDailyLossLimitPct * 100).toFixed(1)}%). Closed all positions and halted trading until 00:00 UTC.`
      };
    }

    return { status: "OK", currentDailyLossPct };
  }

  async triggerEmergencyCircuitBreaker(lossPct, positionManagerApi) {
    this.isDailyTradingHalted = true;
    console.error(`[CIRCUIT BREAKER] CRITICAL: Daily emergency limit hit (${(lossPct * 100).toFixed(2)}%). Executing market close and locking trades until 00:00 UTC.`);
    
    if (positionManagerApi) {
      try {
        if (typeof positionManagerApi.closeAllPositions === "function") {
          await positionManagerApi.closeAllPositions();
        }
        if (typeof positionManagerApi.cancelAllPendingOrders === "function") {
          await positionManagerApi.cancelAllPendingOrders();
        }
      } catch (error) {
        console.error("[CIRCUIT BREAKER] Error during emergency liquidation execution:", error);
      }
    }
  }

  canExecuteNewTrade(newsEventsList = []) {
    if (this.isDailyTradingHalted) {
      console.warn("[CIRCUIT BREAKER] Trade blocked: Global daily trading lock active.");
      return false;
    }

    if (this.dailyLosingTradesCount >= this.maxAllowedLosses) {
      console.warn(`[CIRCUIT BREAKER] Trade blocked: Reached max daily loss count (${this.dailyLosingTradesCount}/${this.maxAllowedLosses}).`);
      return false;
    }

    // News guard removed: does not block trades on news events
    return true;
  }
}
