
export interface Candle {
  date: string; // ISO string or timestamp number
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  emaShort?: number[]; // EMA 9 (or configurable short period)
  emaLong?: number[];  // EMA 21 (or configurable long period)
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
  engulfing?: number[]; // 100 para alta, -100 para baixa, 0 para nenhum
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

export interface SentimentAnalysis {
  score: number; // -1 a 1
  description?: string;
}

export interface NewsSentimentAnalysis {
  score: number; // -1 a 1
  description: string;
  keyNewsTopics: string[];
}

export type MlTrend = 'ALTA' | 'BAIXA' | 'LATERAL' | 'N/D';

export interface MlPrediction {
  trend: MlTrend;
  confidence: number; // 0 a 1
  targetHorizonCandles?: number;
}

export type TradeSignalType = 'COMPRA_FORTE' | 'COMPRA' | 'VENDA_FORTE' | 'VENDA' | 'NEUTRO' | 'ERRO';

export interface TradeSignal {
  type: TradeSignalType;
  details: string[];
  justification: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  levelsSource?: string;
  takeProfitProbability?: number;
}

export interface AnalysisReport {
  asset: string;
  lastCandle: Candle | null;
  technicalIndicators: Partial<TechnicalIndicators>; // Snapshot of last values
  smcAnalysis: SmcAnalysis;
  sentiment: SentimentAnalysis;
  newsSentiment: NewsSentimentAnalysis;
  mlPrediction: MlPrediction;
  finalSignal: TradeSignal;
  fullHistory?: Candle[]; // Full historical data used for analysis
  fullIndicators?: TechnicalIndicators; // All calculated indicator series
  backtestResult?: string | null;
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
