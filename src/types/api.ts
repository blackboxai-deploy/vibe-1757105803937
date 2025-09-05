export interface DerivAPIConfig {
  apiKey: string;
  endpoint: string;
  appId: number;
}

export interface AuthorizeResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      broker: string;
      created_at: number;
      currency: string;
      email: string;
      fullname: string;
      is_disabled: number;
      is_virtual: number;
      landing_company_name: string;
      loginid: string;
      trading: {
        [key: string]: any;
      };
    }>;
    balance: number;
    country: string;
    currency: string;
    email: string;
    fullname: string;
    is_virtual: number;
    landing_company_name: string;
    local_currencies: string[];
    loginid: string;
    preferred_language: string;
    upgradeable_landing_companies: string[];
    user_id: number;
  };
}

export interface TicksResponse {
  tick: {
    ask: number;
    bid: number;
    epoch: number;
    id: string;
    pip_size: number;
    quote: number;
    symbol: string;
  };
}

export interface ContractForResponse {
  contracts_for: {
    available: Array<{
      barrier_category: string;
      barriers: number;
      contract_category: string;
      contract_category_display: string;
      contract_display: string;
      contract_type: string;
      exchange_name: string;
      expiry_type: string;
      market: string;
      max_contract_duration: string;
      min_contract_duration: string;
      sentiment: string;
      start_type: string;
      submarket: string;
      underlying_symbol: string;
    }>;
    close: number;
    hit_count: number;
    open: number;
    spot: number;
  };
}

export interface BuyContractRequest {
  buy: number;
  parameters: {
    contract_type: string;
    currency: string;
    symbol: string;
    amount: number;
    duration: number;
    duration_unit: string;
    basis: string;
    barrier?: string;
    barrier2?: string;
  };
}

export interface BuyContractResponse {
  buy: {
    balance_after: number;
    buy_price: number;
    contract_id: number;
    longcode: string;
    payout: number;
    purchase_time: number;
    shortcode: string;
    start_time: number;
    transaction_id: number;
  };
}

export interface ProposalRequest {
  proposal: number;
  amount: number;
  basis: string;
  contract_type: string;
  currency: string;
  duration: number;
  duration_unit: string;
  symbol: string;
  barrier?: string;
  barrier2?: string;
}

export interface ProposalResponse {
  proposal: {
    ask_price: number;
    date_start: number;
    display_value: string;
    id: string;
    longcode: string;
    payout: number;
    spot: number;
    spot_time: number;
  };
}

export interface PortfolioResponse {
  portfolio: {
    contracts: Array<{
      app_id: number;
      buy_price: number;
      contract_id: number;
      contract_type: string;
      currency: string;
      date_start: number;
      expiry_time: number;
      longcode: string;
      payout: number;
      purchase_time: number;
      shortcode: string;
      symbol: string;
      transaction_id: number;
    }>;
  };
}

export interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    id: string;
    loginid: string;
  };
}