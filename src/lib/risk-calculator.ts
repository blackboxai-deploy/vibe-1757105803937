import { RiskCalculation, AccountInfo, TradeConfig } from '@/types/trading';

export class RiskCalculator {
  
  /**
   * Calculate recommended stake based on account balance and risk percentage
   */
  static calculateRecommendedStake(
    accountInfo: AccountInfo,
    riskPercentage: number,
    martingaleMultiplier: number = 2
  ): RiskCalculation {
    const availableBalance = accountInfo.availableBalance;
    const riskAmount = (availableBalance * riskPercentage) / 100;
    
    // Calculate total risk for the trade sequence considering martingale
    // Formula: stake * (1 + martingale + martingale^2 + ... + martingale^n) * 2 (for dual trades)
    const martingaleSequenceRisk = this.calculateMartingaleSequenceRisk(
      1, // Base stake multiplier
      martingaleMultiplier,
      5 // Max martingale levels to consider
    );
    
    const recommendedStake = riskAmount / (martingaleSequenceRisk * 2); // *2 for dual trades
    
    // Ensure minimum and maximum stake limits
    const minStake = 0.35;
    const maxStake = Math.min(2000, availableBalance / 4); // Never risk more than 25% in a single trade
    
    const finalStake = Math.max(minStake, Math.min(maxStake, recommendedStake));
    
    return {
      recommendedStake: parseFloat(finalStake.toFixed(2)),
      maxRisk: riskAmount,
      availableBalance,
      riskPercentage,
      canTrade: availableBalance >= (finalStake * 2) // Minimum for dual trades
    };
  }

  /**
   * Calculate the total risk exposure for a martingale sequence
   */
  private static calculateMartingaleSequenceRisk(
    baseStake: number,
    multiplier: number,
    maxLevels: number
  ): number {
    let totalRisk = 0;
    let currentStake = baseStake;
    
    for (let i = 0; i <= maxLevels; i++) {
      totalRisk += currentStake;
      currentStake *= multiplier;
      
      // Break if stake becomes too large (safety measure)
      if (currentStake > baseStake * 32) break;
    }
    
    return totalRisk;
  }

  /**
   * Calculate stake with martingale progression
   */
  static calculateMartingaleStake(
    baseStake: number,
    consecutiveLosses: number,
    multiplier: number,
    maxMultiplier: number = 10
  ): number {
    if (consecutiveLosses === 0) {
      return baseStake;
    }
    
    const martingaleStake = baseStake * Math.pow(multiplier, consecutiveLosses);
    return Math.min(martingaleStake, baseStake * maxMultiplier);
  }

  /**
   * Check if a trade can be executed given current balance and risk settings
   */
  static canExecuteTrade(
    accountInfo: AccountInfo,
    config: TradeConfig,
    consecutiveLosses: number
  ): boolean {
    const martingaleStake = this.calculateMartingaleStake(
      config.stake,
      consecutiveLosses,
      config.martingaleMultiplier
    );
    
    const totalRequiredStake = martingaleStake * 2; // For dual trades
    return accountInfo.availableBalance >= totalRequiredStake;
  }

  /**
   * Calculate profit/loss percentage
   */
  static calculateProfitLossPercentage(
    currentProfit: number,
    initialBalance: number
  ): number {
    if (initialBalance === 0) return 0;
    return (currentProfit / initialBalance) * 100;
  }

  /**
   * Calculate win rate from trade history
   */
  static calculateWinRate(winCount: number, totalTrades: number): number {
    if (totalTrades === 0) return 0;
    return (winCount / totalTrades) * 100;
  }

  /**
   * Validate barrier values against market constraints
   */
  static validateBarriers(
    positiveBarrier: number,
    negativeBarrier: number,
    minBarrier: number,
    maxBarrier: number
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Ensure positive barrier is positive
    if (positiveBarrier <= 0) {
      errors.push('Positive barrier must be greater than 0');
    }
    
    // Ensure negative barrier is negative
    if (negativeBarrier >= 0) {
      errors.push('Negative barrier must be less than 0');
    }
    
    // Check barrier limits
    const absPositive = Math.abs(positiveBarrier);
    const absNegative = Math.abs(negativeBarrier);
    
    if (absPositive < minBarrier) {
      errors.push(`Positive barrier must be at least ${minBarrier}`);
    }
    
    if (absPositive > maxBarrier) {
      errors.push(`Positive barrier cannot exceed ${maxBarrier}`);
    }
    
    if (absNegative < minBarrier) {
      errors.push(`Negative barrier magnitude must be at least ${minBarrier}`);
    }
    
    if (absNegative > maxBarrier) {
      errors.push(`Negative barrier magnitude cannot exceed ${maxBarrier}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate expected value for a trade pair
   */
  static calculateExpectedValue(
    stake: number,
    payout: number,
    winProbability: number
  ): number {
    const expectedWin = payout * winProbability;
    const expectedLoss = stake * (1 - winProbability);
    return expectedWin - expectedLoss;
  }

  /**
   * Calculate maximum consecutive losses sustainable with current balance
   */
  static calculateMaxConsecutiveLosses(
    availableBalance: number,
    baseStake: number,
    multiplier: number
  ): number {
    let totalRisk = 0;
    let currentStake = baseStake * 2; // For dual trades
    let losses = 0;
    
    while (totalRisk + currentStake <= availableBalance) {
      totalRisk += currentStake;
      losses++;
      currentStake = baseStake * Math.pow(multiplier, losses) * 2;
      
      // Safety break
      if (losses > 10) break;
    }
    
    return Math.max(0, losses - 1);
  }

  /**
   * Calculate optimal risk percentage based on account size
   */
  static calculateOptimalRiskPercentage(accountBalance: number): number {
    // Kelly Criterion inspired approach
    if (accountBalance < 100) return 10; // Higher risk for small accounts
    if (accountBalance < 1000) return 5;
    if (accountBalance < 10000) return 3;
    return 2; // Conservative for large accounts
  }

  /**
   * Calculate time to double balance at current profit rate
   */
  static calculateTimeToDoubleBalance(
    currentBalance: number,
    profitPerHour: number
  ): number {
    if (profitPerHour <= 0) return Infinity;
    return currentBalance / profitPerHour;
  }

  /**
   * Calculate maximum drawdown percentage
   */
  static calculateMaxDrawdown(
    peakBalance: number,
    currentBalance: number
  ): number {
    if (peakBalance === 0) return 0;
    return ((peakBalance - currentBalance) / peakBalance) * 100;
  }
}