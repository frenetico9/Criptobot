
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
  emaTrend?: number[]; // Kept for contextual trend information (e.g., EMA50)
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
  startIndex: number; // Index in the full candle array
  endIndex: number;   // Index in the full candle array
  isMitigated?: boolean; // Has price already tested this FVG significantly?
  isPotentialPOI?: boolean; // Flag if this FVG is considered a Point of Interest by the strategy
}

export interface SwingPoint {
  type: 'high' | 'low';
  price: number;
  index: number; // Index in the full candle array
  date: string;
  isMajor?: boolean; // Optional: flag for more significant swing points
}

export interface MarketStructurePoint {
  type: 'BOS' | 'CHoCH' | 'Sweep'; // Break of Structure, Change of Character, Liquidity Sweep
  level: number; // Price level of the broken/swept structure
  index: number; // Index of the candle that confirmed the break/sweep
  date: string;
  direction: 'bullish' | 'bearish'; // Bullish BOS/CHoCH, Bearish BOS/CHoCH. For Sweep, direction of price movement after sweep.
  sweptPoint?: SwingPoint; // The swing point that was broken or swept
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  top: number;    // High of the OB candle for bearish, high of range for bullish
  bottom: number; // Low of the OB candle for bullish, low of range for bearish
  mid: number;    // Midpoint of the OB
  open: number;   // Open of the OB candle
  close: number;  // Close of the OB candle
  index: number;  // Index of the OB candle in the full candle array
  date: string;
  hasImbalance: boolean; // Does it have a subsequent FVG?
  sweptLiquidityBefore?: boolean; // Did this OB form after sweeping liquidity?
  isMitigated?: boolean;
  isPotentialPOI?: boolean; // Flag if this OB is considered a Point of Interest
}

export interface InducementPoint {
  level: number;
  index: number;
  date: string;
  type: 'high' | 'low'; // Liquidity type that was induced
  isSwept?: boolean;
  relatedMSS?: MarketStructurePoint; // The MSS this IDM is related to
}

export interface SmcAnalysis {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  marketStructurePoints: MarketStructurePoint[];
  inducementPoints: InducementPoint[];
  orderBlocks: OrderBlock[];
  fvgs: FVG[]; // All identified FVGs

  // POIs identified by the strategy for potential entry
  potentialBullishPOIs: (FVG | OrderBlock)[];
  potentialBearishPOIs: (FVG | OrderBlock)[];
  
  // For quick reference in AnalysisPanel, may duplicate some info from arrays above
  lastMSS?: MarketStructurePoint;
  lastInducement?: InducementPoint;
  selectedPOI?: FVG | OrderBlock; // The specific POI the strategy is targeting
}

export type TradeSignalType = 'COMPRA_FORTE' | 'COMPRA' | 'VENDA_FORTE' | 'VENDA' | 'NEUTRO' | 'ERRO' | 'AGUARDANDO_ENTRADA';
export type SignalConfidence = 'ALTA' | 'MÉDIA' | 'BAIXA' | 'N/D';
export type KillzoneSession = 'LONDON' | 'NEWYORK' | 'ASIA' | 'NONE';

export interface TradeSignal {
  type: TradeSignalType;
  details: string[]; // Contextual details, confluences, killzone info
  justification: string; // Main reason for the signal (e.g., SMC setup steps)
  entry?: number; // Proposed entry price
  stopLoss?: number;
  takeProfit?: number;
  levelsSource?: string; // e.g., "SMC Strategy - FVG Entry"
  confidenceScore?: SignalConfidence;
  killzone?: KillzoneSession; // Which killzone the signal formed in (if any)
  poiUsed?: FVG | OrderBlock; // The specific POI that triggered the entry
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
  reasonForExit?: 'TP_HIT' | 'SL_HIT' | 'END_OF_BACKTEST_PERIOD' | 'INSUFFICIENT_CAPITAL' | 'FILTERED_INTERNAL' | 'NO_CLEAR_SETUP' | 'IDM_NOT_SWEPT' | 'POI_MISSED' | 'REPEATED_BUY_LOSS_SEQUENCE' | 'NEUTRAL_SIGNAL' | 'SIGNAL_ERROR_OR_UNACTIONABLE';
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
  technicalIndicators: Partial<TechnicalIndicators>; // Snapshot of last values for general context
  smcAnalysis: SmcAnalysis; // Detailed SMC analysis results
  finalSignal: TradeSignal;
  fullHistory?: Candle[]; // Full historical data used for analysis
  fullIndicators?: TechnicalIndicators; // All calculated indicator series
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
  // General indicators
  emaShort?: number; // e.g. EMA9 for display
  emaLong?: number;  // e.g. EMA21 for display
  emaTrend?: number; // e.g. EMA50 for trend context
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  stochK?: number;
  stochD?: number;

  // SMC Visualizations
  isLondonKillzone?: boolean;
  isNewYorkKillzone?: boolean;
  // Other SMC elements like BOS/CHoCH lines, IDM markers, POI highlights will be drawn as ReferenceLines/Areas or custom shapes
}
