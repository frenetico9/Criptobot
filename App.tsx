
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AssetSelector from './components/AssetSelector';
import ChartDisplay from './components/ChartDisplay';
import AnalysisPanel from './components/AnalysisPanel';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { SunIcon, MoonIcon, CogIcon, ChartBarIcon, PlayCircleIcon, BeakerIcon } from './components/icons';
import {
  Candle, TechnicalIndicators, SmcAnalysis,
  TradeSignal, TradeSignalType, AnalysisReport, Asset, ChartDatapoint, AssetType, SignalConfidence
} from './types';
import {
  MASTER_ASSET_LIST, DEFAULT_ASSET_ID,
  MIN_CANDLES_FOR_BACKTEST_SIGNAL_GENERATION, BACKTEST_SIGNAL_OFFSET_CANDLES, BACKTEST_LOOKFORWARD_PERIOD_CANDLES,
  SCAN_UPDATE_INTERVAL_MS,
  EMA_SHORT_PERIOD, EMA_LONG_PERIOD, STRATEGY_LOOKBACK_CANDLES,
  STRATEGY_EMA_CROSSOVER_LOOKBACK, STRATEGY_PULLBACK_MAX_DEPTH_FACTOR,
  STRATEGY_RSI_CONFIRM_BUY_MIN, STRATEGY_RSI_CONFIRM_BUY_MAX,
  STRATEGY_RSI_CONFIRM_SELL_MAX, STRATEGY_RSI_CONFIRM_SELL_MIN,
  STRATEGY_SL_ATR_MULTIPLIER, STRATEGY_RR_RATIO, STRATEGY_VOLUME_CONFIRMATION_RATIO,
} from './constants';
import { fetchHistoricalData } from './services/marketDataService';
import { calculateAllIndicators } from './services/technicalAnalysisService';
import { analyzeSMC } from './services/smcIctService';

const App: React.FC = () => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(DEFAULT_ASSET_ID);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [chartData, setChartData] = useState<ChartDatapoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<string>("");
  const scannerStopFlag = useRef<boolean>(false);


  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) return storedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; // Default to dark if window is not available (SSR, etc.)
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
    fullIndicators: TechnicalIndicators
    // smcAnalysis is not directly used for signal generation in this strategy but available if needed
  ): TradeSignal => {
    const details: string[] = [];
    const justifications: string[] = [];
    let signalType: TradeSignalType = 'NEUTRO';
    let entry: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    let levelsSource: string | undefined = "Estratégia MME Crossover/Pullback";
    let confidenceScoreValue: SignalConfidence = 'N/D';
    let technicalStrengthScore = 0; // Used to determine 'FORTE' signals


    const numCandles = historicalCandles.length;
    if (numCandles < Math.max(EMA_LONG_PERIOD, STRATEGY_LOOKBACK_CANDLES, STRATEGY_EMA_CROSSOVER_LOOKBACK + 1)) {
        justifications.push("Dados históricos insuficientes para aplicar a estratégia MME.");
        return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
    }

    const currentIdx = numCandles - 1;
    const currentCandle = historicalCandles[currentIdx];
    entry = currentCandle.close;

    const emaShort = fullIndicators.emaShort;
    const emaLong = fullIndicators.emaLong;
    const rsi = fullIndicators.rsi;
    const atr = fullIndicators.atr;
    const volume = historicalCandles.map(c => c.volume);
    const volumeSma = fullIndicators.volumeSma;
    const engulfing = fullIndicators.engulfing;

    if (!emaShort || !emaLong || !rsi || !atr || !volumeSma || !engulfing) {
        justifications.push("Indicadores técnicos essenciais (MMEs, IFR, ATR, Vol SMA, Engolfo) não disponíveis.");
        return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
    }

    const currentEmaShort = emaShort[currentIdx];
    const currentEmaLong = emaLong[currentIdx];
    const currentRsi = rsi[currentIdx];
    const currentAtr = atr[currentIdx];
    const currentVolume = volume[currentIdx];
    const currentVolumeSma = volumeSma[currentIdx];
    const currentEngulfing = engulfing[currentIdx];

    if ([currentEmaShort, currentEmaLong, currentRsi, currentAtr, currentVolumeSma].some(val => val === undefined)) {
        justifications.push("Valores de indicadores atuais ausentes para a vela de sinal.");
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
                break;
            }
            if (prevEmaShort >= prevEmaLong && atCheckEmaShort < atCheckEmaLong) {
                isBearishCrossover = true;
                crossoverCandleIdx = checkIdx;
                details.push(`Cruzamento MME Baixa ${i} vela(s) atrás.`);
                break;
            }
        }
    }


    if (isBullishCrossover && currentEmaShort! > currentEmaLong!) {
        details.push(`MME${EMA_SHORT_PERIOD} (${currentEmaShort!.toFixed(4)}) > MME${EMA_LONG_PERIOD} (${currentEmaLong!.toFixed(4)})`);
        const inPullbackZone = currentCandle.low <= currentEmaShort! && currentCandle.close >= Math.min(currentEmaShort!, currentEmaLong!);
        const allowedDip = currentAtr! * STRATEGY_PULLBACK_MAX_DEPTH_FACTOR;
        const deepPullbackOk = currentCandle.low <= currentEmaShort! + allowedDip && currentCandle.close >= currentEmaShort! - allowedDip;

        if (inPullbackZone || deepPullbackOk) {
            details.push(`Pullback para zona MME (Mínima: ${currentCandle.low.toFixed(4)}, MME Curta: ${currentEmaShort!.toFixed(4)})`);

            if (currentRsi! >= STRATEGY_RSI_CONFIRM_BUY_MIN && currentRsi! <= STRATEGY_RSI_CONFIRM_BUY_MAX) {
                details.push(`IFR (${currentRsi!.toFixed(1)}) entre ${STRATEGY_RSI_CONFIRM_BUY_MIN}-${STRATEGY_RSI_CONFIRM_BUY_MAX}`);
                if (currentCandle.close > currentCandle.open && currentCandle.close > currentEmaShort!) {
                    details.push(`Vela de confirmação de alta (Fech: ${currentCandle.close.toFixed(4)})`);
                    signalType = 'COMPRA';
                    entry = currentCandle.close;
                    stopLoss = currentCandle.low - currentAtr! * STRATEGY_SL_ATR_MULTIPLIER;
                    const pullbackLow = Math.min(...historicalCandles.slice(crossoverCandleIdx, currentIdx + 1).map(c => c.low));
                    stopLoss = Math.min(stopLoss, pullbackLow - currentAtr! * 0.25, currentEmaLong! - currentAtr! * 0.5);

                    takeProfit = entry + (entry - stopLoss) * STRATEGY_RR_RATIO;
                    levelsSource = `MME Crossover Alta + Pullback. SL abaixo da mínima do pullback/MME Longa.`;
                    
                    technicalStrengthScore = 1; // Base score for a valid setup

                    if (currentVolume! > currentVolumeSma! * STRATEGY_VOLUME_CONFIRMATION_RATIO) {
                        details.push(`Volume de confirmação (${(currentVolume!/currentVolumeSma!).toFixed(1)}x SMA)`);
                        technicalStrengthScore += 1;
                    }
                    if (currentEngulfing === 100) {
                        details.push("Padrão Engolfo de Alta presente.");
                        technicalStrengthScore += 1;
                    }
                    if (technicalStrengthScore >= 2) signalType = 'COMPRA_FORTE'; // Example: Need at least one extra confirmation
                }
            } else {
                 details.push(`IFR (${currentRsi!.toFixed(1)}) fora da faixa de confirmação de compra (${STRATEGY_RSI_CONFIRM_BUY_MIN}-${STRATEGY_RSI_CONFIRM_BUY_MAX})`);
            }
        }
    }

    if (isBearishCrossover && currentEmaShort! < currentEmaLong!) {
        details.push(`MME${EMA_SHORT_PERIOD} (${currentEmaShort!.toFixed(4)}) < MME${EMA_LONG_PERIOD} (${currentEmaLong!.toFixed(4)})`);
        const inPullbackZone = currentCandle.high >= currentEmaShort! && currentCandle.close <= Math.max(currentEmaShort!, currentEmaLong!);
        const allowedRise = currentAtr! * STRATEGY_PULLBACK_MAX_DEPTH_FACTOR;
        const deepPullbackOk = currentCandle.high >= currentEmaShort! - allowedRise && currentCandle.close <= currentEmaShort! + allowedRise;

        if (inPullbackZone || deepPullbackOk) {
            details.push(`Pullback para zona MME (Máxima: ${currentCandle.high.toFixed(4)}, MME Curta: ${currentEmaShort!.toFixed(4)})`);

            if (currentRsi! <= STRATEGY_RSI_CONFIRM_SELL_MAX && currentRsi! >= STRATEGY_RSI_CONFIRM_SELL_MIN) {
                details.push(`IFR (${currentRsi!.toFixed(1)}) entre ${STRATEGY_RSI_CONFIRM_SELL_MIN}-${STRATEGY_RSI_CONFIRM_SELL_MAX}`);
                if (currentCandle.close < currentCandle.open && currentCandle.close < currentEmaShort!) {
                    details.push(`Vela de confirmação de baixa (Fech: ${currentCandle.close.toFixed(4)})`);
                    signalType = 'VENDA';
                    entry = currentCandle.close;
                    stopLoss = currentCandle.high + currentAtr! * STRATEGY_SL_ATR_MULTIPLIER;
                    const pullbackHigh = Math.max(...historicalCandles.slice(crossoverCandleIdx, currentIdx + 1).map(c => c.high));
                    stopLoss = Math.max(stopLoss, pullbackHigh + currentAtr! * 0.25, currentEmaLong! + currentAtr! * 0.5);

                    takeProfit = entry - (stopLoss - entry) * STRATEGY_RR_RATIO;
                    levelsSource = `MME Crossover Baixa + Pullback. SL acima da máxima do pullback/MME Longa.`;

                    technicalStrengthScore = 1; // Base score

                    if (currentVolume! > currentVolumeSma! * STRATEGY_VOLUME_CONFIRMATION_RATIO) {
                        details.push(`Volume de confirmação (${(currentVolume!/currentVolumeSma!).toFixed(1)}x SMA)`);
                        technicalStrengthScore += 1;
                    }
                     if (currentEngulfing === -100) {
                        details.push("Padrão Engolfo de Baixa presente.");
                        technicalStrengthScore += 1;
                    }
                    if (technicalStrengthScore >= 2) signalType = 'VENDA_FORTE';
                }
            } else {
                details.push(`IFR (${currentRsi!.toFixed(1)}) fora da faixa de confirmação de venda (${STRATEGY_RSI_CONFIRM_SELL_MIN}-${STRATEGY_RSI_CONFIRM_SELL_MAX})`);
            }
        }
    }

    if (signalType === 'NEUTRO') {
        justifications.push("Nenhuma condição clara da estratégia MME Crossover/Pullback foi atendida.");
        confidenceScoreValue = 'BAIXA';
    } else {
        justifications.push(`Sinal gerado com base na estratégia MME Crossover/Pullback.`);
        if (signalType.includes('FORTE')) {
            confidenceScoreValue = 'ALTA';
            justifications.push("Múltiplos fatores técnicos de confirmação presentes.");
        } else {
            confidenceScoreValue = 'MÉDIA';
            justifications.push("Configuração básica da estratégia atendida.");
        }
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
      if (historicalDataFull.length < EMA_LONG_PERIOD) {
        console.warn(`Dados históricos insuficientes (${historicalDataFull.length}) para ${asset.name}. Pulando.`);
        return null;
      }

      const indicatorsFull: TechnicalIndicators = calculateAllIndicators(historicalDataFull);
      const smc: SmcAnalysis = analyzeSMC(historicalDataFull, indicatorsFull.atr);
      
      const lastCandleIndex = historicalDataFull.length - 1;
      
      if (scannerStopFlag.current) return null;
      
      const finalSignal = processSignalLogic(historicalDataFull, indicatorsFull);

      const lastIndicatorsSnapshot: Partial<TechnicalIndicators> = {};
      for (const key in indicatorsFull) {
          const typedKey = key as keyof TechnicalIndicators;
          if (indicatorsFull[typedKey]) {
              const indicatorArray = indicatorsFull[typedKey];
              if (indicatorArray && indicatorArray.length > lastCandleIndex && indicatorArray[lastCandleIndex] !== undefined) {
                  // @ts-ignore
                  lastIndicatorsSnapshot[typedKey] = [indicatorArray[lastCandleIndex]];
              }
          }
      }

      return {
        asset: asset.name,
        lastCandle: historicalDataFull[lastCandleIndex],
        technicalIndicators: lastIndicatorsSnapshot,
        smcAnalysis: smc,
        finalSignal,
        fullHistory: historicalDataFull,
        fullIndicators: indicatorsFull,
        backtestResult: null
      };
    } catch (e: any) {
      console.error(`Erro na análise para ${assetIdToAnalyze}:`, e);
      if (!isScanning) {
        setError(`Erro ao analisar ${assetIdToAnalyze}: ${e.message || "Erro desconhecido"}`);
      } else {
        setScanProgress(prev => `${prev}\nErro ao analisar ${asset.name}.`);
      }
      return null;
    }
  }, [isScanning, getSelectedAsset]);


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
    }
    setIsLoading(false);
  }, [selectedAssetId, performSingleAnalysis]);

  useEffect(() => {
    const asset = getSelectedAsset();
    if( selectedAssetId === DEFAULT_ASSET_ID &&
       asset && asset.type === AssetType.CRYPTO &&
       !analysisReport &&
       !isLoading && !isScanning &&
       !error
    ) {
        runAnalysis();
    }
  }, [runAnalysis, selectedAssetId, analysisReport, isLoading, isScanning, error, getSelectedAsset]);


  const handleScanAllAssets = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setAnalysisReport(null);
    setChartData([]);
    scannerStopFlag.current = false;
    let strongSignalAssetFound = false;

    const assetsToScan = MASTER_ASSET_LIST.filter(asset => asset.type === AssetType.CRYPTO);
    let scanCycleCount = 0;

    while (!strongSignalAssetFound && !scannerStopFlag.current) {
        scanCycleCount++;
        setScanProgress(`Iniciando ciclo de varredura #${scanCycleCount}...\nBuscando COMPRA_FORTE ou VENDA_FORTE.`);

        for (let i = 0; i < assetsToScan.length; i++) {
            if (scannerStopFlag.current) {
                setScanProgress(prev => `${prev}\nVarredura interrompida pelo usuário.`);
                break; 
            }
            const asset = assetsToScan[i];
            setScanProgress(prev => `${prev}\nVarrendo ${asset.name} (${i + 1}/${assetsToScan.length}, Ciclo ${scanCycleCount})...`);

            await new Promise(resolve => setTimeout(resolve, SCAN_UPDATE_INTERVAL_MS));

            const report = await performSingleAnalysis(asset.id);

            if (report && report.finalSignal) {
                if (report.finalSignal.type === 'COMPRA_FORTE' || report.finalSignal.type === 'VENDA_FORTE') {
                    setScanProgress(prev => `${prev}\nSINAL ${report.finalSignal.type.replace('_', ' ')} encontrado para ${asset.name}! Carregando detalhes...`);
                    await runAnalysis(asset.id);
                    strongSignalAssetFound = true;
                    break; 
                } else {
                     setScanProgress(prev => `${prev}\nSinal ${report.finalSignal.type} para ${asset.name} (não FORTE).`);
                }
            } else if (!scannerStopFlag.current) { 
                 setScanProgress(prev => `${prev}\nSem relatório para ${asset.name} ou erro.`);
            }
            if (i === assetsToScan.length - 1 && !strongSignalAssetFound && !scannerStopFlag.current) {
                 setScanProgress(prev => `${prev}\nFim do ciclo ${scanCycleCount}. Nenhum sinal FORTE encontrado.`);
            }
        }

        if (!strongSignalAssetFound && !scannerStopFlag.current) {
            // Optional: Add a delay here before the next full scan cycle if desired
            // await new Promise(resolve => setTimeout(resolve, 3000)); // e.g., 3-second delay
            setScanProgress(prev => `${prev}\nReiniciando varredura...`);
        }
    }

    if (strongSignalAssetFound) {
        setScanProgress(prev => `${prev}\nVarredura concluída. Sinal FORTE carregado.`);
    } else if (scannerStopFlag.current) {
        // Message already set when stopScan is called or flag is checked in loop
    } else {
         setScanProgress(`Varredura finalizada. Nenhum sinal FORTE encontrado após ${scanCycleCount} ciclo(s).`);
    }
    setIsScanning(false);
  }, [performSingleAnalysis, runAnalysis]);


  const handleBacktest = () => {
    if (!analysisReport || !analysisReport.fullHistory || !analysisReport.fullIndicators || !analysisReport.lastCandle) {
      setAnalysisReport(prev => prev ? {...prev, backtestResult: "Dados insuficientes para backtest (relatório inicial, histórico completo ou indicadores completos ausentes)."} : null);
      return;
    }
    setIsBacktesting(true);
    setError(null);

    const history = analysisReport.fullHistory;
    const fullIndicatorsForBacktest = analysisReport.fullIndicators;

    const totalCandlesNeededForBacktest = MIN_CANDLES_FOR_BACKTEST_SIGNAL_GENERATION + BACKTEST_SIGNAL_OFFSET_CANDLES + BACKTEST_LOOKFORWARD_PERIOD_CANDLES;

    if (history.length < totalCandlesNeededForBacktest) {
        setAnalysisReport(prev => prev ? {
            ...prev,
            backtestResult: `Dados históricos insuficientes para este backtest. Necessário pelo menos ${totalCandlesNeededForBacktest} velas. Disponíveis: ${history.length}.`
        } : null);
        setIsBacktesting(false);
        return;
    }

    const signalGenerationEndIndex = history.length - 1 - BACKTEST_SIGNAL_OFFSET_CANDLES;
    const historicalDataForSignalGen = history.slice(0, signalGenerationEndIndex + 1);

    const indicatorsForSignalGen: TechnicalIndicators = {};
    for (const key in fullIndicatorsForBacktest) {
        const typedKey = key as keyof TechnicalIndicators;
        if (fullIndicatorsForBacktest[typedKey]) {
            // @ts-ignore
            indicatorsForSignalGen[typedKey] = fullIndicatorsForBacktest[typedKey]?.slice(0, signalGenerationEndIndex + 1);
        }
    }


    if (historicalDataForSignalGen.length < MIN_CANDLES_FOR_BACKTEST_SIGNAL_GENERATION) {
         setAnalysisReport(prev => prev ? {
            ...prev,
            backtestResult: `Não há dados históricos suficientes *antes* da vela de sinal hipotético (${new Date(historicalDataForSignalGen[historicalDataForSignalGen.length-1].date).toLocaleString('pt-BR')}) para calcular todos os indicadores necessários para gerar o sinal.`
        } : null);
        setIsBacktesting(false);
        return;
    }
    
    const historicalTradeSignal = processSignalLogic(
        historicalDataForSignalGen,
        indicatorsForSignalGen
    );

    const signalCandle = historicalDataForSignalGen[historicalDataForSignalGen.length - 1];
    const signalTime = new Date(signalCandle.date);

    let resultText = `Backtest para sinal hipotético "${historicalTradeSignal.type}" gerado em ${signalTime.toLocaleString('pt-BR')} (vela ${signalGenerationEndIndex - history.length +1} da mais recente):\n`;
    resultText += `(Preço de Fechamento na Geração: ${signalCandle.close.toFixed(4)})\n`;
    resultText += `Entrada Sugerida: ${historicalTradeSignal.entry?.toFixed(4) ?? 'N/D'}, SL: ${historicalTradeSignal.stopLoss?.toFixed(4) ?? 'N/D'}, TP: ${historicalTradeSignal.takeProfit?.toFixed(4) ?? 'N/D'}\n`;
    resultText += `Fonte dos Níveis: ${historicalTradeSignal.levelsSource || 'N/A'}\n\n`;

    let slHit = false;
    let tpHit = false;
    let outcomeDetails = `Sinal não atingiu SL ou TP dentro das próximas ${BACKTEST_LOOKFORWARD_PERIOD_CANDLES} velas.`;
    let finalPriceAtTestEnd = signalCandle.close;
    let outcomeCandleDate: Date | null = null;

    for (let i = 0; i < BACKTEST_LOOKFORWARD_PERIOD_CANDLES; i++) {
        const testCandleIndex = signalGenerationEndIndex + 1 + i;
        if (testCandleIndex >= history.length) {
            outcomeDetails = `Fim dos dados históricos alcançado antes do final do período de lookforward de ${BACKTEST_LOOKFORWARD_PERIOD_CANDLES} velas.`;
            finalPriceAtTestEnd = history[history.length-1].close;
            outcomeCandleDate = new Date(history[history.length-1].date);
            break;
        }

        const testCandle = history[testCandleIndex];
        finalPriceAtTestEnd = testCandle.close;
        outcomeCandleDate = new Date(testCandle.date);
        const { entry: sigEntry, stopLoss: sigSL, takeProfit: sigTP, type: signalTypeHist } = historicalTradeSignal;


        if (!sigEntry || !sigSL || !sigTP) {
            outcomeDetails = "Níveis de entrada, SL ou TP não definidos para o sinal histórico.";
            break;
        }

        if (signalTypeHist.includes('COMPRA')) {
            if (testCandle.low <= sigSL) {
                outcomeDetails = `Stop Loss (${sigSL.toFixed(4)}) atingido em ${new Date(testCandle.date).toLocaleString('pt-BR')} no preço ${testCandle.low.toFixed(4)}.`;
                slHit = true;
                break;
            }
            if (testCandle.high >= sigTP) {
                outcomeDetails = `Take Profit (${sigTP.toFixed(4)}) atingido em ${new Date(testCandle.date).toLocaleString('pt-BR')} no preço ${testCandle.high.toFixed(4)}.`;
                tpHit = true;
                break;
            }
        } else if (signalTypeHist.includes('VENDA')) {
            if (testCandle.high >= sigSL) {
                outcomeDetails = `Stop Loss (${sigSL.toFixed(4)}) atingido em ${new Date(testCandle.date).toLocaleString('pt-BR')} no preço ${testCandle.high.toFixed(4)}.`;
                slHit = true;
                break;
            }
            if (testCandle.low <= sigTP) {
                outcomeDetails = `Take Profit (${sigTP.toFixed(4)}) atingido em ${new Date(testCandle.date).toLocaleString('pt-BR')} no preço ${testCandle.low.toFixed(4)}.`;
                tpHit = true;
                break;
            }
        }
    }

    if (!slHit && !tpHit && historicalTradeSignal.entry && outcomeCandleDate && typeof finalPriceAtTestEnd === 'number' && typeof historicalTradeSignal.entry === 'number') {
        const pnlPoints = historicalTradeSignal.type.includes('COMPRA')
            ? finalPriceAtTestEnd - historicalTradeSignal.entry
            : historicalTradeSignal.entry - finalPriceAtTestEnd;
        const pnlPercentage = historicalTradeSignal.entry !== 0 ? (pnlPoints / historicalTradeSignal.entry) * 100 : 0;
        outcomeDetails += `\nResultado ao final do período (${outcomeCandleDate.toLocaleString('pt-BR')}): ${pnlPoints.toFixed(4)} pontos (${pnlPercentage.toFixed(2)}%). Preço final: ${finalPriceAtTestEnd.toFixed(4)}.`;
    }

    resultText += `Resultado: ${outcomeDetails}`;
    setAnalysisReport(prev => prev ? {...prev, backtestResult: resultText} : null);
    setIsBacktesting(false);
  };

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

          <div className="flex items-center space-x-1 sm:space-x-2">
            <AssetSelector
              selectedAssetId={selectedAssetId}
              onAssetChange={(newAssetId) => {
                setSelectedAssetId(newAssetId);
                setAnalysisReport(null);
                setChartData([]);
                setScanProgress("");
                setError(null); 
              }}
              disabled={isLoading || isScanning || isBacktesting}
            />
            <button
              onClick={() => {setError(null); runAnalysis();}}
              disabled={isLoading || isScanning || isBacktesting}
              className="px-3 py-2 sm:px-4 bg-primary dark:bg-primary-dark hover:bg-primary-light dark:hover:bg-primary-light text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title="Analisar Ativo Selecionado"
            >
              <CogIcon className={`w-5 h-5 ${isLoading && !isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading && !isScanning ? 'Analisando...' : 'Analisar'}</span>
              <span className="sm:hidden text-xs">{isLoading && !isScanning ? '...' : 'Analisar'}</span>
            </button>
             <button
              onClick={isScanning ? stopScan : () => {setError(null); handleScanAllAssets();}}
              disabled={isLoading || isBacktesting}
              className={`px-3 py-2 sm:px-4 font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform ${
                isScanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white'
              }`}
              title={isScanning ? "Parar Varredura" : "Iniciar Varredura Contínua por Sinais Fortes"}
            >
              <PlayCircleIcon className={`w-5 h-5 ${isScanning && !scannerStopFlag.current ? 'animate-ping' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? (scannerStopFlag.current ? 'Parando...' : 'Parar Scan') : 'Scan Loop'}</span>
              <span className="sm:hidden text-xs">{isScanning ? (scannerStopFlag.current ? '...' : 'Parar') : 'Scan Loop'}</span>
            </button>
            <button
              onClick={() => {setError(null); handleBacktest();}}
              disabled={isLoading || isScanning || isBacktesting || !analysisReport || !analysisReport.fullHistory || analysisReport.fullHistory.length < (MIN_CANDLES_FOR_BACKTEST_SIGNAL_GENERATION + BACKTEST_SIGNAL_OFFSET_CANDLES + BACKTEST_LOOKFORWARD_PERIOD_CANDLES) }
              className="px-3 py-2 sm:px-4 bg-secondary dark:bg-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-light text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title="Executar Backtest para o Sinal Gerado"
            >
              <BeakerIcon className={`w-5 h-5 ${isBacktesting ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isBacktesting ? 'Testando...' : 'Backtest'}</span>
              <span className="sm:hidden text-xs">{isBacktesting ? '...' : 'Backtest'}</span>
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
        {isScanning && scanProgress && (
          <div className="container mx-auto px-4 pt-2">
            <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-md text-xs sm:text-sm whitespace-pre-wrap max-h-24 overflow-y-auto">
              {scanProgress}
            </div>
          </div>
        )}
        {!isLoading && error && (
             <div className="container mx-auto px-4 pt-2">
                <ErrorMessage title="Ocorreu um Erro" message={error} />
             </div>
        )}
      </header>

      <main className="container mx-auto p-2 sm:p-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark p-1 sm:p-2 rounded-lg shadow-xl dark:shadow-black/30 border border-gray-300 dark:border-gray-600">
          {(isLoading && !analysisReport && !isScanning) && (
            <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner size="lg" text={`Analisando ${getSelectedAsset()?.name || 'ativo'}...`} />
            </div>
          )}
          {isScanning && !analysisReport && (
             <div className="flex flex-col items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark p-4">
                <LoadingSpinner size="lg" text="Varredura em progresso..." />
                <p className="mt-2 text-sm">O gráfico e a análise do ativo com sinal FORTE aparecerão aqui.</p>
             </div>
          )}
          
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

           {!isLoading && !isScanning && chartData.length === 0 && !analysisReport && !error && (
             <div className="flex items-center justify-center h-full text-text_secondary-light dark:text_text_secondary-dark p-4 text-center">
                <p>Selecione um ativo e clique em "Analisar" ou inicie um "Scan Loop".</p>
             </div>
           )}
        </div>
        <div className="lg:col-span-1 bg-transparent dark:bg-transparent p-0 rounded-lg max-h-[calc(100vh-160px)] lg:max-h-[calc(100vh-120px)] overflow-y-auto">
          {(isLoading && !isScanning && !analysisReport) && (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text="Carregando relatório..." />
            </div>
          )}
           {isScanning && !analysisReport && (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text="Aguardando resultado da varredura por sinal FORTE..." />
            </div>
          )}
          {isBacktesting && analysisReport && ( 
            <AnalysisPanel report={analysisReport} isLoading={isBacktesting} />
          )}
          {isBacktesting && !analysisReport && ( 
             <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
                <LoadingSpinner size="md" text="Executando backtest..." />
             </div>
          )}

          {analysisReport && !isBacktesting && <AnalysisPanel report={analysisReport} isLoading={isLoading || isScanning} />}

          {!isLoading && !isScanning && !isBacktesting && !analysisReport && !error && (
            <div className="p-6 text-center text-text_secondary-light dark:text_text_secondary-dark bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full flex items-center justify-center">O relatório aparecerá aqui.</div>
          )}
        </div>
      </main>
      <footer className="text-center p-3 text-xs text-text_secondary-light dark:text-text_secondary-dark border-t border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark">
        Fiscal Cripto M15 | Aviso: Apenas para fins educacionais. Não é aconselhamento financeiro.
      </footer>
    </div>
  );
};

export default App;
