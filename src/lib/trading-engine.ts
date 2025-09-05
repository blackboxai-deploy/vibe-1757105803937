import { DerivAPI } from './deriv-api';
import { 
  Trade, 
  TradePair, 
  TradeConfig, 
  TradingState 
} from '@/types/trading';
import { 
  BuyContractRequest, 
  ProposalRequest,
  TicksResponse 
} from '@/types/api';

export class TradingEngine {
  private api: DerivAPI;
  private tradingState: TradingState;
  private tradeTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentPrice = 0;
  private onStateUpdate?: (state: TradingState) => void;

  constructor(api: DerivAPI) {
    this.api = api;
    this.tradingState = {
      isConnected: false,
      isTrading: false,
      accountInfo: null,
      currentMarket: null,
      tradeHistory: [],
      totalProfit: 0,
      totalLoss: 0,
      consecutiveLosses: 0
    };
  }

  setStateUpdateCallback(callback: (state: TradingState) => void) {
    this.onStateUpdate = callback;
    this.notifyStateUpdate();
  }

  private notifyStateUpdate() {
    if (this.onStateUpdate) {
      this.onStateUpdate({ ...this.tradingState });
    }
  }

  async initialize(): Promise<void> {
    try {
      // Authorize and get account info
      await this.api.authorize();
      const balanceResponse = await this.api.getBalance();
      
      this.tradingState.accountInfo = {
        balance: balanceResponse.balance.balance,
        currency: balanceResponse.balance.currency,
        loginId: balanceResponse.balance.loginid,
        availableBalance: balanceResponse.balance.balance,
        lockedBalance: 0
      };

      this.tradingState.isConnected = true;
      this.notifyStateUpdate();

      // Subscribe to balance updates
      this.api.subscribeToBalance((data) => {
        if (this.tradingState.accountInfo) {
          this.tradingState.accountInfo.balance = data.balance.balance;
          this.tradingState.accountInfo.availableBalance = 
            data.balance.balance - this.tradingState.accountInfo.lockedBalance;
          this.notifyStateUpdate();
        }
      });

    } catch (error) {
      console.error('Failed to initialize trading engine:', error);
      throw error;
    }
  }

  async setMarket(marketSymbol: string, marketConfig: any): Promise<void> {
    try {
      // Get contracts for the market
      await this.api.getContractsFor(marketSymbol);
      
      this.tradingState.currentMarket = {
        symbol: marketSymbol,
        name: marketConfig.name,
        pip: marketConfig.pip,
        currentPrice: 0,
        minBarrier: marketConfig.minBarrier,
        maxBarrier: marketConfig.maxBarrier,
        minStake: marketConfig.minStake,
        maxStake: marketConfig.maxStake
      };

      // Subscribe to price ticks
      await this.api.subscribeToTicks(marketSymbol, (data: TicksResponse) => {
        this.currentPrice = data.tick.quote;
        if (this.tradingState.currentMarket) {
          this.tradingState.currentMarket.currentPrice = this.currentPrice;
          this.notifyStateUpdate();
        }
      });

      this.notifyStateUpdate();
    } catch (error) {
      console.error('Failed to set market:', error);
      throw error;
    }
  }

  async executeTradePair(config: TradeConfig): Promise<TradePair> {
    if (!this.tradingState.currentMarket || !this.tradingState.accountInfo) {
      throw new Error('Market or account info not available');
    }

    const tradePairId = `pair_${Date.now()}`;
    const timestamp = new Date();

    try {
      // Calculate actual stake (considering martingale)
      const actualStake = this.calculateStakeWithMartingale(config);
      
      // Validate barriers
      const { positiveBarrier, negativeBarrier } = this.calculateBarriers(
        config.positiveBarrier, 
        config.negativeBarrier
      );

      // Create trade objects
      const higherTrade: Trade = {
        id: `${tradePairId}_higher`,
        timestamp,
        type: 'higher',
        stake: actualStake,
        barrier: positiveBarrier,
        market: config.selectedMarket,
        status: 'pending'
      };

      const lowerTrade: Trade = {
        id: `${tradePairId}_lower`,
        timestamp,
        type: 'lower',
        stake: actualStake,
        barrier: negativeBarrier,
        market: config.selectedMarket,
        status: 'pending'
      };

      // Execute both trades simultaneously
      const [higherResult, lowerResult] = await Promise.all([
        this.executeSingleTrade(higherTrade, config),
        this.executeSingleTrade(lowerTrade, config)
      ]);

      // Update trade objects with results
      higherTrade.contractId = higherResult.buy.contract_id.toString();
      higherTrade.payout = higherResult.buy.payout;
      higherTrade.status = 'active';

      lowerTrade.contractId = lowerResult.buy.contract_id.toString();
      lowerTrade.payout = lowerResult.buy.payout;
      lowerTrade.status = 'active';

      // Create trade pair
      const tradePair: TradePair = {
        id: tradePairId,
        timestamp,
        higherTrade,
        lowerTrade,
        totalStake: actualStake * 2,
        status: 'active'
      };

      // Add to history
      this.tradingState.tradeHistory.unshift(tradePair);
      this.notifyStateUpdate();

      return tradePair;

    } catch (error) {
      console.error('Failed to execute trade pair:', error);
      throw error;
    }
  }

  private async executeSingleTrade(trade: Trade, config: TradeConfig): Promise<any> {
    if (!this.tradingState.currentMarket) {
      throw new Error('No market selected');
    }

    // Get proposal first
    const proposalRequest: ProposalRequest = {
      proposal: 1,
      amount: trade.stake,
      basis: 'stake',
      contract_type: trade.type === 'higher' ? 'CALL' : 'PUT',
      currency: this.tradingState.accountInfo?.currency || 'USD',
      duration: config.duration,
      duration_unit: 's',
      symbol: config.selectedMarket,
      barrier: trade.barrier.toString()
    };

    const proposal = await this.api.getProposal(proposalRequest);

    // Execute the trade
    const buyRequest: BuyContractRequest = {
      buy: parseFloat(proposal.proposal.id),
      parameters: {
        contract_type: trade.type === 'higher' ? 'CALL' : 'PUT',
        currency: this.tradingState.accountInfo?.currency || 'USD',
        symbol: config.selectedMarket,
        amount: trade.stake,
        duration: config.duration,
        duration_unit: 's',
        basis: 'stake',
        barrier: trade.barrier.toString()
      }
    };

    return await this.api.buyContract(buyRequest);
  }

  private calculateStakeWithMartingale(config: TradeConfig): number {
    let stake = config.stake;
    
    if (this.tradingState.consecutiveLosses > 0) {
      stake = config.stake * Math.pow(config.martingaleMultiplier, this.tradingState.consecutiveLosses);
    }

    return Math.min(stake, config.stake * 10); // Cap at 10x original stake
  }

  private calculateBarriers(positiveBarrier: number, negativeBarrier: number): { positiveBarrier: number, negativeBarrier: number } {
    // Ensure barriers are properly formatted and within limits
    const market = this.tradingState.currentMarket;
    if (!market) {
      return { positiveBarrier, negativeBarrier: -Math.abs(negativeBarrier) };
    }

    const clampedPositive = Math.max(
      market.minBarrier, 
      Math.min(market.maxBarrier, Math.abs(positiveBarrier))
    );

    const clampedNegative = -Math.max(
      market.minBarrier, 
      Math.min(market.maxBarrier, Math.abs(negativeBarrier))
    );

    return {
      positiveBarrier: clampedPositive,
      negativeBarrier: clampedNegative
    };
  }

  async startAutoTrading(config: TradeConfig): Promise<void> {
    if (this.tradingState.isTrading) {
      throw new Error('Trading is already active');
    }

    this.tradingState.isTrading = true;
    this.notifyStateUpdate();

    const executeNextTrade = async () => {
      if (!this.tradingState.isTrading) return;

      try {
        // Check if we have sufficient balance
        if (!this.canExecuteTrade(config)) {
          console.log('Insufficient balance or risk limits reached');
          this.stopAutoTrading();
          return;
        }

        // Execute trade pair
        await this.executeTradePair(config);

        // Wait for specified duration before next trade
        const waitTime = Math.max(config.duration * 1000, 10000); // Minimum 10 seconds
        this.tradeTimeout = setTimeout(executeNextTrade, waitTime);

      } catch (error) {
        console.error('Auto trading error:', error);
        this.stopAutoTrading();
      }
    };

    // Start the trading loop
    executeNextTrade();
  }

  stopAutoTrading(): void {
    this.tradingState.isTrading = false;
    
    if (this.tradeTimeout) {
      clearTimeout(this.tradeTimeout);
      this.tradeTimeout = null;
    }

    this.notifyStateUpdate();
  }

  private canExecuteTrade(config: TradeConfig): boolean {
    if (!this.tradingState.accountInfo) return false;

    const requiredStake = this.calculateStakeWithMartingale(config) * 2; // For both trades
    const availableBalance = this.tradingState.accountInfo.availableBalance;

    return availableBalance >= requiredStake;
  }

  updateTradeResult(contractId: string, profit: number, won: boolean): void {
    // Find the trade in history and update its result
    for (const pair of this.tradingState.tradeHistory) {
      let tradeUpdated = false;

      if (pair.higherTrade.contractId === contractId) {
        pair.higherTrade.profit = profit;
        pair.higherTrade.status = won ? 'won' : 'lost';
        tradeUpdated = true;
      }

      if (pair.lowerTrade.contractId === contractId) {
        pair.lowerTrade.profit = profit;
        pair.lowerTrade.status = won ? 'won' : 'lost';
        tradeUpdated = true;
      }

      if (tradeUpdated) {
        // Check if both trades in the pair are completed
        const bothCompleted = pair.higherTrade.status !== 'active' && pair.lowerTrade.status !== 'active';
        
        if (bothCompleted) {
          pair.status = 'completed';
          pair.totalProfit = (pair.higherTrade.profit || 0) + (pair.lowerTrade.profit || 0);

          // Update overall P&L
          if (pair.totalProfit > 0) {
            this.tradingState.totalProfit += pair.totalProfit;
            this.tradingState.consecutiveLosses = 0;
          } else {
            this.tradingState.totalLoss += Math.abs(pair.totalProfit);
            this.tradingState.consecutiveLosses++;
          }
        }
        break;
      }
    }

    this.notifyStateUpdate();
  }

  getTradingState(): TradingState {
    return { ...this.tradingState };
  }

  setLockedBalance(amount: number): void {
    if (this.tradingState.accountInfo) {
      this.tradingState.accountInfo.lockedBalance = amount;
      this.tradingState.accountInfo.availableBalance = 
        this.tradingState.accountInfo.balance - amount;
      this.notifyStateUpdate();
    }
  }

  disconnect(): void {
    this.stopAutoTrading();
    this.tradingState.isConnected = false;
    this.notifyStateUpdate();
  }
}