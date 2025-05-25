
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AssetSelector from './components/AssetSelector';
import ChartDisplay from './components/ChartDisplay';
import AnalysisPanel from './components/AnalysisPanel';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { SunIcon, MoonIcon, CogIcon, ChartBarIcon, PlayCircleIcon, BeakerIcon, ListBulletIcon } from './components/icons'; 
import {
  Candle, TechnicalIndicators, SmcAnalysis,
  TradeSignal, TradeSignalType, AnalysisReport, Asset, ChartDatapoint, AssetType, SignalConfidence,
  StrategyBacktestResult, BacktestTrade
} from './types';
import {
  MASTER_ASSET_LIST, DEFAULT_ASSET_ID,
  SCANNER_API_DELAY_MS, SCAN_UPDATE_INTERVAL_MS,
  EMA_SHORT_PERIOD, EMA_LONG_PERIOD, EMA_TREND_PERIOD, STRATEGY_LOOKBACK_CANDLES,
  STRATEGY_EMA_CROSSOVER_LOOKBACK, STRATEGY_PULLBACK_MAX_DEPTH_FACTOR,
  STRATEGY_RSI_CONFIRM_BUY_MIN, STRATEGY_RSI_CONFIRM_BUY_MAX,
  STRATEGY_RSI_CONFIRM_SELL_MAX, STRATEGY_RSI_CONFIRM_SELL_MIN,
  STRATEGY_SL_ATR_MULTIPLIER, STRATEGY_RR_RATIO, STRATEGY_VOLUME_CONFIRMATION_RATIO,
  STRATEGY_MIN_CONFLUENCES_FOR_STRONG_SIGNAL, ATR_PERIOD, SMC_LOOKBACK_PERIOD_CANDLES,
  NUM_CANDLES_TO_FETCH_FOR_FULL_BACKTEST, BACKTEST_PERIOD_DAYS, // Will use 30 days from constants
  BACKTEST_INDICATOR_BUFFER_CANDLES,
  GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START, GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END,
  GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START, GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END,
  ATR_VOLATILITY_AVG_PERIOD, VOLATILITY_HIGH_FACTOR, VOLATILITY_LOW_FACTOR,
  FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES, FALSE_BREAKOUT_MIN_BREAK_ATR_FACTOR,
  FALSE_BREAKOUT_MIN_REVERSAL_BODY_ATR_FACTOR, FALSE_BREAKOUT_SL_ATR_MULTIPLIER,
  BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL,
  CANDLE_DURATION_MINUTES, 
  PATTERN_HAMMER, PATTERN_SHOOTING_STAR, PATTERN_BULLISH_ENGULFING, PATTERN_BEARISH_ENGULFING,
  BBANDS_PERIOD
  // Removed: PRE_US_OPEN_NO_TRADE_WINDOW_UTC_START, PRE_US_OPEN_NO_TRADE_WINDOW_UTC_END,
  // Removed: MIN_CANDLES_BETWEEN_IDENTICAL_SIGNALS,
  // Removed: CONGESTION_BB_WIDTH_ATR_FACTOR_THRESHOLD, CONGESTION_EMA_SPREAD_ATR_FACTOR_THRESHOLD, TREND_SLOPE_LOOKBACK
} from './constants';
import { fetchHistoricalData } from './services/marketDataService';
import { calculateAllIndicators } from './services/technicalAnalysisService';
import { analyzeSMC } from './services/smcIctService';
import { generateMultiAssetBacktestPdfReport } from './services/pdfGenerator';


const getGeneralLiquidityContext = (candleDate: string): string => {
  const date = new Date(candleDate);
  const utcHour = date.getUTCHours();

  if (utcHour >= GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START && utcHour < GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END) {
    return "Contexto Sessão Global: ALTA (Europa/EUA)";
  }
  if ((utcHour >= GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START && utcHour <= 23) || (utcHour >= 0 && utcHour < GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END)) {
    return "Contexto Sessão Global: ALTA (Asiática)";
  }
  return "Contexto Sessão Global: BAIXA (Fora das sessões principais)";
};

const getVolatilityContext = (currentAtr: number | undefined, atrSeries: (number | undefined)[] | undefined): string => {
  if (currentAtr === undefined || !atrSeries || atrSeries.length < ATR_VOLATILITY_AVG_PERIOD) {
    return "Contexto Volatilidade: N/D (dados insuficientes)";
  }

  const recentAtrValues = atrSeries.slice(-ATR_VOLATILITY_AVG_PERIOD).filter(val => val !== undefined) as number[];
  if (recentAtrValues.length < ATR_VOLATILITY_AVG_PERIOD / 2) {
      return "Contexto Volatilidade: N/D (poucos valores ATR recentes)";
  }

  const avgAtr = recentAtrValues.reduce((sum, val) => sum + val, 0) / recentAtrValues.length;

  if (currentAtr > avgAtr * VOLATILITY_HIGH_FACTOR) {
    return `Contexto Volatilidade: ALTA (ATR ${currentAtr.toFixed(4)} vs Média ${avgAtr.toFixed(4)})`;
  }
  if (currentAtr < avgAtr * VOLATILITY_LOW_FACTOR) {
    return `Contexto Volatilidade: BAIXA (ATR ${currentAtr.toFixed(4)} vs Média ${avgAtr.toFixed(4)})`;
  }
  return `Contexto Volatilidade: MÉDIA (ATR ${currentAtr.toFixed(4)} vs Média ${avgAtr.toFixed(4)})`;
};

interface FalseBreakoutSignal {
    type: 'COMPRA_FORTE' | 'VENDA_FORTE';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    details: string[];
    justification: string;
    levelsSource: string;
}

// Simplified: Congestion check removed as a hard filter. Can be a detail if extreme.
// const isMarketCongested = ... ; // Removed for now

const getTrendContext = (currentCandleClose: number, emaTrendCurrent: number | undefined, emaTrendSeries: (number | undefined)[] | undefined, currentIdx: number, trendLookback: number = 5): string => {
    if (emaTrendCurrent === undefined || !emaTrendSeries || currentIdx < trendLookback || emaTrendSeries[currentIdx - trendLookback] === undefined) {
        return "Contexto Tendência (MME50): N/D (dados insuficientes)";
    }
    const emaTrendPrevious = emaTrendSeries[currentIdx - trendLookback]!;
    let trendDescription = "";
    if (currentCandleClose > emaTrendCurrent) trendDescription += "Preço > MME50";
    else if (currentCandleClose < emaTrendCurrent) trendDescription += "Preço < MME50";
    else trendDescription += "Preço na MME50";

    if (emaTrendCurrent > emaTrendPrevious) trendDescription += " & MME50 Inclinada para Cima";
    else if (emaTrendCurrent < emaTrendPrevious) trendDescription += " & MME50 Inclinada para Baixo";
    else trendDescription += " & MME50 Lateral";
    
    return `Contexto Tendência (MME50): ${trendDescription}`;
};


const checkForFalseBreakoutSignal = (
    candles: Candle[],
    indicators: TechnicalIndicators,
    smc: SmcAnalysis,
    currentIdx: number
): FalseBreakoutSignal | null => {
    if (currentIdx < Math.max(FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES, EMA_TREND_PERIOD) || !smc.recentSwingHigh || !smc.recentSwingLow) { // Ensure EMA Trend has data
        return null;
    }

    const reversalCandle = candles[currentIdx];
    const currentAtr = indicators.atr?.[currentIdx];
    const currentEngulfing = indicators.engulfing?.[currentIdx];
    const currentEmaTrend = indicators.emaTrend?.[currentIdx];


    if (!currentAtr || currentEmaTrend === undefined) return null;

    let signal: FalseBreakoutSignal | null = null;
    
    const trendContext = getTrendContext(reversalCandle.close, currentEmaTrend, indicators.emaTrend, currentIdx);

    const supportLevel = smc.recentSwingLow;
    if (supportLevel) { 
        for (let i = 1; i <= FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES; i++) {
            const breakoutCandleIdx = currentIdx - i;
            if (breakoutCandleIdx < 0) continue;
            const breakoutCandle = candles[breakoutCandleIdx];
            const breakoutAtr = indicators.atr?.[breakoutCandleIdx] || currentAtr;

            const brokeSupport = breakoutCandle.low < supportLevel && 
                                 (supportLevel - breakoutCandle.low) > breakoutAtr * FALSE_BREAKOUT_MIN_BREAK_ATR_FACTOR;

            if (brokeSupport) {
                const isBullishReversalCandle = reversalCandle.close > reversalCandle.open;
                const strongReversalBody = (reversalCandle.close - reversalCandle.open) > currentAtr * FALSE_BREAKOUT_MIN_REVERSAL_BODY_ATR_FACTOR;
                const closedAboveSupport = reversalCandle.close > supportLevel;
                // Candlestick pattern is now a confluence, not a hard filter here
                const isConfirmingPattern = currentEngulfing === PATTERN_HAMMER || currentEngulfing === PATTERN_BULLISH_ENGULFING;

                if (isBullishReversalCandle && strongReversalBody && closedAboveSupport) { // Main conditions for FB
                    const entry = reversalCandle.close;
                    const stopLoss = reversalCandle.low - currentAtr * FALSE_BREAKOUT_SL_ATR_MULTIPLIER;
                    const takeProfit = entry + (entry - stopLoss) * STRATEGY_RR_RATIO;
                    const details = [
                        `Manipulação (Falso Rompimento) de Suporte em ${supportLevel.toFixed(4)}.`,
                        `Rompimento na vela de ${new Date(breakoutCandle.date).toLocaleTimeString('pt-BR')}.`,
                        `Reversão de Alta na vela atual ${new Date(reversalCandle.date).toLocaleTimeString('pt-BR')}.`,
                        trendContext // Add trend context
                    ];
                    if (isConfirmingPattern) {
                        details.push(`Confirmação Candlestick: ${currentEngulfing === PATTERN_HAMMER ? 'Martelo' : 'Engolfo de Alta'}.`);
                    }
                    signal = {
                        type: 'COMPRA_FORTE', // False breakouts are generally considered strong
                        entry, stopLoss, takeProfit,
                        details,
                        justification: "Detectado padrão de manipulação com falso rompimento de suporte e forte reversão de alta.",
                        levelsSource: "Estratégia de Falso Rompimento (Manipulação)",
                    };
                    break; 
                }
            }
        }
    }

    if (signal) return signal; // Prioritize buy signal if found

    const resistanceLevel = smc.recentSwingHigh;
    if (resistanceLevel) { 
        for (let i = 1; i <= FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES; i++) {
            const breakoutCandleIdx = currentIdx - i;
            if (breakoutCandleIdx < 0) continue;
            const breakoutCandle = candles[breakoutCandleIdx];
            const breakoutAtr = indicators.atr?.[breakoutCandleIdx] || currentAtr;

            const brokeResistance = breakoutCandle.high > resistanceLevel &&
                                    (breakoutCandle.high - resistanceLevel) > breakoutAtr * FALSE_BREAKOUT_MIN_BREAK_ATR_FACTOR;
            
            if (brokeResistance) {
                const isBearishReversalCandle = reversalCandle.close < reversalCandle.open;
                const strongReversalBody = (reversalCandle.open - reversalCandle.close) > currentAtr * FALSE_BREAKOUT_MIN_REVERSAL_BODY_ATR_FACTOR;
                const closedBelowResistance = reversalCandle.close < resistanceLevel;
                const isConfirmingPattern = currentEngulfing === PATTERN_SHOOTING_STAR || currentEngulfing === PATTERN_BEARISH_ENGULFING;

                if (isBearishReversalCandle && strongReversalBody && closedBelowResistance) { // Main conditions for FB
                    const entry = reversalCandle.close;
                    const stopLoss = reversalCandle.high + currentAtr * FALSE_BREAKOUT_SL_ATR_MULTIPLIER;
                    const takeProfit = entry - (stopLoss - entry) * STRATEGY_RR_RATIO;
                    const details = [
                        `Manipulação (Falso Rompimento) de Resistência em ${resistanceLevel.toFixed(4)}.`,
                        `Rompimento na vela de ${new Date(breakoutCandle.date).toLocaleTimeString('pt-BR')}.`,
                        `Reversão de Baixa na vela atual ${new Date(reversalCandle.date).toLocaleTimeString('pt-BR')}.`,
                        trendContext // Add trend context
                    ];
                    if (isConfirmingPattern) {
                         details.push(`Confirmação Candlestick: ${currentEngulfing === PATTERN_SHOOTING_STAR ? 'Estrela Cadente' : 'Engolfo de Baixa'}.`);
                    }
                     signal = {
                        type: 'VENDA_FORTE', // False breakouts are generally considered strong
                        entry, stopLoss, takeProfit,
                        details,
                        justification: "Detectado padrão de manipulação com falso rompimento de resistência e forte reversão de baixa.",
                        levelsSource: "Estratégia de Falso Rompimento (Manipulação)",
                    };
                    break; 
                }
            }
        }
    }
    return signal;
};

const App: React.FC = () => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(DEFAULT_ASSET_ID);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [chartData, setChartData] = useState<ChartDatapoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPerformingBacktest, setIsPerformingBacktest] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<string>("");
  const scannerStopFlag = useRef<boolean>(false);

  const [isPerformingMultiBacktest, setIsPerformingMultiBacktest] = useState<boolean>(false);
  const [multiBacktestProgress, setMultiBacktestProgress] = useState<string>("");
  const [allAssetsBacktestResults, setAllAssetsBacktestResults] = useState<StrategyBacktestResult[]>([]);


  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) return storedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; 
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-mode-bg');
      document.body.classList.remove('light-mode-bg');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light-mode-bg');
      document.body.classList.remove('dark-mode-bg');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isDarkMode) {
        document.body.classList.add('dark-mode-bg');
        document.body.classList.remove('light-mode-bg');
    } else {
        document.body.classList.add('light-mode-bg');
        document.body.classList.remove('dark-mode-bg');
    }
  }, []); 

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const getSelectedAsset = (assetIdToGet?: string): Asset | undefined => MASTER_ASSET_LIST.find(a => a.id === (assetIdToGet || selectedAssetId));

  const processSignalLogic = (
    historicalCandles: Candle[],
    fullIndicators: TechnicalIndicators,
    smc: SmcAnalysis,
    isBacktest: boolean = false 
  ): TradeSignal => {
    const details: string[] = [];
    let justifications: string[] = [];
    let signalType: TradeSignalType = 'NEUTRO';
    let entry: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    let levelsSource: string | undefined;
    let confidenceScoreValue: SignalConfidence = 'BAIXA';
    
    const numCandles = historicalCandles.length;
    if (numCandles < Math.max(EMA_TREND_PERIOD, BBANDS_PERIOD, ATR_VOLATILITY_AVG_PERIOD, FALSE_BREAKOUT_REVERSAL_WINDOW_CANDLES +1, SMC_LOOKBACK_PERIOD_CANDLES)) {
        justifications.push("Dados históricos insuficientes para aplicar estratégias e contexto.");
        return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
    }

    const currentIdx = numCandles - 1;
    const currentCandle = historicalCandles[currentIdx];
    
    details.push(getGeneralLiquidityContext(currentCandle.date));
    details.push(getVolatilityContext(fullIndicators.atr?.[currentIdx], fullIndicators.atr));
    details.push(getTrendContext(currentCandle.close, fullIndicators.emaTrend?.[currentIdx], fullIndicators.emaTrend, currentIdx));

    // Removed: Pre-US open window filter
    // Removed: Congestion filter as a hard filter

    const falseBreakoutSignal = checkForFalseBreakoutSignal(historicalCandles, fullIndicators, smc, currentIdx);

    if (falseBreakoutSignal) { 
        signalType = falseBreakoutSignal.type;
        entry = falseBreakoutSignal.entry;
        stopLoss = falseBreakoutSignal.stopLoss;
        takeProfit = falseBreakoutSignal.takeProfit;
        details.push(...falseBreakoutSignal.details); // FB details already include trend context
        justifications.push(falseBreakoutSignal.justification);
        levelsSource = falseBreakoutSignal.levelsSource;
        confidenceScoreValue = 'ALTA'; // False breakouts are strong
    } else { 
        // EMA Crossover/Pullback Strategy (simplified filter approach)
        let technicalConfluenceCount = 0;
        const emaShort = fullIndicators.emaShort;
        const emaLong = fullIndicators.emaLong;
        // emaTrend already fetched for context
        const rsi = fullIndicators.rsi;
        const atr = fullIndicators.atr;
        const volume = historicalCandles.map(c => c.volume); 
        const volumeSma = fullIndicators.volumeSma;
        const engulfingPattern = fullIndicators.engulfing?.[currentIdx];
        const bbUpper = fullIndicators.bbUpper?.[currentIdx];
        const bbMiddle = fullIndicators.bbMiddle?.[currentIdx];
        const bbLower = fullIndicators.bbLower?.[currentIdx];

        if (!emaShort || !emaLong || !rsi || !atr || !volumeSma || engulfingPattern === undefined || !bbUpper || !bbMiddle || !bbLower) {
            justifications.push("Indicadores técnicos essenciais (MMES, IFR, ATR, VolSMA, BB, Padrões Vela) não disponíveis.");
            return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
        }
        
        const currentEmaShort = emaShort[currentIdx];
        const currentEmaLong = emaLong[currentIdx];
        const currentRsi = rsi[currentIdx];
        const currentAtrVal = atr[currentIdx];
        const currentVolume = volume[currentIdx];
        const currentVolumeSma = volumeSma[currentIdx];

        if ([currentEmaShort, currentEmaLong, currentRsi, currentAtrVal, currentVolumeSma].some(val => val === undefined)) {
            justifications.push("Valores de indicadores MME/IFR/ATR/VolSMA atuais ausentes.");
            return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
        }

        let isBullishCrossover = false;
        let isBearishCrossover = false;
        let crossoverCandleIdx = -1;

        for (let i = 1; i <= STRATEGY_EMA_CROSSOVER_LOOKBACK; i++) {
            const checkIdx = currentIdx - i;
            if (checkIdx < 1) break; 
            const prevEmaShort = emaShort[checkIdx -1];
            const prevEmaLong = emaLong[checkIdx-1];
            const atCheckEmaShort = emaShort[checkIdx];
            const atCheckEmaLong = emaLong[checkIdx];

            if (prevEmaShort !== undefined && prevEmaLong !== undefined && atCheckEmaShort !== undefined && atCheckEmaLong !== undefined) {
                if (prevEmaShort <= prevEmaLong && atCheckEmaShort > atCheckEmaLong) {
                    isBullishCrossover = true;
                    crossoverCandleIdx = checkIdx;
                    details.push(`Cruzamento MME Alta ${i} vela(s) atrás.`);
                    technicalConfluenceCount++;
                    break;
                }
                if (prevEmaShort >= prevEmaLong && atCheckEmaShort < atCheckEmaLong) {
                    isBearishCrossover = true;
                    crossoverCandleIdx = checkIdx;
                    details.push(`Cruzamento MME Baixa ${i} vela(s) atrás.`);
                    technicalConfluenceCount++;
                    break;
                }
            }
        }
        
        // Trend context is in `details`. Here, we ensure the signal aligns with current MME positions.
        if (isBullishCrossover && currentEmaShort! > currentEmaLong!) {
            details.push(`MME${EMA_SHORT_PERIOD} (${currentEmaShort!.toFixed(4)}) > MME${EMA_LONG_PERIOD} (${currentEmaLong!.toFixed(4)})`);
            const inPullbackZone = currentCandle.low <= currentEmaShort! && currentCandle.close >= Math.min(currentEmaShort!, currentEmaLong!);
            const allowedDip = currentAtrVal! * STRATEGY_PULLBACK_MAX_DEPTH_FACTOR;
            const deepPullbackOk = currentCandle.low <= currentEmaShort! + allowedDip && currentCandle.close >= currentEmaShort! - allowedDip;

            if (inPullbackZone || deepPullbackOk) {
                details.push(`Pullback para zona MME (Mínima: ${currentCandle.low.toFixed(4)}, MME Curta: ${currentEmaShort!.toFixed(4)})`);
                technicalConfluenceCount++;

                if (currentRsi! >= STRATEGY_RSI_CONFIRM_BUY_MIN && currentRsi! <= STRATEGY_RSI_CONFIRM_BUY_MAX) {
                    details.push(`IFR (${currentRsi!.toFixed(1)}) entre ${STRATEGY_RSI_CONFIRM_BUY_MIN}-${STRATEGY_RSI_CONFIRM_BUY_MAX}`);
                    technicalConfluenceCount++;
                    
                    const isReversalPattern = engulfingPattern === PATTERN_BULLISH_ENGULFING || engulfingPattern === PATTERN_HAMMER;
                    if (currentCandle.close > currentCandle.open && currentCandle.close > currentEmaShort!) { // Basic bullish confirmation
                        signalType = 'COMPRA'; // Base signal
                        if (isReversalPattern) {
                           details.push(`Padrão Candlestick: ${engulfingPattern === PATTERN_HAMMER ? 'Martelo' : 'Engolfo de Alta'}.`);
                           technicalConfluenceCount++;
                        }
                        entry = currentCandle.close;
                        stopLoss = currentCandle.low - currentAtrVal! * STRATEGY_SL_ATR_MULTIPLIER;
                        const pullbackLow = Math.min(...historicalCandles.slice(crossoverCandleIdx > 0 ? crossoverCandleIdx : Math.max(0, currentIdx - STRATEGY_LOOKBACK_CANDLES), currentIdx + 1).map(c => c.low));
                        stopLoss = Math.min(stopLoss, pullbackLow - currentAtrVal! * 0.25, currentEmaLong! - currentAtrVal! * 0.5);
                        takeProfit = entry + (entry - stopLoss) * STRATEGY_RR_RATIO;
                        levelsSource = `MME Crossover Alta + Pullback. SL abaixo da mínima do pullback/vela/MME Longa.`;

                        if (currentVolume! > currentVolumeSma! * STRATEGY_VOLUME_CONFIRMATION_RATIO) {
                            details.push(`Volume de confirmação (${(currentVolume!/currentVolumeSma!).toFixed(1)}x SMA)`);
                            technicalConfluenceCount++;
                        }
                        if (currentCandle.low <= bbLower! && currentCandle.close > bbMiddle!) {
                            details.push("Contexto BB: Toque BB Inferior com reversão acima da Média.");
                            technicalConfluenceCount++;
                        }
                        if (technicalConfluenceCount >= STRATEGY_MIN_CONFLUENCES_FOR_STRONG_SIGNAL + 2) { // +2 for base crossover and pullback
                             signalType = 'COMPRA_FORTE';
                        }
                    }
                } else {
                     details.push(`IFR (${currentRsi!.toFixed(1)}) fora da faixa de compra (${STRATEGY_RSI_CONFIRM_BUY_MIN}-${STRATEGY_RSI_CONFIRM_BUY_MAX})`);
                }
            }
        } else if (isBearishCrossover && currentEmaShort! < currentEmaLong!) {
            details.push(`MME${EMA_SHORT_PERIOD} (${currentEmaShort!.toFixed(4)}) < MME${EMA_LONG_PERIOD} (${currentEmaLong!.toFixed(4)})`);
            const inPullbackZone = currentCandle.high >= currentEmaShort! && currentCandle.close <= Math.max(currentEmaShort!, currentEmaLong!);
            const allowedRise = currentAtrVal! * STRATEGY_PULLBACK_MAX_DEPTH_FACTOR;
            const deepPullbackOk = currentCandle.high >= currentEmaShort! - allowedRise && currentCandle.close <= currentEmaShort! + allowedRise;

            if (inPullbackZone || deepPullbackOk) {
                details.push(`Pullback para zona MME (Máxima: ${currentCandle.high.toFixed(4)}, MME Curta: ${currentEmaShort!.toFixed(4)})`);
                 technicalConfluenceCount++;

                if (currentRsi! <= STRATEGY_RSI_CONFIRM_SELL_MAX && currentRsi! >= STRATEGY_RSI_CONFIRM_SELL_MIN) {
                    details.push(`IFR (${currentRsi!.toFixed(1)}) entre ${STRATEGY_RSI_CONFIRM_SELL_MIN}-${STRATEGY_RSI_CONFIRM_SELL_MAX}`);
                    technicalConfluenceCount++;

                    const isReversalPattern = engulfingPattern === PATTERN_BEARISH_ENGULFING || engulfingPattern === PATTERN_SHOOTING_STAR;
                    if (currentCandle.close < currentCandle.open && currentCandle.close < currentEmaShort!) { // Basic bearish confirmation
                        signalType = 'VENDA'; // Base signal
                        if (isReversalPattern) {
                            details.push(`Padrão Candlestick: ${engulfingPattern === PATTERN_SHOOTING_STAR ? 'Estrela Cadente' : 'Engolfo de Baixa'}.`);
                            technicalConfluenceCount++;
                        }
                        entry = currentCandle.close;
                        stopLoss = currentCandle.high + currentAtrVal! * STRATEGY_SL_ATR_MULTIPLIER;
                        const pullbackHigh = Math.max(...historicalCandles.slice(crossoverCandleIdx > 0 ? crossoverCandleIdx : Math.max(0, currentIdx - STRATEGY_LOOKBACK_CANDLES), currentIdx + 1).map(c => c.high));
                        stopLoss = Math.max(stopLoss, pullbackHigh + currentAtrVal! * 0.25, currentEmaLong! + currentAtrVal! * 0.5);
                        takeProfit = entry - (stopLoss - entry) * STRATEGY_RR_RATIO;
                        levelsSource = `MME Crossover Baixa + Pullback. SL acima da máxima do pullback/vela/MME Longa.`;

                        if (currentVolume! > currentVolumeSma! * STRATEGY_VOLUME_CONFIRMATION_RATIO) {
                            details.push(`Volume de confirmação (${(currentVolume!/currentVolumeSma!).toFixed(1)}x SMA)`);
                            technicalConfluenceCount++;
                        }
                        if (currentCandle.high >= bbUpper! && currentCandle.close < bbMiddle!) {
                            details.push("Contexto BB: Toque BB Superior com reversão abaixo da Média.");
                            technicalConfluenceCount++;
                        }
                        if (technicalConfluenceCount >= STRATEGY_MIN_CONFLUENCES_FOR_STRONG_SIGNAL + 2) { // +2 for base crossover and pullback
                             signalType = 'VENDA_FORTE';
                        }
                    }
                } else {
                    details.push(`IFR (${currentRsi!.toFixed(1)}) fora da faixa de venda (${STRATEGY_RSI_CONFIRM_SELL_MIN}-${STRATEGY_RSI_CONFIRM_SELL_MAX})`);
                }
            }
        }
        
        if (signalType === 'NEUTRO') {
            if (justifications.length === 0) justifications.push("Nenhuma condição clara da estratégia MME Crossover/Pullback foi atendida.");
            confidenceScoreValue = 'BAIXA';
        } else {
             if (justifications.length === 0) justifications.push(`Sinal MME Crossover/Pullback gerado.`);
            if (signalType.includes('FORTE')) {
                confidenceScoreValue = 'ALTA';
            } else {
                confidenceScoreValue = 'MÉDIA';
            }
        }
    }
    
    if (!isBacktest && (signalType.includes('COMPRA') || signalType.includes('VENDA'))) {
        if (smc.closestBullishFVG && (signalType.includes('COMPRA'))) {
            justifications.push(`Contexto SMC: FVG de alta próximo abaixo (${smc.closestBullishFVG.bottom.toFixed(4)} - ${smc.closestBullishFVG.top.toFixed(4)}) pode oferecer suporte.`);
        }
        if (smc.closestBearishFVG && (signalType.includes('VENDA'))) {
            justifications.push(`Contexto SMC: FVG de baixa próximo acima (${smc.closestBearishFVG.bottom.toFixed(4)} - ${smc.closestBearishFVG.top.toFixed(4)}) pode oferecer resistência.`);
        }
    }
    
    if (justifications.length === 0 && signalType === 'NEUTRO') {
        justifications.push("Nenhum padrão de sinal identificado.");
    } else if (justifications.length === 0 && signalType !== 'NEUTRO') {
        justifications.push("Sinal gerado, mas sem justificativa específica adicional anotada.");
    }

    return {
      type: signalType,
      details,
      justification: justifications.join('\n'),
      entry, stopLoss, takeProfit, levelsSource,
      confidenceScore: confidenceScoreValue
    };
  };

  const performSingleAnalysis = useCallback(async (assetIdToAnalyze: string): Promise<AnalysisReport | null> => {
    const asset = getSelectedAsset(assetIdToAnalyze);
    if (!asset) {
      console.error(`Asset config not found for ${assetIdToAnalyze}`);
      throw new Error("Ativo selecionado não encontrado para análise individual.");
    }

    try {
      const historicalDataFull: Candle[] = await fetchHistoricalData(assetIdToAnalyze); 
      if (historicalDataFull.length < Math.max(EMA_TREND_PERIOD, ATR_VOLATILITY_AVG_PERIOD, SMC_LOOKBACK_PERIOD_CANDLES, BBANDS_PERIOD)) {
        console.warn(`Dados históricos insuficientes (${historicalDataFull.length}) para ${asset.name}. Pulando.`);
        return null;
      }

      const indicatorsFull: TechnicalIndicators = calculateAllIndicators(historicalDataFull);
      const smc: SmcAnalysis = analyzeSMC(historicalDataFull, indicatorsFull.atr);
      
      const finalSignal = processSignalLogic(historicalDataFull, indicatorsFull, smc, false);

      const lastIndicatorsSnapshot: Partial<TechnicalIndicators> = {};
      const lastValidIndex = historicalDataFull.length - 1;
      for (const key in indicatorsFull) {
          const typedKey = key as keyof TechnicalIndicators;
          if (indicatorsFull[typedKey]) {
              const indicatorArray = indicatorsFull[typedKey];
              if (indicatorArray && indicatorArray.length > lastValidIndex && indicatorArray[lastValidIndex] !== undefined) {
                  // @ts-ignore
                  lastIndicatorsSnapshot[typedKey] = [indicatorArray[lastValidIndex]];
              }
          }
      }

      return {
        asset: asset.name,
        lastCandle: historicalDataFull[lastValidIndex],
        technicalIndicators: lastIndicatorsSnapshot,
        smcAnalysis: smc,
        finalSignal,
        fullHistory: historicalDataFull,
        fullIndicators: indicatorsFull,
        strategyBacktestResult: analysisReport?.asset === asset.name ? analysisReport.strategyBacktestResult : null 
      };
    } catch (e: any) {
      console.error(`Erro na análise para ${assetIdToAnalyze}:`, e);
      if (!isScanning && !isPerformingMultiBacktest) {
        setError(`Erro ao analisar ${assetIdToAnalyze}: ${e.message || "Erro desconhecido"}`);
      } else if (isScanning) {
        setScanProgress(prev => `${prev}\nErro ao analisar ${asset.name}.`);
      } else if (isPerformingMultiBacktest) {
        setMultiBacktestProgress(prev => `${prev}\nErro no backtest de ${asset.name}.`);
      }
      return null;
    }
  }, [isScanning, getSelectedAsset, analysisReport, isPerformingMultiBacktest]);


  const runAnalysis = useCallback(async (assetIdOverride?: string) => {
    const currentAssetToAnalyze = assetIdOverride || selectedAssetId;
    setIsLoading(true);
    setError(null); 

    if (!assetIdOverride) { 
        setAnalysisReport(null); 
        setChartData([]);
    }

    const report = await performSingleAnalysis(currentAssetToAnalyze);

    if (report) {
      setAnalysisReport(report);
      const newChartData: ChartDatapoint[] = report.fullHistory!.map((candle, i) => ({
        ...candle,
        emaShort: report.fullIndicators!.emaShort?.[i],
        emaLong: report.fullIndicators!.emaLong?.[i],
        emaTrend: report.fullIndicators!.emaTrend?.[i],
        rsi: report.fullIndicators!.rsi?.[i],
        macdLine: report.fullIndicators!.macdLine?.[i],
        macdSignal: report.fullIndicators!.macdSignal?.[i],
        macdHist: report.fullIndicators!.macdHist?.[i],
        bbUpper: report.fullIndicators!.bbUpper?.[i],
        bbMiddle: report.fullIndicators!.bbMiddle?.[i],
        bbLower: report.fullIndicators!.bbLower?.[i],
        stochK: report.fullIndicators!.stochK?.[i],
        stochD: report.fullIndicators!.stochD?.[i],
      }));
      setChartData(newChartData);
      if (assetIdOverride && selectedAssetId !== assetIdOverride) {
        setSelectedAssetId(assetIdOverride); 
      }
       if (error) setError(null); 
    }
    setIsLoading(false);
  }, [selectedAssetId, performSingleAnalysis, error]);
  
  const runSingleAssetBacktestLogic = useCallback(async (
    assetIdForBacktest: string,
    initialCapital: number,
    riskPerTrade: number,
    periodDays: number // Now correctly using BACKTEST_PERIOD_DAYS from constants (e.g., 30)
  ): Promise<StrategyBacktestResult | null> => {
    const asset = getSelectedAsset(assetIdForBacktest);
    if (!asset) {
        return {
            assetId: assetIdForBacktest, periodDays, startDate: "", endDate: "",
            initialCapitalBRL: initialCapital, riskPerTradeBRL: riskPerTrade,
            finalCapitalBRL: initialCapital, totalPnlBRL: 0, percentageReturn: 0,
            totalTradesAttempted: 0, totalTradesExecuted: 0, totalTradesIgnored: 0, 
            winningTrades: 0, losingTrades: 0, winRateExecuted: 0, totalPnlPoints: 0,
            peakCapitalBRL: initialCapital, maxDrawdownBRL: 0, maxDrawdownPercentage: 0,
            trades: [], summaryMessage: "Erro: Ativo não encontrado.", error: "Ativo não encontrado."
        };
    }

    const backtestTrades: BacktestTrade[] = [];
    let currentCapitalBRL = initialCapital;
    let peakCapitalBRL = initialCapital;
    let maxDrawdownBRL = 0;
    let totalPnlBRL = 0;

    let totalPnlPoints = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalTradesAttempted = 0;
    let totalTradesExecuted = 0;
    let totalTradesIgnored = 0;
    let grossProfitPoints = 0;
    let grossLossPoints = 0;
    
    // Removed: lastBuySignalCandleIndex, lastSellSignalCandleIndex (duplicate signal filter removed)

    const candlesPerDay = (24 * 60) / CANDLE_DURATION_MINUTES;
    const totalCandlesForThisPeriod = periodDays * candlesPerDay;
    const candlesToFetchForThisBacktest = totalCandlesForThisPeriod + BACKTEST_INDICATOR_BUFFER_CANDLES;

    try {
      const allFetchedCandles = await fetchHistoricalData(assetIdForBacktest, candlesToFetchForThisBacktest);

      if (allFetchedCandles.length < candlesToFetchForThisBacktest) {
        throw new Error(`Dados históricos insuficientes para ${asset.name}. Necessário ${candlesToFetchForThisBacktest}, obtido ${allFetchedCandles.length}.`);
      }
      
      const backtestPeriodStartDate = allFetchedCandles[BACKTEST_INDICATOR_BUFFER_CANDLES].date;
      const backtestPeriodEndDate = allFetchedCandles[allFetchedCandles.length - 1].date;

      for (let i = BACKTEST_INDICATOR_BUFFER_CANDLES; i < allFetchedCandles.length; i++) {
        const currentSignalCandle = allFetchedCandles[i];
        const dataForSignalGen = allFetchedCandles.slice(0, i + 1);
        
        const indicatorsForSignal = calculateAllIndicators(dataForSignalGen);
        const smcForSignal = analyzeSMC(dataForSignalGen, indicatorsForSignal.atr);
        const tradeSignal = processSignalLogic(dataForSignalGen, indicatorsForSignal, smcForSignal, true);
        
        let ignoreReason: BacktestTrade['reasonForExit'] = undefined;

        if (tradeSignal.type !== 'NEUTRO' && tradeSignal.type !== 'ERRO') {
            totalTradesAttempted++;

            // Simplified: Removed duplicate signal checks, pre-US open, congestion hard filters.
            // These would now manifest as 'NEUTRO' from processSignalLogic if they made the signal weak,
            // or the signal would proceed if it's still valid.
            // If processSignalLogic determined the signal should be filtered (e.g., returned NEUTRO with justification),
            // then tradeSignal.entry would likely be undefined.
            if (!tradeSignal.entry || !tradeSignal.stopLoss || !tradeSignal.takeProfit) {
                ignoreReason = 'FILTERED_INTERNAL'; // Or 'NO_CLEAR_SETUP'
            }
        }

        if (tradeSignal.entry && tradeSignal.stopLoss && tradeSignal.takeProfit && !ignoreReason) {
            if (currentCapitalBRL < riskPerTrade) {
                totalTradesIgnored++;
                ignoreReason = 'INSUFFICIENT_CAPITAL';
                 const insufficientCapitalTrade: BacktestTrade = {
                    assetId: assetIdForBacktest, signalCandleDate: currentSignalCandle.date,
                    signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : 'VENDA',
                    entryDate: currentSignalCandle.date, entryPrice: tradeSignal.entry,
                    stopLossPrice: tradeSignal.stopLoss, takeProfitPrice: tradeSignal.takeProfit,
                    result: 'NO_TRIGGER', reasonForExit: 'INSUFFICIENT_CAPITAL',
                    capitalBeforeTrade: currentCapitalBRL, capitalAfterTrade: currentCapitalBRL,
                };
                backtestTrades.push(insufficientCapitalTrade);
                continue; // Skip to next candle
            }

            totalTradesExecuted++;
            const backtestTrade: BacktestTrade = {
                assetId: assetIdForBacktest,
                signalCandleDate: currentSignalCandle.date,
                signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : 'VENDA',
                entryDate: currentSignalCandle.date, entryPrice: tradeSignal.entry,
                stopLossPrice: tradeSignal.stopLoss, takeProfitPrice: tradeSignal.takeProfit,
                result: 'OPEN', capitalBeforeTrade: currentCapitalBRL,
            };

            for (let j = i + 1; j < allFetchedCandles.length; j++) {
                const executionCandle = allFetchedCandles[j];
                backtestTrade.durationCandles = (j - i);

                if (backtestTrade.signalType === 'COMPRA') {
                    if (executionCandle.low <= backtestTrade.stopLossPrice) {
                        backtestTrade.result = 'LOSS'; backtestTrade.exitPrice = backtestTrade.stopLossPrice;
                        backtestTrade.exitDate = executionCandle.date; backtestTrade.reasonForExit = 'SL_HIT';
                        break; 
                    }
                    if (executionCandle.high >= backtestTrade.takeProfitPrice) {
                        backtestTrade.result = 'WIN'; backtestTrade.exitPrice = backtestTrade.takeProfitPrice;
                        backtestTrade.exitDate = executionCandle.date; backtestTrade.reasonForExit = 'TP_HIT';
                        break; 
                    }
                } else { 
                    if (executionCandle.high >= backtestTrade.stopLossPrice) {
                        backtestTrade.result = 'LOSS'; backtestTrade.exitPrice = backtestTrade.stopLossPrice;
                        backtestTrade.exitDate = executionCandle.date; backtestTrade.reasonForExit = 'SL_HIT';
                        break; 
                    }
                    if (executionCandle.low <= backtestTrade.takeProfitPrice) {
                        backtestTrade.result = 'WIN'; backtestTrade.exitPrice = backtestTrade.takeProfitPrice;
                        backtestTrade.exitDate = executionCandle.date; backtestTrade.reasonForExit = 'TP_HIT';
                        break; 
                    }
                }
            }

            if (backtestTrade.result === 'OPEN') { 
                backtestTrade.exitPrice = allFetchedCandles[allFetchedCandles.length - 1].close;
                backtestTrade.exitDate = allFetchedCandles[allFetchedCandles.length - 1].date;
                backtestTrade.reasonForExit = 'END_OF_BACKTEST_PERIOD';
            }
            
            if (backtestTrade.exitPrice !== undefined) {
                backtestTrade.pnlPoints = backtestTrade.signalType === 'COMPRA' 
                    ? backtestTrade.exitPrice - backtestTrade.entryPrice
                    : backtestTrade.entryPrice - backtestTrade.exitPrice;
                backtestTrade.pnlPercentage = (backtestTrade.pnlPoints / backtestTrade.entryPrice) * 100;
                totalPnlPoints += backtestTrade.pnlPoints;

                const pointsToSL = Math.abs(backtestTrade.entryPrice - backtestTrade.stopLossPrice);
                let pnlForThisTradeBRL = 0;
                if (pointsToSL > 0.0000001) { 
                    const pnlRatioToRisk = backtestTrade.pnlPoints / pointsToSL;
                    const calculatedPnlBRL = pnlRatioToRisk * riskPerTrade;
                    pnlForThisTradeBRL = Math.max(-riskPerTrade, Math.min(riskPerTrade * STRATEGY_RR_RATIO, calculatedPnlBRL));
                } else { 
                    if (backtestTrade.reasonForExit === 'SL_HIT') pnlForThisTradeBRL = -riskPerTrade;
                    else if (backtestTrade.reasonForExit === 'TP_HIT') pnlForThisTradeBRL = riskPerTrade * STRATEGY_RR_RATIO; 
                    else pnlForThisTradeBRL = 0; 
                }
                
                backtestTrade.pnlBRL = pnlForThisTradeBRL;
                currentCapitalBRL += pnlForThisTradeBRL;
                totalPnlBRL += pnlForThisTradeBRL;
                backtestTrade.capitalAfterTrade = currentCapitalBRL;

                peakCapitalBRL = Math.max(peakCapitalBRL, currentCapitalBRL);
                maxDrawdownBRL = Math.max(maxDrawdownBRL, peakCapitalBRL - currentCapitalBRL);
                
                if (backtestTrade.pnlBRL > 0) {
                    winningTrades++; grossProfitPoints += backtestTrade.pnlPoints;
                } else if (backtestTrade.pnlBRL < 0) {
                    losingTrades++; grossLossPoints += Math.abs(backtestTrade.pnlPoints);
                }
                if (backtestTrade.reasonForExit === 'END_OF_BACKTEST_PERIOD') {
                     backtestTrade.result = backtestTrade.pnlBRL > 0 ? 'WIN' : (backtestTrade.pnlBRL < 0 ? 'LOSS' : 'OPEN');
                }
            }
            backtestTrades.push(backtestTrade);
        } else if (tradeSignal.type !== 'NEUTRO' && tradeSignal.type !== 'ERRO') { 
            // Signal was attempted, but resulted in no entry (e.g. filtered by simpler internal logic now)
            totalTradesIgnored++;
            const nonExecutionTrade: BacktestTrade = {
                assetId: assetIdForBacktest, signalCandleDate: currentSignalCandle.date,
                signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : (tradeSignal.type.includes('VENDA') ? 'VENDA' : 'COMPRA'), // Default if not clear
                entryDate: currentSignalCandle.date, entryPrice: 0, stopLossPrice: 0, takeProfitPrice: 0,
                result: 'IGNORED', 
                reasonForExit: ignoreReason || 'NO_CLEAR_SETUP',
                capitalBeforeTrade: currentCapitalBRL, capitalAfterTrade: currentCapitalBRL,
            };
            backtestTrades.push(nonExecutionTrade);
        }
      }

      const winRateExecuted = totalTradesExecuted > 0 ? (winningTrades / totalTradesExecuted) * 100 : 0;
      const profitFactorPoints = grossLossPoints > 0 ? grossProfitPoints / grossLossPoints : grossProfitPoints > 0 ? Infinity : 0;
      const averageWinPoints = winningTrades > 0 ? grossProfitPoints / winningTrades : undefined;
      const averageLossPoints = losingTrades > 0 ? (grossLossPoints / losingTrades) * -1 : undefined;
      const maxDrawdownPercentageValue = (peakCapitalBRL > 0 && initialCapital > 0) ? (maxDrawdownBRL / peakCapitalBRL) * 100 : 0;
      const percentageReturnValue = (initialCapital > 0) ? (totalPnlBRL / initialCapital) * 100 : 0;
      
      let summary = `Backtest (${periodDays}d) para ${asset.name}: ${totalTradesExecuted} trades de ${totalTradesAttempted} sinais (${totalTradesIgnored} ignorados). Cap. Inicial: ${initialCapital.toFixed(2)} BRL. Risco/Trade: ${riskPerTrade.toFixed(2)} BRL. PnL Total: ${totalPnlBRL.toFixed(2)} BRL. Retorno: ${percentageReturnValue.toFixed(2)}%. Cap. Final: ${currentCapitalBRL.toFixed(2)} BRL. Acerto: ${winRateExecuted.toFixed(1)}%. RR: 1:${STRATEGY_RR_RATIO}.`;
      summary += `\nNota: Gerenciamento dinâmico (ex: saída parcial em 1:1, trail stop para alvo 1:${STRATEGY_RR_RATIO}) é uma sugestão avançada para otimização manual. O alvo fixo 1:${STRATEGY_RR_RATIO} foi usado neste backtest automatizado.`;

      return {
        assetId: assetIdForBacktest, periodDays, startDate: backtestPeriodStartDate, endDate: backtestPeriodEndDate,
        initialCapitalBRL: initialCapital, riskPerTradeBRL: riskPerTrade,
        finalCapitalBRL: currentCapitalBRL, totalPnlBRL: totalPnlBRL, percentageReturn: percentageReturnValue,
        totalTradesAttempted, totalTradesExecuted, totalTradesIgnored, winningTrades, losingTrades, winRateExecuted,
        totalPnlPoints, averageWinPoints, averageLossPoints, profitFactor: profitFactorPoints,
        peakCapitalBRL: peakCapitalBRL, maxDrawdownBRL: maxDrawdownBRL, maxDrawdownPercentage: maxDrawdownPercentageValue,
        trades: backtestTrades,
        summaryMessage: summary,
      };
    } catch (e: any) {
      console.error(`Erro durante backtest de ${periodDays} dias para ${asset.name}:`, e);
      return {
          assetId: assetIdForBacktest, periodDays, startDate: "", endDate: "",
          initialCapitalBRL: initialCapital, riskPerTradeBRL: riskPerTrade,
          finalCapitalBRL: initialCapital, totalPnlBRL: 0, percentageReturn: 0,
          totalTradesAttempted: 0, totalTradesExecuted: 0, totalTradesIgnored:0, winningTrades: 0, losingTrades: 0, winRateExecuted: 0, totalPnlPoints: 0,
          peakCapitalBRL: initialCapital, maxDrawdownBRL: 0, maxDrawdownPercentage: 0,
          trades: [], summaryMessage: `Falha no backtest para ${asset.name}: ${e.message}`, error: e.message
      };
    }
  }, [getSelectedAsset]);

  const handleRunCurrentAssetBacktest = useCallback(async () => {
      setIsPerformingBacktest(true);
      setError(null);
      setAnalysisReport(prev => prev ? { ...prev, strategyBacktestResult: null } : null);

      // Using BACKTEST_PERIOD_DAYS from constants (now 30)
      const result = await runSingleAssetBacktestLogic(selectedAssetId, BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL, BACKTEST_PERIOD_DAYS);
      
      if (result) {
          if(result.error) setError(`Erro no backtest do ativo atual: ${result.error}`);
          setAnalysisReport(prev => prev ? { ...prev, strategyBacktestResult: result } : { 
              asset: getSelectedAsset(selectedAssetId)?.name || selectedAssetId,
              lastCandle: null, 
              technicalIndicators: {}, smcAnalysis: { fvgs: [], swingHighs: [], swingLows:[] }, 
              finalSignal: {type: 'NEUTRO', details:[], justification: ""}, 
              strategyBacktestResult: result 
          });
      } else {
          setError("Falha ao executar o backtest para o ativo atual.");
      }
      setIsPerformingBacktest(false);
  }, [selectedAssetId, runSingleAssetBacktestLogic, getSelectedAsset]);

  const handleRunMultiAssetBacktest = useCallback(async () => {
      setIsPerformingMultiBacktest(true);
      setMultiBacktestProgress("Iniciando backtest de múltiplos ativos...");
      setAllAssetsBacktestResults([]);
      setError(null);

      const assetsToTest = MASTER_ASSET_LIST.filter(a => a.type === AssetType.CRYPTO);
      const results: StrategyBacktestResult[] = [];
      // Using BACKTEST_PERIOD_DAYS from constants (now 30)
      const currentBacktestPeriodDays = BACKTEST_PERIOD_DAYS;


      for (let i = 0; i < assetsToTest.length; i++) {
          const asset = assetsToTest[i];
          setMultiBacktestProgress(`Backtestando ${asset.name} (${i + 1}/${assetsToTest.length}) para ${currentBacktestPeriodDays} dias...`);
          const result = await runSingleAssetBacktestLogic(asset.id, BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL, currentBacktestPeriodDays);
          if (result) {
              results.push(result);
          } else {
             results.push({ 
                assetId: asset.id, periodDays: currentBacktestPeriodDays, startDate: "", endDate: "",
                initialCapitalBRL: BACKTEST_INITIAL_CAPITAL_BRL, riskPerTradeBRL: BACKTEST_RISK_PER_TRADE_BRL,
                finalCapitalBRL: BACKTEST_INITIAL_CAPITAL_BRL, totalPnlBRL: 0, percentageReturn: 0,
                totalTradesAttempted: 0, totalTradesExecuted: 0, totalTradesIgnored:0, winningTrades: 0, losingTrades: 0, winRateExecuted: 0, totalPnlPoints: 0,
                peakCapitalBRL: BACKTEST_INITIAL_CAPITAL_BRL, maxDrawdownBRL: 0, maxDrawdownPercentage: 0,
                trades: [], summaryMessage: `Falha completa no backtest para ${asset.name}.`, error: `Falha completa no backtest para ${asset.name}.`
             });
          }
          setAllAssetsBacktestResults([...results]); 
          
          if (i < assetsToTest.length - 1) {
              await new Promise(resolve => setTimeout(resolve, SCANNER_API_DELAY_MS)); 
          }
      }
      
      setMultiBacktestProgress(`Backtest de ${assetsToTest.length} ativos (${currentBacktestPeriodDays} dias) concluído. Gerando PDF consolidado...`);
      if (results.length > 0) {
          try {
            // Pass currentBacktestPeriodDays to PDF generator
            generateMultiAssetBacktestPdfReport(results, BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL, currentBacktestPeriodDays, STRATEGY_RR_RATIO);
            setMultiBacktestProgress("Relatório PDF consolidado de backtest gerado com sucesso!");
          } catch(pdfError: any) {
            console.error("Erro ao gerar PDF consolidado:", pdfError);
            setMultiBacktestProgress(`Falha ao gerar PDF consolidado: ${pdfError.message}`);
            setError(`Falha ao gerar PDF consolidado: ${pdfError.message}`);
          }
      } else {
          setMultiBacktestProgress("Nenhum resultado de backtest para gerar PDF.");
      }

      setIsPerformingMultiBacktest(false);
  }, [runSingleAssetBacktestLogic]);


  useEffect(() => {
    const asset = getSelectedAsset();
    if( selectedAssetId === DEFAULT_ASSET_ID &&
       asset && asset.type === AssetType.CRYPTO &&
       !analysisReport && 
       !isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest &&
       !error
    ) {
        // runAnalysis(); // Auto-run on load is disabled
    }
  }, []);


  const handleScanAllAssets = useCallback(async () => {
    setError(null);
    setIsScanning(true);
    setAnalysisReport(null); 
    setChartData([]);
    scannerStopFlag.current = false;
    let strongSignalFound = false;

    const assetsToScan = MASTER_ASSET_LIST.filter(asset => asset.type === AssetType.CRYPTO);

    for (let i = 0; i < assetsToScan.length; i++) {
      if (scannerStopFlag.current) {
        setScanProgress(prev => `${prev}\nVarredura interrompida pelo usuário.`);
        break;
      }
      const asset = assetsToScan[i];
      setScanProgress(`Varrendo ${asset.name} (${i + 1}/${assetsToScan.length})...`);

      await new Promise(resolve => setTimeout(resolve, SCAN_UPDATE_INTERVAL_MS)); 

      const report = await performSingleAnalysis(asset.id);

      if (report && report.finalSignal) {
        if (report.finalSignal.type === 'COMPRA_FORTE' || report.finalSignal.type === 'VENDA_FORTE') {
          setScanProgress(`SINAL FORTE ${report.finalSignal.type.replace('_', ' ')} encontrado para ${asset.name}! Carregando detalhes...`);
          await runAnalysis(asset.id); 
          strongSignalFound = true;
          break; 
        }
      }
      if (i < assetsToScan.length -1 && !scannerStopFlag.current) { 
         await new Promise(resolve => setTimeout(resolve, SCANNER_API_DELAY_MS));
      }
    }

    if (!strongSignalFound && !scannerStopFlag.current) {
      setScanProgress(`Varredura completa. Nenhum sinal forte encontrado em ${assetsToScan.length} ativos.`);
    } else if (scannerStopFlag.current && !strongSignalFound){
        setScanProgress(prev => `${prev}\nVarredura interrompida antes de encontrar sinal forte ou completar.`);
    }
    setIsScanning(false);
  }, [performSingleAnalysis, runAnalysis]);

  const stopScan = () => {
    scannerStopFlag.current = true;
    setScanProgress(prev => `${prev}\nInterrompendo varredura...`);
  };


  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <header className="p-3 sm:p-4 shadow-md bg-surface-light dark:bg-surface-dark sticky top-0 z-50">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center space-x-2">
            <ChartBarIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary dark:text-primary-light" />
            <h1 className="text-xl sm:text-2xl font-bold text-text_primary-light dark:text-text_primary-dark">
              Fiscal Cripto <span className="text-primary dark:text-primary-light">M15</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center space-x-1 sm:space-x-2">
            <AssetSelector
              selectedAssetId={selectedAssetId}
              onAssetChange={(newAssetId) => {
                setSelectedAssetId(newAssetId);
                setAnalysisReport(null); 
                setChartData([]);
                setScanProgress("");
                setError(null); 
              }}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
            />
            <button
              onClick={() => {setError(null); runAnalysis();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
              className="px-3 py-2 sm:px-4 bg-primary dark:bg-primary-dark hover:bg-primary-light dark:hover:bg-primary-light text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title="Analisar Ativo Selecionado"
            >
              <CogIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Analisando...' : 'Analisar'}</span>
              <span className="sm:hidden text-xs">{isLoading ? '...' : 'Analisar'}</span>
            </button>
             <button
              onClick={isScanning ? stopScan : () => {setError(null); handleScanAllAssets();}}
              disabled={isLoading || isPerformingBacktest || isPerformingMultiBacktest}
              className={`px-3 py-2 sm:px-4 font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform ${
                isScanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white'
              }`}
              title={isScanning ? "Parar Varredura" : "Iniciar Varredura de Todos os Ativos"}
            >
              <PlayCircleIcon className={`w-5 h-5 ${isScanning && !scannerStopFlag.current ? 'animate-ping' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? (scannerStopFlag.current ? 'Parando...' : 'Parar Scan') : 'Scan All'}</span>
              <span className="sm:hidden text-xs">{isScanning ? (scannerStopFlag.current ? '...' : 'Parar') : 'Scan All'}</span>
            </button>
            <button
              onClick={() => {setError(null); handleRunCurrentAssetBacktest();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest }
              className="px-3 py-2 sm:px-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title={`Executar Backtest de ${BACKTEST_PERIOD_DAYS} Dias para o Ativo Atual (RR 1:${STRATEGY_RR_RATIO})`}
            >
              <BeakerIcon className={`w-5 h-5 ${isPerformingBacktest ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isPerformingBacktest ? 'Testando...' : `Backtest Ativo (${BACKTEST_PERIOD_DAYS}d)`}</span>
              <span className="sm:hidden text-xs">{isPerformingBacktest ? '...' : `BT Ativo (${BACKTEST_PERIOD_DAYS}d)`}</span>
            </button>
            <button
              onClick={() => {setError(null); handleRunMultiAssetBacktest();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
              className="px-3 py-2 sm:px-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title={`Executar Backtest de ${BACKTEST_PERIOD_DAYS} Dias para Todos os Ativos (RR 1:${STRATEGY_RR_RATIO})`}
            >
              <ListBulletIcon className={`w-5 h-5 ${isPerformingMultiBacktest ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isPerformingMultiBacktest ? 'Testando Todos...' : `BT Todos (${BACKTEST_PERIOD_DAYS}d)`}</span>
              <span className="sm:hidden text-xs">{isPerformingMultiBacktest ? '...' : `BT Todos (${BACKTEST_PERIOD_DAYS}d)`}</span>
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Alternar modo escuro"
            >
              {isDarkMode ? <SunIcon className="w-5 h-5 text-yellow-400" /> : <MoonIcon className="w-5 h-5 text-gray-700" />}
            </button>
          </div>
        </div>
        {(isScanning && scanProgress) && (
          <div className="container mx-auto px-4 pt-2">
            <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-md text-xs sm:text-sm whitespace-pre-wrap">
              {scanProgress}
            </div>
          </div>
        )}
        {(isPerformingMultiBacktest && multiBacktestProgress) && (
          <div className="container mx-auto px-4 pt-2">
            <div className="bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500 text-teal-700 dark:text-teal-300 px-4 py-2 rounded-md text-xs sm:text-sm whitespace-pre-wrap">
              {multiBacktestProgress}
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto p-2 sm:p-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark p-1 sm:p-2 rounded-lg shadow-xl dark:shadow-black/30 border border-gray-300 dark:border-gray-600">
          {(isLoading && !analysisReport && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest) && (
            <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner size="lg" text={`Analisando ${getSelectedAsset()?.name || 'ativo'}...`} />
            </div>
          )}
          {isPerformingBacktest && !analysisReport?.strategyBacktestResult && (
             <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner size="lg" text={`Executando backtest de ${BACKTEST_PERIOD_DAYS} dias para ${getSelectedAsset()?.name || 'ativo'}...`} />
            </div>
          )}
           {(isScanning || isPerformingMultiBacktest) && !analysisReport && (
             <div className="flex flex-col items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark p-4">
                <LoadingSpinner size="lg" text={isScanning ? "Varredura em progresso..." : "Backtest de múltiplos ativos em progresso..."} />
                <p className="mt-2 text-sm">O gráfico e a análise do ativo com sinal (ou primeiro ativo do multi-backtest) aparecerão aqui se aplicável.</p>
             </div>
          )}
          {!isLoading && !isPerformingBacktest && !isPerformingMultiBacktest && error && !analysisReport && ( <ErrorMessage title="Falha na Operação" message={error} /> )}

          {chartData.length > 0 && analysisReport && (
            <ChartDisplay
              data={chartData}
              fvgs={analysisReport.smcAnalysis.fvgs}
              swingHighs={analysisReport.smcAnalysis.swingHighs}
              swingLows={analysisReport.smcAnalysis.swingLows}
              tradeSignal={analysisReport.finalSignal}
              assetName={analysisReport.asset}
            />
          )}

           {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && !error && chartData.length === 0 && !analysisReport && (
             <div className="flex items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark p-4 text-center">
                <p>Selecione um ativo e clique em "Analisar", "Scan All" ou um dos botões de "Backtest".</p>
             </div>
           )}
        </div>
        <div className="lg:col-span-1 bg-transparent dark:bg-transparent p-0 rounded-lg max-h-[calc(100vh-160px)] lg:max-h-[calc(100vh-120px)] overflow-y-auto">
          {((isLoading || isPerformingBacktest || isPerformingMultiBacktest) && !isScanning && !analysisReport?.strategyBacktestResult && !analysisReport?.finalSignal.type) && ( 
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text={isLoading ? "Carregando relatório..." : (isPerformingBacktest ? "Executando backtest..." : "Executando múltiplos backtests...")} />
            </div>
          )}
           {isScanning && !analysisReport && ( 
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text="Aguardando resultado da varredura..." />
            </div>
          )}
          
          {analysisReport && <AnalysisPanel report={analysisReport} isLoading={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest} isScanning={isScanning} isPerformingBacktest={isPerformingBacktest || isPerformingMultiBacktest} />}


          {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && !analysisReport && !error && (
            <div className="p-6 text-center text-text_secondary-light dark:text_text_secondary-dark bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full flex items-center justify-center">O relatório aparecerá aqui.</div>
          )}
           {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && error && !analysisReport && ( <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full"><ErrorMessage title="Erro no Relatório" message={error} /></div> )}
        </div>
      </main>
      <footer className="text-center p-3 text-xs text-text_secondary-light dark:text_text_secondary-dark border-t border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark">
        Fiscal Cripto M15 | Aviso: Apenas para fins educacionais. Não é aconselhamento financeiro.
      </footer>
    </div>
  );
};

export default App;
