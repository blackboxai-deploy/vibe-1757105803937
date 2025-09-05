export interface TradeConfig {
  stake: number;
  martingaleMultiplier: number;
  duration: number;
  positiveBarrier: number;
  negativeBarrier: number;
  selectedMarket: string;
  riskPercentage: number;
  lockedBalance: number;
}

export interface Trade {
  id: string;
  timestamp: Date;
  type: 'higher' | 'lower';
  stake: number;
  barrier: number;
  market: string;
  status: 'pending' | 'won' | 'lost' | 'active';
  payout?: number;
  profit?: number;
  contractId?: string;
}

export interface TradePair {
  id: string;
  timestamp: Date;
  higherTrade: Trade;
  lowerTrade: Trade;
  totalStake: number;
  totalProfit?: number;
  status: 'pending' | 'completed' | 'active';
}

export interface AccountInfo {
  balance: number;
  currency: string;
  loginId: string;
  availableBalance: number;
  lockedBalance: number;
}

export interface MarketData {
  symbol: string;
  name: string;
  pip: number;
  currentPrice: number;
  minBarrier: number;
  maxBarrier: number;
  minStake: number;
  maxStake: number;
}

export interface TradingState {
  isConnected: boolean;
  isTrading: boolean;
  accountInfo: AccountInfo | null;
  currentMarket: MarketData | null;
  tradeHistory: TradePair[];
  totalProfit: number;
  totalLoss: number;
  consecutiveLosses: number;
}

export interface RiskCalculation {
  recommendedStake: number;
  maxRisk: number;
  availableBalance: number;
  riskPercentage: number;
  canTrade: boolean;
}

export interface APIResponse<T = any> {
  msg_type: string;
  error?: {
    code: string;
    message: string;
  };
  [key: string]: any;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  lastHeartbeat?: Date;
}