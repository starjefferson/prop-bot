import { PROP_FIRM_PROFILES } from "../../config/propFirms.js";

export class PropRiskEngine {
  constructor(firmKey = "alpha_capital", accountBalance = 10000, startOfDayBalance = 10000) {
    this.profile = PROP_FIRM_PROFILES[firmKey] || PROP_FIRM_PROFILES.alpha_capital;
    this.initialBalance = Number(accountBalance) || 10000;
    this.startOfDayBalance = Number(startOfDayBalance) || this.initialBalance;
  }

  /**
   * Evaluates setup against active prop firm rules prior to order placement
   */
  validateOrder({ balance, currentEquity, symbol, entryPrice, slPrice, riskPercent }) {
    console.log(`🛡️ [Risk Engine] Enforcing compliance rules for: ${this.profile.name}`);

    // 1. Weekend Holding Rule Check
    if (!this.profile.weekendHoldingAllowed) {
      const now = new Date();
      const day = now.getUTCDay();
      const hour = now.getUTCHours();
      // Friday after 20:00 UTC through Sunday
      if (day === 6 || (day === 5 && hour >= 20) || (day === 0 && hour < 22)) {
        console.error(`❌ [REJECTED] Weekend holding prohibited for ${this.profile.name}`);
        return { allowed: false, reason: "WEEKEND_HOLDING_RESTRICTED" };
      }
    }

    // 2. Static Max Drawdown Check
    const maxDrawdownAmount = this.initialBalance * (this.profile.maxDrawdownPercent / 100);
    const maxLossFloor = this.initialBalance - maxDrawdownAmount;

    if (currentEquity <= maxLossFloor) {
      console.error(`❌ [REJECTED] Account close to Static Max Loss Floor (${maxLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "MAX_DRAWDOWN_BREACH_GUARD" };
    }

    // 3. Balance-Based Daily Loss Check
    const maxDailyLossAmount = this.startOfDayBalance * (this.profile.dailyLossPercent / 100);
    const dailyLossFloor = this.startOfDayBalance - maxDailyLossAmount;

    if (currentEquity <= dailyLossFloor) {
      console.error(`❌ [REJECTED] Daily Loss Limit Reached (${dailyLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "DAILY_LOSS_BREACH_GUARD" };
    }

    // 4. Calculate position sizing & risk buffer check
    const slDistance = Math.abs(entryPrice - slPrice);
    if (slDistance === 0) return { allowed: false, reason: "INVALID_SL" };

    const maxCapitalToRisk = balance * (riskPercent / 100);

    if ((currentEquity - maxCapitalToRisk) <= maxLossFloor) {
      console.error(`❌ [REJECTED] Trade risk would breach Static Max Loss Floor (${maxLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "MAX_DRAWDOWN_POTENTIAL_BREACH" };
    }

    if ((currentEquity - maxCapitalToRisk) <= dailyLossFloor) {
      console.error(`❌ [REJECTED] Trade risk would breach Daily Loss Limit (${dailyLossFloor.toFixed(2)})`);
      return { allowed: false, reason: "DAILY_LOSS_POTENTIAL_BREACH" };
    }

    return {
      allowed: true,
      maxCapitalToRisk,
      profile: this.profile.name
    };
  }

  /**
   * Profile Switcher
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
   * Reset start-of-day baseline balance at 00:00 server time
   */
  updateStartOfDayBalance(newBalance) {
    this.startOfDayBalance = newBalance;
    console.log(`🌅 [Risk Engine] Start-of-day balance reset to: ${this.startOfDayBalance}`);
  }
}