import { 
  DerivAPIConfig, 
  AuthorizeResponse, 
  TicksResponse, 
  BuyContractRequest,
  BuyContractResponse,
  ProposalRequest,
  ProposalResponse,
  BalanceResponse,
  ContractForResponse,
  PortfolioResponse
} from '@/types/api';

export class DerivAPI {
  private ws: WebSocket | null = null;
  private config: DerivAPIConfig;
  private requestId = 1;
  private callbacks: Map<number, (data: any) => void> = new Map();
  private subscriptions: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: DerivAPIConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.config.endpoint}?app_id=${this.config.appId}`);
        
        this.ws.onopen = () => {
          console.log('Connected to Deriv API');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket connection closed:', event);
          this.handleReconnection();
        };

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    // Handle subscription messages
    if (data.msg_type === 'tick' && this.subscriptions.has('tick')) {
      this.subscriptions.get('tick')?.(data as TicksResponse);
      return;
    }

    if (data.msg_type === 'balance' && this.subscriptions.has('balance')) {
      this.subscriptions.get('balance')?.(data as BalanceResponse);
      return;
    }

    if (data.msg_type === 'portfolio' && this.subscriptions.has('portfolio')) {
      this.subscriptions.get('portfolio')?.(data as PortfolioResponse);
      return;
    }

    // Handle request responses
    if (data.req_id && this.callbacks.has(data.req_id)) {
      const callback = this.callbacks.get(data.req_id);
      this.callbacks.delete(data.req_id);
      callback?.(data);
    }
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private startHeartbeat() {
    // Send ping every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ ping: 1 });
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  }

  private send(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const reqId = this.requestId++;
      const message = { ...data, req_id: reqId };

      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          reject(new Error(response.error.message || 'API Error'));
        } else {
          resolve(response);
        }
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          this.callbacks.delete(reqId);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      this.ws.send(JSON.stringify(message));
    });
  }

  async authorize(): Promise<AuthorizeResponse> {
    const response = await this.send({
      authorize: this.config.apiKey
    });
    return response as AuthorizeResponse;
  }

  async getBalance(): Promise<BalanceResponse> {
    const response = await this.send({
      balance: 1
    });
    return response as BalanceResponse;
  }

  async subscribeToTicks(symbol: string, callback: (data: TicksResponse) => void) {
    this.subscriptions.set('tick', callback);
    return this.send({
      ticks: symbol,
      subscribe: 1
    });
  }

  async subscribeToBalance(callback: (data: BalanceResponse) => void) {
    this.subscriptions.set('balance', callback);
    return this.send({
      balance: 1,
      subscribe: 1
    });
  }

  async subscribeToPortfolio(callback: (data: PortfolioResponse) => void) {
    this.subscriptions.set('portfolio', callback);
    return this.send({
      portfolio: 1,
      subscribe: 1
    });
  }

  async getContractsFor(symbol: string): Promise<ContractForResponse> {
    const response = await this.send({
      contracts_for: symbol
    });
    return response as ContractForResponse;
  }

  async getProposal(request: ProposalRequest): Promise<ProposalResponse> {
    const response = await this.send(request);
    return response as ProposalResponse;
  }

  async buyContract(request: BuyContractRequest): Promise<BuyContractResponse> {
    const response = await this.send(request);
    return response as BuyContractResponse;
  }

  async sellContract(contractId: number): Promise<any> {
    return this.send({
      sell: contractId,
      price: 0 // Market price
    });
  }

  unsubscribe(subscriptionId: string) {
    return this.send({
      forget: subscriptionId
    });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.callbacks.clear();
    this.subscriptions.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false;
  }
}

// Market configurations for different instruments
export const MARKET_CONFIGS = {
  'R_10': {
    name: 'Volatility 10 Index',
    symbol: 'R_10',
    pip: 0.01,
    minBarrier: 0.1,
    maxBarrier: 10.0,
    minStake: 0.35,
    maxStake: 2000,
    barrierStep: 0.1
  },
  'R_25': {
    name: 'Volatility 25 Index',
    symbol: 'R_25',
    pip: 0.01,
    minBarrier: 0.1,
    maxBarrier: 25.0,
    minStake: 0.35,
    maxStake: 2000,
    barrierStep: 0.1
  },
  'R_50': {
    name: 'Volatility 50 Index',
    symbol: 'R_50',
    pip: 0.01,
    minBarrier: 0.1,
    maxBarrier: 50.0,
    minStake: 0.35,
    maxStake: 2000,
    barrierStep: 0.1
  },
  'R_75': {
    name: 'Volatility 75 Index',
    symbol: 'R_75',
    pip: 0.01,
    minBarrier: 0.1,
    maxBarrier: 75.0,
    minStake: 0.35,
    maxStake: 2000,
    barrierStep: 0.1
  },
  'R_100': {
    name: 'Volatility 100 Index',
    symbol: 'R_100',
    pip: 0.01,
    minBarrier: 0.1,
    maxBarrier: 100.0,
    minStake: 0.35,
    maxStake: 2000,
    barrierStep: 0.1
  }
};

export const DEFAULT_CONFIG: DerivAPIConfig = {
  apiKey: '',
  endpoint: 'wss://ws.derivws.com/websockets/v3',
  appId: 1089 // Demo app ID - users should replace with their own
};