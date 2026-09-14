// [File: src/risk/propRiskEngine.js]

import { PROP_FIRM_PROFILES } from "../../config/propFirms.js";

export class PropRiskEngine {
  constructor(firmKey = "atlas_2step_eval", accountBalance = 10000, startOfDayBalance = 10000) {
    this.profile = PROP_FIRM_PROFILES[firmKey] || PROP_FIRM_PROFILES.atlas_2step_eval;
    this.initialBalance = Number(accountBalance) || 10000;
    this.startOfDayBalance = Number(startOfDayBalance) || this.initialBalance;
    
    // [High-water mark tracking for trailing drawdown profiles (e.g., Instant Funded)]
    this.highWaterMark = this.initialBalance;
  }

  /**
   * Updates internal equity high-water mark for trailing drawdown models
   */
  updateHighWaterMark(currentEquity) {
    if (currentEquity > this.highWaterMark) {
      this.highWaterMark = currentEquity;
      console.log(`📈 [Risk Engine] New High-Water Mark recorded: $${this.highWaterMark.toFixed(2)}`);
    }
  }

  /**
   * Evaluates setup against active prop firm rules prior to order placement
   */
  validateOrder({ balance, currentEquity, symbol, entryPrice, slPrice, riskPercent }) {
    console.log(`🛡️ [Risk Engine] Enforcing compliance rules for: ${this.profile.name}`);

    // [Track highest equity achieved for trailing drawdown rules]
    this.updateHighWaterMark(currentEquity);

    // [1. Weekend Holding Rule Check]
    if (!this.profile.weekendHoldingAllowed) {
      const now = new Date();
      const day = now.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const hour = now.getUTCHours();
      
      // Restricted: Friday after 20:00 UTC through Sunday 22:00 UTC
      if (day === 6 || (day === 5 && hour >= 20) || (day === 0 && hour < 22)) {
        console.error(`❌ [REJECTED] Weekend holding prohibited for ${this.profile.name}`);
        return { allowed: false, reason: "WEEKEND_HOLDING_RESTRICTED" };
      }
    }

    // [2. Max Overall Drawdown Check (Static vs Trailing)]
    const maxDrawdownAmount = this.initialBalance * (this.profile.maxDrawdownPercent / 100);
    
    // Static is anchored to initial balance; Trailing follows the high-water mark
    const maxLossFloor = this.profile.drawdownType === "trailing"
      ? this.highWaterMark - maxDrawdownAmount
      : this.initialBalance - maxDrawdownAmount;

    if (currentEquity <= maxLossFloor) {
      console.error(`❌ [REJECTED] Account equity ($${currentEquity.toFixed(2)}) breached Max Loss Floor ($${maxLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "MAX_DRAWDOWN_BREACH_GUARD" };
    }

    // [3. Balance-Based Daily Loss Check (Resets at 00:00 UTC)]
    const maxDailyLossAmount = this.startOfDayBalance * (this.profile.dailyLossPercent / 100);
    const dailyLossFloor = this.startOfDayBalance - maxDailyLossAmount;

    if (currentEquity <= dailyLossFloor) {
      console.error(`❌ [REJECTED] Daily Loss Limit Reached. Current Equity: $${currentEquity.toFixed(2)} | Daily Floor: $${dailyLossFloor.toFixed(2)}`);
      return { allowed: false, reason: "DAILY_LOSS_BREACH_GUARD" };
    }

    // [4. Stop Loss Distance & Position Risk Calculation]
    const slDistance = Math.abs(entryPrice - slPrice);
    if (slDistance === 0) return { allowed: false, reason: "INVALID_SL" };

    const maxCapitalToRisk = balance * (riskPercent / 100);

    // [5. Pre-Execution Drawdown Breach Buffer Check]
    if ((currentEquity - maxCapitalToRisk) <= maxLossFloor) {
      console.error(`❌ [REJECTED] Trade risk ($${maxCapitalToRisk.toFixed(2)}) would breach Max Loss Floor ($${maxLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "MAX_DRAWDOWN_POTENTIAL_BREACH" };
    }

    if ((currentEquity - maxCapitalToRisk) <= dailyLossFloor) {
      console.error(`❌ [REJECTED] Trade risk ($${maxCapitalToRisk.toFixed(2)}) would breach Daily Loss Limit ($${dailyLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "DAILY_LOSS_POTENTIAL_BREACH" };
    }

    return {
      allowed: true,
      maxCapitalToRisk,
      profile: this.profile.name,
      drawdownType: this.profile.drawdownType,
      dailyLossFloor,
      maxLossFloor
    };
  }

  /**
   * Dynamic Profile Switcher
   */
  switchProfile(newFirmKey) {
    if (PROP_FIRM_PROFILES[newFirmKey]) {
      this.profile = PROP_FIRM_PROFILES[newFirmKey];
      console.log(`✅ [Risk Engine] Profile updated to: ${this.profile.name}`);
    } else {
      console.error(`⚠️ [Risk Engine] Unknown profile key: ${newFirmKey}`);
    }
  }

  /**
   * Reset start-of-day baseline balance at 00:00 UTC
   */
  updateStartOfDayBalance(newBalance) {
    this.startOfDayBalance = Number(newBalance);
    console.log(`🌅 [Risk Engine] Start-of-day baseline reset to: $${this.startOfDayBalance.toFixed(2)}`);
  }
}