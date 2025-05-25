
export interface Candle {
  date: string; // ISO string or timestamp number
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  emaShort?: number[]; 
  emaLong?: number[];  
  emaTrend?: number[]; // Kept for contextual trend information
  rsi?: number[];
  macdLine?: number[];
  macdSignal?: number[];
  macdHist?: number[];
  bbUpper?: number[];
  bbMiddle?: number[];
  bbLower?: number[];
  atr?: number[];
  stochK?: number[];
  stochD?: number[];
  volumeSma?: number[];
  engulfing?: number[]; // 100 bullish engulf, -100 bearish engulf, 150 hammer, -150 shooting star, 0 none
}

export interface FVG {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  mid: number;
  startIndex: number;
  endIndex: number;
}

export interface SwingPoint {
  type: 'high' | 'low';
  price: number;
  index: number;
}

export interface SmcAnalysis {
  fvgs: FVG[];
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  recentSwingHigh?: number;
  recentSwingLow?: number;
  closestBullishFVG?: FVG;
  closestBearishFVG?: FVG;
}

export type TradeSignalType = 'COMPRA_FORTE' | 'COMPRA' | 'VENDA_FORTE' | 'VENDA' | 'NEUTRO' | 'ERRO';
export type SignalConfidence = 'ALTA' | 'MÉDIA' | 'BAIXA' | 'N/D';

export interface TradeSignal {
  type: TradeSignalType;
  details: string[];
  justification: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  levelsSource?: string;
  confidenceScore?: SignalConfidence;
}

export interface BacktestTrade {
  assetId: string;
  signalCandleDate: string; 
  signalType: 'COMPRA' | 'VENDA'; 
  entryDate: string;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  exitDate?: string;
  exitPrice?: number;
  result: 'WIN' | 'LOSS' | 'OPEN' | 'NO_TRIGGER' | 'IGNORED'; 
  pnlPoints?: number;
  pnlPercentage?: number; 
  // Simplified reasonForExit
  reasonForExit?: 'TP_HIT' | 'SL_HIT' | 'END_OF_BACKTEST_PERIOD' | 'INSUFFICIENT_CAPITAL' | 'FILTERED_INTERNAL' | 'NO_CLEAR_SETUP';
  durationCandles?: number;
  pnlBRL?: number; 
  capitalBeforeTrade?: number; 
  capitalAfterTrade?: number; 
}

export interface StrategyBacktestResult {
  assetId: string;
  periodDays: number;
  startDate: string; 
  endDate: string;   
  
  initialCapitalBRL: number;
  riskPerTradeBRL: number;
  finalCapitalBRL: number;
  totalPnlBRL: number;
  percentageReturn: number; 

  totalTradesAttempted: number; 
  totalTradesExecuted: number; 
  totalTradesIgnored: number; 
  winningTrades: number;
  losingTrades: number;
  winRateExecuted: number; 
  
  totalPnlPoints: number; 
  averageWinPoints?: number;
  averageLossPoints?: number;
  profitFactor?: number; 
  
  peakCapitalBRL: number; 
  maxDrawdownBRL: number; 
  maxDrawdownPercentage: number; 

  trades: BacktestTrade[];
  summaryMessage: string;
  error?: string; 
}


export interface AnalysisReport {
  asset: string;
  lastCandle: Candle | null;
  technicalIndicators: Partial<TechnicalIndicators>; 
  smcAnalysis: SmcAnalysis;
  finalSignal: TradeSignal;
  fullHistory?: Candle[]; 
  fullIndicators?: TechnicalIndicators; 
  strategyBacktestResult?: StrategyBacktestResult | null;
}

export enum AssetType {
  CRYPTO = 'CRIPTO',
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
}

export interface ChartDatapoint extends Candle {
  emaShort?: number;
  emaLong?: number;
  emaTrend?: number; // Kept for chart display
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  stochK?: number;
  stochD?: number;
}
