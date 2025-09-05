'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DerivAPI, DEFAULT_CONFIG, MARKET_CONFIGS } from '@/lib/deriv-api';
import { TradingEngine } from '@/lib/trading-engine';
import { RiskCalculator } from '@/lib/risk-calculator';
import { TradeConfig, TradingState } from '@/types/trading';

export default function TradingDashboard() {
  // Connection states
  const [apiKey, setApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // Trading configuration
  const [config, setConfig] = useState<TradeConfig>({
    stake: 1.0,
    martingaleMultiplier: 2.0,
    duration: 60,
    positiveBarrier: 1.0,
    negativeBarrier: 1.0,
    selectedMarket: 'R_10',
    riskPercentage: 50,
    lockedBalance: 0
  });

  // Trading states
  const [tradingState, setTradingState] = useState<TradingState>({
    isConnected: false,
    isTrading: false,
    accountInfo: null,
    currentMarket: null,
    tradeHistory: [],
    totalProfit: 0,
    totalLoss: 0,
    consecutiveLosses: 0
  });

  // UI states
  const [autoCalculateStake, setAutoCalculateStake] = useState(true);

  // API and trading engine instances
  const [api, setApi] = useState<DerivAPI | null>(null);
  const [tradingEngine, setTradingEngine] = useState<TradingEngine | null>(null);

  // Initialize API and trading engine
  const initializeConnection = useCallback(async () => {
    if (!apiKey.trim()) {
      setConnectionError('Please enter your API key');
      return;
    }

    setConnecting(true);
    setConnectionError('');

    try {
      const apiConfig = { ...DEFAULT_CONFIG, apiKey: apiKey.trim() };
      const newApi = new DerivAPI(apiConfig);
      
      await newApi.connect();
      const newEngine = new TradingEngine(newApi);
      
      newEngine.setStateUpdateCallback((state) => {
        setTradingState(state);
        setIsConnected(state.isConnected);
      });

      await newEngine.initialize();
      await newEngine.setMarket(config.selectedMarket, MARKET_CONFIGS[config.selectedMarket as keyof typeof MARKET_CONFIGS]);

      setApi(newApi);
      setTradingEngine(newEngine);
      
      // Save API key to localStorage
      localStorage.setItem('deriv_api_key', apiKey);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [apiKey, config.selectedMarket]);

  // Disconnect from API
  const disconnect = useCallback(() => {
    if (tradingEngine) {
      tradingEngine.disconnect();
      tradingEngine.stopAutoTrading();
    }
    if (api) {
      api.disconnect();
    }
    
    setApi(null);
    setTradingEngine(null);
    setIsConnected(false);
    setTradingState({
      isConnected: false,
      isTrading: false,
      accountInfo: null,
      currentMarket: null,
      tradeHistory: [],
      totalProfit: 0,
      totalLoss: 0,
      consecutiveLosses: 0
    });
  }, [api, tradingEngine]);

  // Start trading
  const startTrading = useCallback(async () => {
    if (!tradingEngine || !tradingState.accountInfo) return;

    try {
      // Set locked balance
      tradingEngine.setLockedBalance(config.lockedBalance);
      
      // Start auto trading
      await tradingEngine.startAutoTrading(config);
    } catch (error) {
      console.error('Failed to start trading:', error);
    }
  }, [tradingEngine, config, tradingState.accountInfo]);

  // Stop trading
  const stopTrading = useCallback(() => {
    if (tradingEngine) {
      tradingEngine.stopAutoTrading();
    }
  }, [tradingEngine]);

  // Update market selection
  const updateMarket = useCallback(async (marketSymbol: string) => {
    if (!tradingEngine) return;

    try {
      await tradingEngine.setMarket(marketSymbol, MARKET_CONFIGS[marketSymbol as keyof typeof MARKET_CONFIGS]);
      setConfig(prev => ({ ...prev, selectedMarket: marketSymbol }));
    } catch (error) {
      console.error('Failed to update market:', error);
    }
  }, [tradingEngine]);

  // Auto-calculate recommended stake
  useEffect(() => {
    if (autoCalculateStake && tradingState.accountInfo) {
      const riskCalc = RiskCalculator.calculateRecommendedStake(
        tradingState.accountInfo,
        config.riskPercentage,
        config.martingaleMultiplier
      );
      
      if (riskCalc.canTrade) {
        setConfig(prev => ({ ...prev, stake: riskCalc.recommendedStake }));
      }
    }
  }, [autoCalculateStake, tradingState.accountInfo, config.riskPercentage, config.martingaleMultiplier]);

  // Load saved API key on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('deriv_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Calculate current P&L
  const currentPL = tradingState.totalProfit - tradingState.totalLoss;
  const plPercentage = tradingState.accountInfo ? 
    (currentPL / tradingState.accountInfo.balance) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Deriv Trading Bot
          </h1>
          <p className="text-blue-200">
            Advanced Dual Barrier Trading Platform
          </p>
        </div>

        {/* Connection Panel */}
        <Card className="p-6 mb-6 bg-white/10 border-white/20 backdrop-blur-sm">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">API Connection</h2>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="api-key" className="text-white">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Deriv API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={connecting || isConnected}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                />
              </div>
              
              <div className="flex items-end space-x-2">
                <Button
                  onClick={isConnected ? disconnect : initializeConnection}
                  disabled={connecting}
                  variant={isConnected ? "destructive" : "default"}
                  className="flex-1"
                >
                  {connecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            
            {connectionError && (
              <Alert variant="destructive">
                <AlertDescription>{connectionError}</AlertDescription>
              </Alert>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Trading Controls */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Account Info */}
            {isConnected && tradingState.accountInfo && (
              <Card className="p-6 bg-white/10 border-white/20 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-blue-200">Balance</Label>
                    <p className="text-white font-semibold">
                      {tradingState.accountInfo.currency} {tradingState.accountInfo.balance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-blue-200">Available</Label>
                    <p className="text-white font-semibold">
                      {tradingState.accountInfo.currency} {tradingState.accountInfo.availableBalance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-blue-200">P&L</Label>
                    <p className={`font-semibold ${currentPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tradingState.accountInfo.currency} {currentPL.toFixed(2)} ({plPercentage.toFixed(2)}%)
                    </p>
                  </div>
                  <div>
                    <Label className="text-blue-200">Win Rate</Label>
                    <p className="text-white font-semibold">
                      {tradingState.tradeHistory.length > 0 ? 
                        ((tradingState.tradeHistory.filter(t => (t.totalProfit || 0) > 0).length / tradingState.tradeHistory.length) * 100).toFixed(1) : '0'}%
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Trading Configuration */}
            <Card className="p-6 bg-white/10 border-white/20 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Trading Configuration</h3>
              
              <div className="space-y-4">
                {/* Market Selection */}
                <div>
                  <Label className="text-white">Market</Label>
                  <Select value={config.selectedMarket} onValueChange={updateMarket}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKET_CONFIGS).map(([key, market]) => (
                        <SelectItem key={key} value={key}>
                          {market.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stake */}
                  <div>
                    <Label className="text-white">Stake Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.35"
                      value={config.stake}
                      onChange={(e) => setConfig(prev => ({ ...prev, stake: parseFloat(e.target.value) || 0 }))}
                      disabled={autoCalculateStake}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <Label className="text-white">Duration (seconds)</Label>
                    <Input
                      type="number"
                      min="15"
                      max="3600"
                      value={config.duration}
                      onChange={(e) => setConfig(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>

                  {/* Martingale */}
                  <div>
                    <Label className="text-white">Martingale Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={config.martingaleMultiplier}
                      onChange={(e) => setConfig(prev => ({ ...prev, martingaleMultiplier: parseFloat(e.target.value) || 2 }))}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>
                </div>

                {/* Barriers */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Positive Barrier (+)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={config.positiveBarrier}
                      onChange={(e) => setConfig(prev => ({ ...prev, positiveBarrier: parseFloat(e.target.value) || 1 }))}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Negative Barrier (-)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      max="-0.1"
                      value={-Math.abs(config.negativeBarrier)}
                      onChange={(e) => setConfig(prev => ({ ...prev, negativeBarrier: Math.abs(parseFloat(e.target.value) || 1) }))}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>
                </div>

                <Separator className="bg-white/20" />

                {/* Risk Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white">Auto Calculate Stake</Label>
                    <Switch
                      checked={autoCalculateStake}
                      onCheckedChange={setAutoCalculateStake}
                    />
                  </div>

                  {autoCalculateStake && (
                    <div>
                      <Label className="text-white">Risk Percentage: {config.riskPercentage}%</Label>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-blue-200 text-sm">10%</span>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={config.riskPercentage}
                          onChange={(e) => setConfig(prev => ({ ...prev, riskPercentage: parseInt(e.target.value) }))}
                          className="flex-1"
                          style={{ accentColor: '#3b82f6' }}
                        />
                        <span className="text-blue-200 text-sm">90%</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-white">Locked Balance (Protection)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={config.lockedBalance}
                      onChange={(e) => setConfig(prev => ({ ...prev, lockedBalance: parseFloat(e.target.value) || 0 }))}
                      className="bg-white/20 border-white/30 text-white"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Trading Controls */}
            <Card className="p-6 bg-white/10 border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Trading Controls</h3>
                <Badge variant={tradingState.isTrading ? "default" : "secondary"}>
                  {tradingState.isTrading ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              <div className="flex space-x-4">
                <Button
                  onClick={startTrading}
                  disabled={!isConnected || tradingState.isTrading || !tradingState.accountInfo}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Start Trading
                </Button>
                <Button
                  onClick={stopTrading}
                  disabled={!tradingState.isTrading}
                  variant="destructive"
                  className="flex-1"
                >
                  Stop Trading
                </Button>
              </div>

              {tradingState.consecutiveLosses > 0 && (
                <div className="mt-4">
                  <Alert>
                    <AlertDescription className="text-orange-600">
                      Consecutive Losses: {tradingState.consecutiveLosses}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Trade History & Logs */}
          <div className="space-y-6">
            <Card className="p-6 bg-white/10 border-white/20 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Trade History</h3>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {tradingState.tradeHistory.length === 0 ? (
                    <p className="text-blue-200 text-center py-8">No trades executed yet</p>
                  ) : (
                    tradingState.tradeHistory.map((pair) => (
                      <div key={pair.id} className="p-3 bg-white/5 rounded-md">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-blue-200">
                            {pair.timestamp.toLocaleTimeString()}
                          </span>
                          <Badge variant={pair.status === 'active' ? 'default' : pair.totalProfit && pair.totalProfit > 0 ? 'default' : 'destructive'}>
                            {pair.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-blue-200">Higher: +{pair.higherTrade.barrier}</p>
                            <p className="text-white">{pair.higherTrade.status}</p>
                          </div>
                          <div>
                            <p className="text-blue-200">Lower: -{Math.abs(pair.lowerTrade.barrier)}</p>
                            <p className="text-white">{pair.lowerTrade.status}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between mt-2">
                          <span className="text-xs text-blue-200">
                            Stake: {pair.totalStake.toFixed(2)}
                          </span>
                          {pair.totalProfit !== undefined && (
                            <span className={`text-xs font-semibold ${pair.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pair.totalProfit >= 0 ? '+' : ''}{pair.totalProfit.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Current Market Info */}
            {tradingState.currentMarket && (
              <Card className="p-6 bg-white/10 border-white/20 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Market Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-200">Symbol:</span>
                    <span className="text-white">{tradingState.currentMarket.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Current Price:</span>
                    <span className="text-white">{tradingState.currentMarket.currentPrice.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Min Stake:</span>
                    <span className="text-white">{tradingState.currentMarket.minStake}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Max Stake:</span>
                    <span className="text-white">{tradingState.currentMarket.maxStake}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}