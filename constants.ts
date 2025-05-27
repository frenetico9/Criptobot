
import { Asset, AssetType } from './types';

// Timeframe M5
export const CANDLE_DURATION_MINUTES = 5;

// General Trend Context (EMA-based) - Kept for context, not primary signal
export const EMA_TREND_PERIOD = 50; 

// General Technical Indicators (can be used as confluence or context)
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


// SMC/ICT Strategy Configuration
export const SMC_MARKET_STRUCTURE_LOOKBACK = 50; // Candles to look back for swing points for BOS/CHoCH
export const SMC_FRACTAL_SWING_POINTS_PERIOD = 2; // N-bar fractal (N candles left, N candles right for high/low)
export const SMC_IDM_LOOKBACK = 15; // Candles to look back for inducement after MSS/CHoCH
export const SMC_POI_FVG_MIN_ATR_FACTOR = 0.15; 
export const SMC_POI_ORDER_BLOCK_IMBALANCE_MIN_FACTOR = 0.1; 
export const SMC_SL_ATR_MULTIPLIER = 1.0; 
export const SMC_SL_BUFFER_PIPS_FACTOR = 0.0005; 
export const SMC_STRATEGY_MIN_RR_RATIO = 2.0; 
export const SMC_MAX_DISTANCE_IDM_TO_POI_ATR_FACTOR = 5; 

// Killzones (UTC Times)
export const LONDON_KILLZONE_UTC_START = 7;  
export const LONDON_KILLZONE_UTC_END = 10;   
export const NEWYORK_KILLZONE_UTC_START = 12; 
export const NEWYORK_KILLZONE_UTC_END = 15;   

// Candlestick Pattern Recognition
export const REVERSAL_CANDLE_WICK_BODY_RATIO = 1.8; 
export const REVERSAL_CANDLE_MAX_OTHER_WICK_RATIO = 0.3; 
export const PATTERN_BULLISH_ENGULFING = 100;
export const PATTERN_BEARISH_ENGULFING = -100;
export const PATTERN_HAMMER = 150;
export const PATTERN_SHOOTING_STAR = -150;

// Data fetching and display - Adjusted for M5 if needed
export const NUM_CANDLES_TO_FETCH = 300; // For M5: 300*5 = 1500 mins (~1 day) - Check if sufficient for M5 context
export const NUM_CANDLES_TO_DISPLAY = 150; // For M5: 150*5 = 750 mins (~0.5 day)

// Volume Context
export const VOLUME_SPIKE_RATIO = 1.8; 

// Backtest Settings
export const BACKTEST_PERIOD_DAYS = 30; 
export const BACKTEST_CANDLES_PER_DAY = (24 * 60) / CANDLE_DURATION_MINUTES; // Now uses M5
export const BACKTEST_TOTAL_CANDLES_FOR_PERIOD = BACKTEST_PERIOD_DAYS * BACKTEST_CANDLES_PER_DAY;
export const BACKTEST_INDICATOR_BUFFER_CANDLES = Math.max(EMA_TREND_PERIOD, SMC_MARKET_STRUCTURE_LOOKBACK, ATR_PERIOD) + SMC_IDM_LOOKBACK + 50; 
export const NUM_CANDLES_TO_FETCH_FOR_FULL_BACKTEST = BACKTEST_TOTAL_CANDLES_FOR_PERIOD + BACKTEST_INDICATOR_BUFFER_CANDLES;
export const BINANCE_MAX_KLINE_LIMIT_PER_REQUEST = 1000; 

// Capital Simulation for Backtest
export const BACKTEST_INITIAL_CAPITAL_BRL = 1000; 
export const BACKTEST_RISK_PER_TRADE_BRL = 25; 
export const CONSECUTIVE_BUY_LOSS_SL_THRESHOLD = 3; // Avoid N+ consecutive BUY/LOSS/SL_HIT trades

// General Liquidity Windows (UTC)
export const GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START = 12;
export const GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END = 17;
export const GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START = 0; 
export const GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END = 8; 

// Volatility Context (ATR based)
export const ATR_VOLATILITY_AVG_PERIOD = ATR_PERIOD * 2; 
export const VOLATILITY_HIGH_FACTOR = 1.3; 
export const VOLATILITY_LOW_FACTOR = 0.7;  

// Scanner settings
export const SCAN_UPDATE_INTERVAL_MS = 50;
export const SCANNER_API_DELAY_MS = 250;

// Gemini API Configuration
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';


export const MASTER_ASSET_LIST: Asset[] = [
    // From original list (constants-1.ts base) - 30 assets
    { id: 'BTC-USD', name: 'Bitcoin (BTC/USD)', type: AssetType.CRYPTO },
    { id: 'ETH-USD', name: 'Ethereum (ETH/USD)', type: AssetType.CRYPTO },
    { id: 'SOL-USD', name: 'Solana (SOL/USD)', type: AssetType.CRYPTO },
    { id: 'ADA-USD', name: 'Cardano (ADA/USD)', type: AssetType.CRYPTO }, // Kept by user
    { id: 'XRP-USD', name: 'Ripple (XRP/USD)', type: AssetType.CRYPTO },   // Kept by user
    { id: 'DOT-USD', name: 'Polkadot (DOT/USD)', type: AssetType.CRYPTO },
    { id: 'DOGE-USD', name: 'Dogecoin (DOGE/USD)', type: AssetType.CRYPTO }, // Kept by user
    { id: 'AVAX-USD', name: 'Avalanche (AVAX/USD)', type: AssetType.CRYPTO },
    { id: 'LINK-USD', name: 'Chainlink (LINK/USD)', type: AssetType.CRYPTO },
    { id: 'MATIC-USD', name: 'Polygon (MATIC/USD)', type: AssetType.CRYPTO },
    { id: 'LTC-USD', name: 'Litecoin (LTC/USD)', type: AssetType.CRYPTO },
    { id: 'SHIB-USD', name: 'Shiba Inu (SHIB/USD)', type: AssetType.CRYPTO }, // Memecoin, kept
    { id: 'TRX-USD', name: 'TRON (TRX/USD)', type: AssetType.CRYPTO },
    { id: 'UNI-USD', name: 'Uniswap (UNI/USD)', type: AssetType.CRYPTO },
    { id: 'BCH-USD', name: 'Bitcoin Cash (BCH/USD)', type: AssetType.CRYPTO },
    { id: 'XLM-USD', name: 'Stellar (XLM/USD)', type: AssetType.CRYPTO },
    { id: 'NEAR-USD', name: 'Near Protocol (NEAR/USD)', type: AssetType.CRYPTO }, // Kept by user
    { id: 'FIL-USD', name: 'Filecoin (FIL/USD)', type: AssetType.CRYPTO },
    { id: 'ICP-USD', name: 'Internet Computer (ICP/USD)', type: AssetType.CRYPTO }, // Kept by user
    { id: 'APT-USD', name: 'Aptos (APT/USD)', type: AssetType.CRYPTO },
    { id: 'ARB-USD', name: 'Arbitrum (ARB/USD)', type: AssetType.CRYPTO },
    { id: 'OP-USD', name: 'Optimism (OP/USD)', type: AssetType.CRYPTO },
    { id: 'TON-USD', name: 'Toncoin (TON/USD)', type: AssetType.CRYPTO },
    { id: 'ATOM-USD', name: 'Cosmos (ATOM/USD)', type: AssetType.CRYPTO },     // Kept by user
    { id: 'ETC-USD', name: 'Ethereum Classic (ETC/USD)', type: AssetType.CRYPTO },
    { id: 'VET-USD', name: 'VeChain (VET/USD)', type: AssetType.CRYPTO },
    { id: 'HBAR-USD', name: 'Hedera (HBAR/USD)', type: AssetType.CRYPTO },
    { id: 'ALGO-USD', name: 'Algorand (ALGO/USD)', type: AssetType.CRYPTO }, // Kept by user
    { id: 'XTZ-USD', name: 'Tezos (XTZ/USD)', type: AssetType.CRYPTO },
    { id: 'SAND-USD', name: 'The Sandbox (SAND/USD)', type: AssetType.CRYPTO }, // Kept by user

    // Additional Memecoins (7 new ones, SHIB already included above)
    { id: 'PEPE-USD', name: 'Pepe (PEPE/USD)', type: AssetType.CRYPTO },
    { id: 'WIF-USD', name: 'dogwifhat (WIF/USD)', type: AssetType.CRYPTO },
    { id: 'BONK-USD', name: 'Bonk (BONK/USD)', type: AssetType.CRYPTO },
    { id: 'FLOKI-USD', name: 'Floki (FLOKI/USD)', type: AssetType.CRYPTO },
    { id: 'MEME-USD', name: 'Memecoin (MEME/USD)', type: AssetType.CRYPTO },
    { id: 'BOME-USD', name: 'Book of Meme (BOME/USD)', type: AssetType.CRYPTO },
    { id: 'TURBO-USD', name: 'Turbo (TURBO/USD)', type: AssetType.CRYPTO },
];

export const DEFAULT_ASSET_ID = 'BTC-USD';

// Default value for old EMA short/long if needed for chart display, not for strategy
export const EMA_SHORT_PERIOD_DISPLAY = 9;
export const EMA_LONG_PERIOD_DISPLAY = 21;