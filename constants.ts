
import { Asset, AssetType } from './types';

// Timeframe M15
export const CANDLE_DURATION_MINUTES = 15;

// Períodos dos Indicadores para Estratégia M15 (EMA-based)
export const EMA_SHORT_PERIOD = 9;
export const EMA_LONG_PERIOD = 21;

export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70; // General OB level for context, strategy uses specific max/min
export const RSI_OVERSOLD = 30;   // General OS level for context, strategy uses specific max/min

export const MACD_FAST_PERIOD = 12; // Kept for general context
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;
export const BBANDS_PERIOD = 20;    // Kept for general context
export const BBANDS_STDDEV = 2;
export const ATR_PERIOD = 14;
export const STOCH_K_PERIOD = 14;   // Kept for general context
export const STOCH_D_PERIOD = 3;
export const STOCH_SMOOTH_K = 3;
export const VOLUME_SMA_PERIOD = 20;

// Configurações da Estratégia M15 EMA Crossover & Pullback
export const STRATEGY_LOOKBACK_CANDLES = 10; // How many recent candles to check for crossover and setup
export const STRATEGY_EMA_CROSSOVER_LOOKBACK = 3; // How many candles back to check for an EMA cross
export const STRATEGY_PULLBACK_MAX_DEPTH_FACTOR = 0.5; // How far price can dip below shortEMA during pullback (factor of ATR)
export const STRATEGY_RSI_CONFIRM_BUY_MIN = 45; // RSI must be above this for a buy (momentum)
export const STRATEGY_RSI_CONFIRM_BUY_MAX = 75; // RSI must be below this for a buy (not too OB)
export const STRATEGY_RSI_CONFIRM_SELL_MAX = 55; // RSI must be below this for a sell (momentum)
export const STRATEGY_RSI_CONFIRM_SELL_MIN = 25; // RSI must be above this for a sell (not too OS)
export const STRATEGY_SL_ATR_MULTIPLIER = 1.5; // Stop Loss = X * ATR
export const STRATEGY_RR_RATIO = 1.5; // Take Profit = Risk * X
export const STRATEGY_VOLUME_CONFIRMATION_RATIO = 1.2; // Volume should be X times SMA for stronger confirmation

// Configurações SMC/ICT (mantidas para análise complementar, mas não primárias para sinal)
export const SMC_LOOKBACK_PERIOD_CANDLES = 30;
export const SMC_FVG_MIN_ATR_FACTOR = 0.3;

// Busca e exibição de dados
export const NUM_CANDLES_TO_FETCH = 300;
export const NUM_CANDLES_TO_DISPLAY = 150;

export const VOLUME_SPIKE_RATIO = 1.8; // General volume spike, strategy might use specific one

// Configurações de Backtest
export const MIN_CANDLES_FOR_BACKTEST_SIGNAL_GENERATION = EMA_LONG_PERIOD + STRATEGY_LOOKBACK_CANDLES + 5;
export const BACKTEST_SIGNAL_OFFSET_CANDLES = 30;
export const BACKTEST_LOOKFORWARD_PERIOD_CANDLES = 15;

// Scanner settings
export const SCAN_UPDATE_INTERVAL_MS = 50; // Interval for UI updates during scan

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