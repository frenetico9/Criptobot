
import { Asset, AssetType } from './types';

// Timeframe M15
export const CANDLE_DURATION_MINUTES = 15;

// Períodos dos Indicadores para Estratégia M15 (EMA-based)
export const EMA_SHORT_PERIOD = 9;
export const EMA_LONG_PERIOD = 21;
export const EMA_TREND_PERIOD = 50; // Kept for contextual trend information

export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70; 
export const RSI_OVERSOLD = 30;   

export const MACD_FAST_PERIOD = 12; 
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;
export const BBANDS_PERIOD = 20;    
export const BBANDS_STDDEV = 2;
export const ATR_PERIOD = 14;
export const STOCH_K_PERIOD = 14;   
export const STOCH_D_PERIOD = 3;
export const STOCH_SMOOTH_K = 3;
export const VOLUME_SMA_PERIOD = 20;

// Configurações da Estratégia M15 EMA Crossover & Pullback
export const STRATEGY_LOOKBACK_CANDLES = 10; 
export const STRATEGY_EMA_CROSSOVER_LOOKBACK = 3; 
export const STRATEGY_PULLBACK_MAX_DEPTH_FACTOR = 0.5; 
export const STRATEGY_RSI_CONFIRM_BUY_MIN = 45; 
export const STRATEGY_RSI_CONFIRM_BUY_MAX = 75; 
export const STRATEGY_RSI_CONFIRM_SELL_MAX = 55; 
export const STRATEGY_RSI_CONFIRM_SELL_MIN = 25; 
export const STRATEGY_SL_ATR_MULTIPLIER = 1.5; 
export const STRATEGY_RR_RATIO = 1.5; // RR 1:1.5
export const STRATEGY_VOLUME_CONFIRMATION_RATIO = 1.2; 
export const STRATEGY_MIN_CONFLUENCES_FOR_STRONG_SIGNAL = 2; 

// Configurações SMC/ICT
export const SMC_LOOKBACK_PERIOD_CANDLES = 30; 
export const SMC_FVG_MIN_ATR_FACTOR = 0.3;

// Busca e exibição de dados
export const NUM_CANDLES_TO_FETCH = 300; 
export const NUM_CANDLES_TO_DISPLAY = 150;

export const VOLUME_SPIKE_RATIO = 1.8; 

// Configurações de Backtest de Estratégia
export const BACKTEST_PERIOD_DAYS = 30; // REVERTED to 30 days
export const BACKTEST_CANDLES_PER_DAY = (24 * 60) / CANDLE_DURATION_MINUTES; 
export const BACKTEST_TOTAL_CANDLES_FOR_PERIOD = BACKTEST_PERIOD_DAYS * BACKTEST_CANDLES_PER_DAY;
export const BACKTEST_INDICATOR_BUFFER_CANDLES = Math.max(EMA_TREND_PERIOD, EMA_LONG_PERIOD, RSI_PERIOD, MACD_SLOW_PERIOD, BBANDS_PERIOD, ATR_PERIOD, STOCH_K_PERIOD, SMC_LOOKBACK_PERIOD_CANDLES) + STRATEGY_LOOKBACK_CANDLES + 50; 
export const NUM_CANDLES_TO_FETCH_FOR_FULL_BACKTEST = BACKTEST_TOTAL_CANDLES_FOR_PERIOD + BACKTEST_INDICATOR_BUFFER_CANDLES;
export const BINANCE_MAX_KLINE_LIMIT_PER_REQUEST = 1000; 

// Simulação de Capital no Backtest
export const BACKTEST_INITIAL_CAPITAL_BRL = 1000; 
export const BACKTEST_RISK_PER_TRADE_BRL = 25; 

// General Liquidity Context Windows (UTC hours)
export const GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START = 12;
export const GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END = 17;
export const GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START = 23;
export const GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END = 3; 

// Volatility Context (ATR based)
export const ATR_VOLATILITY_AVG_PERIOD = ATR_PERIOD * 2; 
export const VOLATILITY_HIGH_FACTOR = 1.3; 
export const VOLATILITY_LOW_FACTOR = 0.7;  

// False Breakout (Manipulation) Strategy Parameters
export const FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES = 2; 
export const FALSE_BREAKOUT_MIN_BREAK_ATR_FACTOR = 0.20; 
export const FALSE_BREAKOUT_MIN_REVERSAL_BODY_ATR_FACTOR = 0.40; 
export const FALSE_BREAKOUT_SL_ATR_MULTIPLIER = 1.0; 

// Candlestick Pattern Recognition (values remain, usage changes to confluence)
export const REVERSAL_CANDLE_WICK_BODY_RATIO = 1.8; 
export const REVERSAL_CANDLE_MAX_OTHER_WICK_RATIO = 0.3; 
export const PATTERN_BULLISH_ENGULFING = 100;
export const PATTERN_BEARISH_ENGULFING = -100;
export const PATTERN_HAMMER = 150;
export const PATTERN_SHOOTING_STAR = -150;

// REMOVED/SIMPLIFIED Filter Constants:
// export const PRE_US_OPEN_NO_TRADE_WINDOW_UTC_START = 12; 
// export const PRE_US_OPEN_NO_TRADE_WINDOW_UTC_END = 14;   
// export const MIN_CANDLES_BETWEEN_IDENTICAL_SIGNALS = 3;
// export const CONGESTION_BB_WIDTH_ATR_FACTOR_THRESHOLD = 1.2; 
// export const CONGESTION_EMA_SPREAD_ATR_FACTOR_THRESHOLD = 0.6; 
// export const CONGESTION_MIN_ATR_PERCENTILE_THRESHOLD = 10; 
// export const TREND_SLOPE_LOOKBACK = 5; // Kept if EMA trend context is used, but not for hard filtering

// Scanner settings
export const SCAN_UPDATE_INTERVAL_MS = 50;
export const SCANNER_API_DELAY_MS = 250;

// Gemini API Configuration
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';


export const MASTER_ASSET_LIST: Asset[] = [
    { id: 'BTC-USD', name: 'Bitcoin (BTC/USD)', type: AssetType.CRYPTO },
    { id: 'ETH-USD', name: 'Ethereum (ETH/USD)', type: AssetType.CRYPTO },
    { id: 'SOL-USD', name: 'Solana (SOL/USD)', type: AssetType.CRYPTO },
    { id: 'ADA-USD', name: 'Cardano (ADA/USD)', type: AssetType.CRYPTO },
    { id: 'XRP-USD', name: 'Ripple (XRP/USD)', type: AssetType.CRYPTO },
    { id: 'DOT-USD', name: 'Polkadot (DOT/USD)', type: AssetType.CRYPTO },
    { id: 'DOGE-USD', name: 'Dogecoin (DOGE/USD)', type: AssetType.CRYPTO },
    { id: 'AVAX-USD', name: 'Avalanche (AVAX/USD)', type: AssetType.CRYPTO },
    { id: 'LINK-USD', name: 'Chainlink (LINK/USD)', type: AssetType.CRYPTO },
    { id: 'MATIC-USD', name: 'Polygon (MATIC/USD)', type: AssetType.CRYPTO },
    { id: 'LTC-USD', name: 'Litecoin (LTC/USD)', type: AssetType.CRYPTO },
    { id: 'SHIB-USD', name: 'Shiba Inu (SHIB/USD)', type: AssetType.CRYPTO },
    { id: 'TRX-USD', name: 'TRON (TRX/USD)', type: AssetType.CRYPTO },
    { id: 'UNI-USD', name: 'Uniswap (UNI/USD)', type: AssetType.CRYPTO },
    { id: 'BCH-USD', name: 'Bitcoin Cash (BCH/USD)', type: AssetType.CRYPTO },
    { id: 'XLM-USD', name: 'Stellar (XLM/USD)', type: AssetType.CRYPTO },
    { id: 'NEAR-USD', name: 'Near Protocol (NEAR/USD)', type: AssetType.CRYPTO },
    { id: 'FIL-USD', name: 'Filecoin (FIL/USD)', type: AssetType.CRYPTO },
    { id: 'ICP-USD', name: 'Internet Computer (ICP/USD)', type: AssetType.CRYPTO },
    { id: 'APT-USD', name: 'Aptos (APT/USD)', type: AssetType.CRYPTO },
    { id: 'ARB-USD', name: 'Arbitrum (ARB/USD)', type: AssetType.CRYPTO },
    { id: 'OP-USD', name: 'Optimism (OP/USD)', type: AssetType.CRYPTO },
    { id: 'TON-USD', name: 'Toncoin (TON/USD)', type: AssetType.CRYPTO },
    { id: 'ATOM-USD', name: 'Cosmos (ATOM/USD)', type: AssetType.CRYPTO },
    { id: 'ETC-USD', name: 'Ethereum Classic (ETC/USD)', type: AssetType.CRYPTO },
    { id: 'VET-USD', name: 'VeChain (VET/USD)', type: AssetType.CRYPTO },
    { id: 'HBAR-USD', name: 'Hedera (HBAR/USD)', type: AssetType.CRYPTO },
    { id: 'ALGO-USD', name: 'Algorand (ALGO/USD)', type: AssetType.CRYPTO },
    { id: 'XTZ-USD', name: 'Tezos (XTZ/USD)', type: AssetType.CRYPTO },
    { id: 'SAND-USD', name: 'The Sandbox (SAND/USD)', type: AssetType.CRYPTO },
];

export const DEFAULT_ASSET_ID = 'BTC-USD';
