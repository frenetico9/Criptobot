
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
  StrategyBacktestResult, BacktestTrade, MarketStructurePoint, InducementPoint, FVG, OrderBlock, KillzoneSession, SwingPoint
} from './types';
import {
  MASTER_ASSET_LIST, DEFAULT_ASSET_ID,
  SCANNER_API_DELAY_MS, SCAN_UPDATE_INTERVAL_MS,
  EMA_TREND_PERIOD, ATR_PERIOD,
  NUM_CANDLES_TO_FETCH_FOR_FULL_BACKTEST, BACKTEST_PERIOD_DAYS,
  BACKTEST_INDICATOR_BUFFER_CANDLES,
  GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START, GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END,
  GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START, GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END,
  ATR_VOLATILITY_AVG_PERIOD, VOLATILITY_HIGH_FACTOR, VOLATILITY_LOW_FACTOR,
  BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL,
  CANDLE_DURATION_MINUTES,
  SMC_STRATEGY_MIN_RR_RATIO, SMC_SL_ATR_MULTIPLIER, SMC_SL_BUFFER_PIPS_FACTOR,
  LONDON_KILLZONE_UTC_START, LONDON_KILLZONE_UTC_END,
  NEWYORK_KILLZONE_UTC_START, NEWYORK_KILLZONE_UTC_END,
  EMA_SHORT_PERIOD_DISPLAY, EMA_LONG_PERIOD_DISPLAY, BBANDS_PERIOD,
  SMC_MAX_DISTANCE_IDM_TO_POI_ATR_FACTOR
} from './constants';
import { fetchHistoricalData } from './services/marketDataService';
import { calculateAllIndicators } from './services/technicalAnalysisService';
import { analyzeSMC, findFractalSwingPoints } from './services/smcIctService'; // findFractalSwingPoints might be used here if not fully encapsulated
import { generateMultiAssetBacktestPdfReport } from './services/pdfGenerator';

// Define a new interface for the content of lastPendingSignalRef
interface PendingSignalRefContent extends TradeSignal {
    assetIdForRef?: string;
    // FIX: poiUsed will be an FVG or OrderBlock, augmented with relatedMSSIndexIfAvailable
    poiUsed?: (FVG & { relatedMSSIndexIfAvailable: number }) | (OrderBlock & { relatedMSSIndexIfAvailable: number });
}


const getGeneralLiquidityContext = (candleDate: string): string => {
  const date = new Date(candleDate);
  const utcHour = date.getUTCHours();

  if (utcHour >= GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_START && utcHour < GENERAL_LIQUIDITY_WINDOW_EUROPE_US_UTC_END) {
    return "Contexto Sessão Global: ALTA (Europa/EUA)";
  }
  if ((utcHour >= GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START && utcHour < GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END)) { // Corrected Asia check
    return "Contexto Sessão Global: MÉDIA (Asiática)";
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

const getCurrentKillzone = (candleDate: string): KillzoneSession => {
    const date = new Date(candleDate);
    const utcHour = date.getUTCHours();
    if (utcHour >= LONDON_KILLZONE_UTC_START && utcHour < LONDON_KILLZONE_UTC_END) return 'LONDON';
    if (utcHour >= NEWYORK_KILLZONE_UTC_START && utcHour < NEWYORK_KILLZONE_UTC_END) return 'NEWYORK';
    // Basic Asia check (can be refined)
    if (utcHour >= GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_START && utcHour < GENERAL_LIQUIDITY_WINDOW_ASIA_UTC_END) return 'ASIA';
    return 'NONE';
};

// Modify processSignalLogic to accept and use the pendingSignalRef
const processSignalLogic = (
    historicalCandles: Candle[],
    fullIndicators: TechnicalIndicators,
    smcData: SmcAnalysis,
    isBacktest: boolean = false,
    currentAssetIdForLog: string = "N/A",
    pendingSignalRef: React.MutableRefObject<PendingSignalRefContent | null>
  ): TradeSignal => {
    const details: string[] = [];
    let justifications: string[] = [];
    let signalType: TradeSignalType = 'NEUTRO';
    let entry: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    let levelsSource: string | undefined;
    let confidenceScoreValue: SignalConfidence = 'BAIXA';
    // FIX: Update type of poiUsedForSignal to match refined PendingSignalRefContent.poiUsed
    let poiUsedForSignal: ((FVG & { relatedMSSIndexIfAvailable: number }) | (OrderBlock & { relatedMSSIndexIfAvailable: number })) | undefined = undefined;


    const numCandles = historicalCandles.length;
    if (numCandles < Math.max(EMA_TREND_PERIOD, ATR_VOLATILITY_AVG_PERIOD, 50 /* min for SMC */)) {
        justifications.push("Dados históricos insuficientes para aplicar estratégia SMC.");
        return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
    }

    const currentIdx = numCandles - 1;
    const currentCandle = historicalCandles[currentIdx];
    const currentAtrVal = fullIndicators.atr?.[currentIdx];

    if (!currentAtrVal || currentAtrVal <= 0) {
        justifications.push("ATR não disponível ou inválido para a vela atual.");
        return { type: 'ERRO', details, justification: justifications.join('\n'), confidenceScore: 'N/D' };
    }

    const killzone = getCurrentKillzone(currentCandle.date);
    details.push(`Sessão Atual: ${killzone === 'NONE' ? 'Fora de Killzone Principal' : killzone + ' Killzone'}`);
    details.push(getGeneralLiquidityContext(currentCandle.date));
    details.push(getVolatilityContext(currentAtrVal, fullIndicators.atr));
    details.push(getTrendContext(currentCandle.close, fullIndicators.emaTrend?.[currentIdx], fullIndicators.emaTrend, currentIdx));

    const { marketStructurePoints, inducementPoints, orderBlocks, fvgs } = smcData;
    const lastMSS = smcData.lastMSS;
    let idmRelevantToLastMSS = smcData.lastInducement;

    if (lastMSS) {
        details.push(`Última Estrutura: ${lastMSS.type} ${lastMSS.direction} @ ${lastMSS.level.toFixed(4)} (${new Date(lastMSS.date).toLocaleTimeString()})`);
        if (idmRelevantToLastMSS && idmRelevantToLastMSS.relatedMSS?.index !== lastMSS.index) {
            idmRelevantToLastMSS = inducementPoints.find(idm => idm.relatedMSS?.index === lastMSS.index && idm.relatedMSS?.direction === lastMSS.direction);
        }
        if (idmRelevantToLastMSS) {
            details.push(`Inducement (IDM) (${idmRelevantToLastMSS.type}) @ ${idmRelevantToLastMSS.level.toFixed(4)}. Swept: ${idmRelevantToLastMSS.isSwept ? 'SIM ✓' : 'NÃO X'}`);
            if (!idmRelevantToLastMSS.isSwept) {
                 details.push(`Aguardando varredura do IDM.`);
            }
        } else {
            details.push(`Nenhum Inducement (IDM) claro identificado após ${lastMSS.type}.`);
        }
    } else {
        details.push("Nenhuma Quebra de Estrutura (MSS/BOS) recente clara identificada.");
    }

    // Try to restore/process pending signal first
    if (pendingSignalRef.current && pendingSignalRef.current.type === 'AGUARDANDO_ENTRADA' && pendingSignalRef.current.poiUsed && pendingSignalRef.current.assetIdForRef === currentAssetIdForLog) {
        const pendingPOI = pendingSignalRef.current.poiUsed;
        let mitigatedThisCandle = false;
        let entryPriceThisCandle: number | undefined;

        const mssForPending = marketStructurePoints.find(ms => ms.index === pendingPOI.relatedMSSIndexIfAvailable);
        if (mssForPending && lastMSS && mssForPending.index !== lastMSS.index && lastMSS.direction !== mssForPending.direction) {
            details.push(`POI pendente @ ${pendingPOI.bottom.toFixed(4)}-${pendingPOI.top.toFixed(4)} invalidado (nova MSS oposta).`);
            pendingSignalRef.current = null;
        } else {
            if (pendingPOI.type === 'bullish') {
                if (currentCandle.low <= pendingPOI.top && currentCandle.high >= pendingPOI.bottom) {
                    mitigatedThisCandle = true;
                    entryPriceThisCandle = Math.min(currentCandle.open, pendingPOI.top);
                }
            } else { // bearish
                if (currentCandle.high >= pendingPOI.bottom && currentCandle.low <= pendingPOI.top) {
                    mitigatedThisCandle = true;
                    entryPriceThisCandle = Math.max(currentCandle.open, pendingPOI.bottom);
                }
            }

            if (mitigatedThisCandle && entryPriceThisCandle !== undefined) {
                signalType = pendingPOI.type === 'bullish' ? 'COMPRA' : 'VENDA';
                entry = entryPriceThisCandle;
                stopLoss = pendingSignalRef.current.stopLoss; // SL from pending signal
                
                if (entry && stopLoss) {
                    const riskAmount = signalType === 'COMPRA' ? (entry - stopLoss) : (stopLoss - entry);
                    if (riskAmount > 0) {
                        takeProfit = signalType === 'COMPRA' ? (entry + riskAmount * SMC_STRATEGY_MIN_RR_RATIO) : (entry - riskAmount * SMC_STRATEGY_MIN_RR_RATIO);
                    } else {
                        takeProfit = undefined;
                        details.push("Aviso: Risco inválido no sinal pendente, TP não calculado.");
                    }
                } else {
                    takeProfit = pendingSignalRef.current.takeProfit; // Fallback if recalculation isn't possible
                }

                levelsSource = pendingSignalRef.current.levelsSource?.replace(" (Pendente)", " (Acionado)") || "SMC Acionado";
                justifications.push(`Entrada no POI pendente (${pendingPOI.type} ${'startIndex' in pendingPOI ? 'FVG' : 'OB'} @ ${pendingPOI.bottom.toFixed(4)}-${pendingPOI.top.toFixed(4)}) mitigado.`);
                details.push(...(pendingSignalRef.current.details || []).filter(d => !d.startsWith("Aguardando mitigação")));
                confidenceScoreValue = killzone !== 'NONE' ? 'ALTA' : 'MÉDIA';
                poiUsedForSignal = pendingPOI;
                pendingSignalRef.current = null;
            } else if ( (pendingPOI.type === 'bullish' && currentCandle.low < pendingPOI.bottom - (currentAtrVal * 0.5)) ||
                        (pendingPOI.type === 'bearish' && currentCandle.high > pendingPOI.top + (currentAtrVal * 0.5)) ) {
                details.push(`POI pendente @ ${pendingPOI.bottom.toFixed(4)}-${pendingPOI.top.toFixed(4)} invalidado (preço passou).`);
                pendingSignalRef.current = null;
            } else {
                 details.push(`Ainda aguardando mitigação do POI pendente @ ${pendingPOI.bottom.toFixed(4)}-${pendingPOI.top.toFixed(4)}.`);
                return { ...pendingSignalRef.current, details };
            }
        }
    }

    if (lastMSS && idmRelevantToLastMSS?.isSwept && signalType === 'NEUTRO') {
        let potentialPOIsBase: (FVG | OrderBlock)[] = [];
        if (lastMSS.direction === 'bullish') {
            const unmitigatedBullishFVGs = fvgs.filter(fvg => fvg.type === 'bullish' && !fvg.isMitigated && fvg.bottom < idmRelevantToLastMSS!.level && fvg.startIndex > lastMSS.index);
            const unmitigatedBullishOBs = orderBlocks.filter(ob => ob.type === 'bullish' && !ob.isMitigated && ob.bottom < idmRelevantToLastMSS!.level && ob.index > lastMSS.index);
            potentialPOIsBase = [...unmitigatedBullishFVGs, ...unmitigatedBullishOBs].sort((a,b) => a.bottom - b.bottom);
        } else { // Bearish MSS
            const unmitigatedBearishFVGs = fvgs.filter(fvg => fvg.type === 'bearish' && !fvg.isMitigated && fvg.top > idmRelevantToLastMSS!.level && fvg.startIndex > lastMSS.index);
            const unmitigatedBearishOBs = orderBlocks.filter(ob => ob.type === 'bearish' && !ob.isMitigated && ob.top > idmRelevantToLastMSS!.level && ob.index > lastMSS.index);
            potentialPOIsBase = [...unmitigatedBearishFVGs, ...unmitigatedBearishOBs].sort((a,b) => b.top - a.top);
        }

        if (potentialPOIsBase.length > 0) {
            const selectedPOIBase = potentialPOIsBase[0];
            const selectedPOIAugmented = { ...selectedPOIBase, relatedMSSIndexIfAvailable: lastMSS.index };

            const distIdmToPoi = Math.abs(idmRelevantToLastMSS!.level - (lastMSS.direction === 'bullish' ? selectedPOIAugmented.top : selectedPOIAugmented.bottom));
            if (distIdmToPoi > currentAtrVal * SMC_MAX_DISTANCE_IDM_TO_POI_ATR_FACTOR) {
                details.push(`POI (${selectedPOIAugmented.type} ${'startIndex' in selectedPOIAugmented ? 'FVG' : 'OB'}) @ ${selectedPOIAugmented.bottom.toFixed(4)}-${selectedPOIAugmented.top.toFixed(4)} muito distante do IDM. Setup ignorado.`);
            } else {
                poiUsedForSignal = selectedPOIAugmented;
                details.push(`POI Selecionado: ${selectedPOIAugmented.type} ${'startIndex' in selectedPOIAugmented ? 'FVG' : 'OB'} @ ${selectedPOIAugmented.bottom.toFixed(4)}-${selectedPOIAugmented.top.toFixed(4)}. Analisando mitigação...`);

                let mitigatedThisCandle = false;
                if (selectedPOIAugmented.type === 'bullish') {
                    if (currentCandle.low <= selectedPOIAugmented.top && currentCandle.high >= selectedPOIAugmented.bottom) { mitigatedThisCandle = true; entry = Math.min(currentCandle.open, selectedPOIAugmented.top); }
                } else { // bearish
                    if (currentCandle.high >= selectedPOIAugmented.bottom && currentCandle.low <= selectedPOIAugmented.top) { mitigatedThisCandle = true; entry = Math.max(currentCandle.open, selectedPOIAugmented.bottom); }
                }

                const assetConfig = MASTER_ASSET_LIST.find(a => a.id === currentAssetIdForLog);
                const assetNameForSL = assetConfig?.name || currentAssetIdForLog || "ASSET";
                const pipsValue = assetNameForSL.toLowerCase().includes("btc") ? 1 : assetNameForSL.toLowerCase().includes("eth") ? 0.1 : 0.0005;
                const slBuffer = Math.max(currentAtrVal * 0.05, pipsValue * SMC_SL_BUFFER_PIPS_FACTOR * 10);

                if (mitigatedThisCandle && entry !== undefined) {
                    signalType = selectedPOIAugmented.type === 'bullish' ? 'COMPRA' : 'VENDA';
                    if (signalType === 'COMPRA') {
                        const poiLowStructure = 'startIndex' in selectedPOIAugmented ? historicalCandles[selectedPOIAugmented.startIndex].low : selectedPOIAugmented.bottom;
                        stopLoss = poiLowStructure - (currentAtrVal * SMC_SL_ATR_MULTIPLIER) - slBuffer;
                        if (stopLoss && entry > stopLoss) {
                            const riskAmount = entry - stopLoss;
                            takeProfit = entry + (riskAmount * SMC_STRATEGY_MIN_RR_RATIO);
                        } else {
                             takeProfit = undefined; details.push("Aviso: Risco inválido (COMPRA), TP não calculado.");
                        }
                    } else { // VENDA
                        const poiHighStructure = 'startIndex' in selectedPOIAugmented ? historicalCandles[selectedPOIAugmented.startIndex].high : selectedPOIAugmented.top;
                        stopLoss = poiHighStructure + (currentAtrVal * SMC_SL_ATR_MULTIPLIER) + slBuffer;
                         if (stopLoss && entry < stopLoss) {
                            const riskAmount = stopLoss - entry;
                            takeProfit = entry - (riskAmount * SMC_STRATEGY_MIN_RR_RATIO);
                        } else {
                            takeProfit = undefined; details.push("Aviso: Risco inválido (VENDA), TP não calculado.");
                        }
                    }
                    levelsSource = `SMC: ${lastMSS.type} > IDM Sweep > ${'startIndex' in selectedPOIAugmented ? 'FVG' : 'OB'} Entry`;
                    justifications.push(`Setup SMC: ${lastMSS.type} ${lastMSS.direction}, varredura de IDM, entrada no POI (${selectedPOIAugmented.type}).`);
                    confidenceScoreValue = (killzone !== 'NONE') ? 'ALTA' : 'MÉDIA';
                    if (killzone === 'NONE') details.push("Confiança do sinal é MÉDIA devido à formação fora de Killzone principal.");
                    pendingSignalRef.current = null; 
                } else { 
                    const tempEntryForSLTP = selectedPOIAugmented.type === 'bullish' ? selectedPOIAugmented.top : selectedPOIAugmented.bottom;
                    let tempStopLoss: number | undefined;
                    if (selectedPOIAugmented.type === 'bullish') {
                         tempStopLoss = ('startIndex' in selectedPOIAugmented ? historicalCandles[selectedPOIAugmented.startIndex].low : selectedPOIAugmented.bottom) - (currentAtrVal * SMC_SL_ATR_MULTIPLIER) - slBuffer;
                    } else { // bearish
                         tempStopLoss = ('startIndex' in selectedPOIAugmented ? historicalCandles[selectedPOIAugmented.startIndex].high : selectedPOIAugmented.top) + (currentAtrVal * SMC_SL_ATR_MULTIPLIER) + slBuffer;
                    }
                    
                    let tempTakeProfit: number | undefined;
                    if (tempStopLoss && tempEntryForSLTP) {
                        if (selectedPOIAugmented.type === 'bullish') {
                            if (tempEntryForSLTP > tempStopLoss) {
                                const riskAmount = tempEntryForSLTP - tempStopLoss;
                                tempTakeProfit = tempEntryForSLTP + (riskAmount * SMC_STRATEGY_MIN_RR_RATIO);
                            }
                        } else { // bearish
                             if (tempEntryForSLTP < tempStopLoss) {
                                const riskAmount = tempStopLoss - tempEntryForSLTP;
                                tempTakeProfit = tempEntryForSLTP - (riskAmount * SMC_STRATEGY_MIN_RR_RATIO);
                            }
                        }
                    }


                    const newPendingSignalCandidate: PendingSignalRefContent = {
                        type: 'AGUARDANDO_ENTRADA',
                        details: [...details, `Aguardando mitigação do POI (${selectedPOIAugmented.type} ${'startIndex' in selectedPOIAugmented ? 'FVG' : 'OB'}) @ ${selectedPOIAugmented.bottom.toFixed(4)}-${selectedPOIAugmented.top.toFixed(4)}.`],
                        justification: justifications.join('\n') + (justifications.length > 0 ? '\n' : '') + `Setup SMC: ${lastMSS.type} ${lastMSS.direction}, IDM varrido. Aguardando mitigação do POI.`,
                        entry: tempEntryForSLTP,
                        stopLoss: tempStopLoss,
                        takeProfit: tempTakeProfit,
                        levelsSource: `SMC: ${lastMSS.type} > IDM Sweep > POI (Pendente)`,
                        poiUsed: selectedPOIAugmented,
                        confidenceScore: 'MÉDIA',
                        killzone,
                        assetIdForRef: currentAssetIdForLog
                    };

                    const existingPendingPOI = pendingSignalRef.current?.poiUsed;

                    if (pendingSignalRef.current &&
                        pendingSignalRef.current.type === 'AGUARDANDO_ENTRADA' &&
                        existingPendingPOI &&
                        pendingSignalRef.current.assetIdForRef === currentAssetIdForLog &&
                        selectedPOIAugmented.type === existingPendingPOI.type &&
                        ((('startIndex' in selectedPOIAugmented && 'startIndex' in existingPendingPOI && selectedPOIAugmented.startIndex === existingPendingPOI.startIndex) ||
                          (!('startIndex' in selectedPOIAugmented) && !('startIndex' in existingPendingPOI) && 'index' in selectedPOIAugmented && 'index' in existingPendingPOI && selectedPOIAugmented.index === existingPendingPOI.index))) &&
                        Math.abs(selectedPOIAugmented.bottom - existingPendingPOI.bottom) < (currentAtrVal * 0.1) &&
                        Math.abs(selectedPOIAugmented.top - existingPendingPOI.top) < (currentAtrVal * 0.1) &&
                        selectedPOIAugmented.relatedMSSIndexIfAvailable === existingPendingPOI.relatedMSSIndexIfAvailable
                        ) {
                        
                        const updatedDetails = [...(pendingSignalRef.current.details || []), "Nova tentativa de sinal pendente similar ignorada."];
                        return { ...pendingSignalRef.current, details: updatedDetails };
                    } else {
                        signalType = newPendingSignalCandidate.type;
                        justifications.push(newPendingSignalCandidate.justification || "Setup SMC: Aguardando mitigação do POI.");
                        details.length = 0; 
                        details.push(...(newPendingSignalCandidate.details || []));
                        confidenceScoreValue = newPendingSignalCandidate.confidenceScore || 'MÉDIA';
                        entry = newPendingSignalCandidate.entry;
                        stopLoss = newPendingSignalCandidate.stopLoss;
                        takeProfit = newPendingSignalCandidate.takeProfit;
                        levelsSource = newPendingSignalCandidate.levelsSource;
                        poiUsedForSignal = newPendingSignalCandidate.poiUsed;
                        pendingSignalRef.current = newPendingSignalCandidate;
                    }
                }
            }
        } else {
            details.push("Nenhum POI (FVG/OB) válido encontrado após varredura do IDM (ou POIs muito distantes).");
        }
    }

    if (justifications.length === 0 && signalType === 'NEUTRO') {
        justifications.push("Nenhum setup SMC claro identificado ou condições não atendidas.");
    } else if (justifications.length === 0 && signalType !== 'NEUTRO' && signalType !== 'AGUARDANDO_ENTRADA') {
        justifications.push("Sinal SMC gerado com base nas regras da estratégia.");
    }

    return {
      type: signalType, details, justification: justifications.join('\n'),
      entry, stopLoss, takeProfit, levelsSource,
      confidenceScore: confidenceScoreValue, killzone, poiUsed: poiUsedForSignal
    };
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

  // Use the new interface for lastPendingSignalRef
  const lastPendingSignalRef = useRef<PendingSignalRefContent | null>(null);


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

  useEffect(() => { // Apply initial background based on theme
    if (isDarkMode) {
        document.body.classList.add('dark-mode-bg');
        document.body.classList.remove('light-mode-bg');
    } else {
        document.body.classList.add('light-mode-bg');
        document.body.classList.remove('dark-mode-bg');
    }
  }, []); // Empty dependency array ensures this runs once on mount

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const getSelectedAsset = (assetIdToGet?: string): Asset | undefined => MASTER_ASSET_LIST.find(a => a.id === (assetIdToGet || selectedAssetId));

  const performSingleAnalysis = useCallback(async (
    assetIdToAnalyze: string,
    currentPendingSignalRef: React.MutableRefObject<PendingSignalRefContent | null>
    ): Promise<AnalysisReport | null> => {
    const asset = getSelectedAsset(assetIdToAnalyze);
    if (!asset) {
      console.error(`Asset config not found for ${assetIdToAnalyze}`);
      throw new Error("Ativo selecionado não encontrado para análise individual.");
    }

    // Clear pending signal if it's for a different asset
    if (currentPendingSignalRef.current && currentPendingSignalRef.current.assetIdForRef !== assetIdToAnalyze) {
        currentPendingSignalRef.current = null;
    }

    try {
      const historicalDataFull: Candle[] = await fetchHistoricalData(assetIdToAnalyze);
      if (historicalDataFull.length < Math.max(EMA_TREND_PERIOD, ATR_VOLATILITY_AVG_PERIOD, 50 )) {
        console.warn(`Dados históricos insuficientes (${historicalDataFull.length}) para ${asset.name}. Pulando.`);
        return null;
      }

      const indicatorsFull: TechnicalIndicators = calculateAllIndicators(historicalDataFull);
      const smcResult: SmcAnalysis = analyzeSMC(historicalDataFull, indicatorsFull);
      
      // Pass the ref to processSignalLogic
      const finalSignal = processSignalLogic(historicalDataFull, indicatorsFull, smcResult, false, assetIdToAnalyze, currentPendingSignalRef);

      const lastIndicatorsSnapshot: Partial<TechnicalIndicators> = {};
      const lastValidIndex = historicalDataFull.length - 1;
      for (const key in indicatorsFull) {
          const typedKey = key as keyof TechnicalIndicators;
          if (indicatorsFull[typedKey]) {
              const indicatorArray = indicatorsFull[typedKey];
              if (Array.isArray(indicatorArray) && indicatorArray.length > lastValidIndex && indicatorArray[lastValidIndex] !== undefined) {
                  // @ts-ignore
                  lastIndicatorsSnapshot[typedKey] = [indicatorArray[lastValidIndex]];
              } else if (!Array.isArray(indicatorArray) && indicatorArray !== undefined){
                  // @ts-ignore
                  lastIndicatorsSnapshot[typedKey] = [indicatorArray];
              }
          }
      }
      
      const anSmcResultCopy = {...smcResult};
      if (finalSignal.poiUsed) {
        if (finalSignal.poiUsed.type === 'bullish') {
            anSmcResultCopy.potentialBullishPOIs = [finalSignal.poiUsed];
            anSmcResultCopy.potentialBearishPOIs = [];
        } else {
            anSmcResultCopy.potentialBearishPOIs = [finalSignal.poiUsed];
            anSmcResultCopy.potentialBullishPOIs = [];
        }
        anSmcResultCopy.selectedPOI = finalSignal.poiUsed;
      } else {
        anSmcResultCopy.selectedPOI = undefined;
        anSmcResultCopy.potentialBullishPOIs = [];
        anSmcResultCopy.potentialBearishPOIs = [];
      }

      return {
        asset: asset.name,
        lastCandle: historicalDataFull[lastValidIndex],
        technicalIndicators: lastIndicatorsSnapshot,
        smcAnalysis: anSmcResultCopy,
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
  }, [isScanning, getSelectedAsset, analysisReport, isPerformingMultiBacktest, selectedAssetId]);


  const runAnalysis = useCallback(async (assetIdOverride?: string) => {
    const currentAssetToAnalyze = assetIdOverride || selectedAssetId;
    setIsLoading(true);
    setError(null);

    if (!assetIdOverride) {
        setAnalysisReport(null);
        setChartData([]);
        lastPendingSignalRef.current = null; // Clear pending signal for a fresh analysis of the selected asset
    } else {
        // If assetIdOverride is different from selectedAssetId, it's likely a scan.
        // performSingleAnalysis will handle clearing lastPendingSignalRef if assetIdForRef mismatches.
    }


    const report = await performSingleAnalysis(currentAssetToAnalyze, lastPendingSignalRef);

    if (report) {
      setAnalysisReport(report);
      const newChartData: ChartDatapoint[] = report.fullHistory!.map((candle, i) => {
        const killzone = getCurrentKillzone(candle.date);
        return {
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
            isLondonKillzone: killzone === 'LONDON',
            isNewYorkKillzone: killzone === 'NEWYORK',
        };
      });
      setChartData(newChartData);
      if (assetIdOverride && selectedAssetId !== assetIdOverride) {
        setSelectedAssetId(assetIdOverride);
        // lastPendingSignalRef is managed by performSingleAnalysis or cleared if asset changes via selector
      }
       if (error) setError(null);
    }
    setIsLoading(false);
  }, [selectedAssetId, performSingleAnalysis, error]);

  const runSingleAssetBacktestLogic = useCallback(async (
    assetIdForBacktest: string,
    initialCapital: number,
    riskPerTrade: number,
    periodDays: number
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

    let totalPnlPoints = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalTradesAttempted = 0;
    let totalTradesExecuted = 0;
    let totalTradesIgnored = 0;
    let grossProfitPoints = 0;
    let grossLossPoints = 0;

    // Use a local pending signal ref for backtesting to avoid interference with the main UI's ref
    const localPendingSignalForBacktestRef = React.createRef<PendingSignalRefContent | null>() as React.MutableRefObject<PendingSignalRefContent | null>;
    localPendingSignalForBacktestRef.current = null;


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
        const smcForSignal = analyzeSMC(dataForSignalGen, indicatorsForSignal);
        
        // Pass the local ref for backtest's signal processing
        const liveSignal = processSignalLogic(dataForSignalGen, indicatorsForSignal, smcForSignal, true, assetIdForBacktest, localPendingSignalForBacktestRef);
        
        let tradeSignalToExecute: TradeSignal | null = null;

        if (liveSignal.type === 'COMPRA' || liveSignal.type === 'VENDA') {
            tradeSignalToExecute = liveSignal;
        } else if (liveSignal.type === 'AGUARDANDO_ENTRADA') {
            // AGUARDANDO_ENTRADA signals are managed by localPendingSignalForBacktestRef internally by processSignalLogic
            // No trade to execute on this candle unless it was triggered from a previous pending state by processSignalLogic
        } else if (liveSignal.type !== 'NEUTRO' && liveSignal.type !== 'ERRO') {
             totalTradesAttempted++; totalTradesIgnored++;
        }


        if (tradeSignalToExecute && handleTradeExecution(tradeSignalToExecute, currentSignalCandle, allFetchedCandles, i)) {
            // Trade processed
        }
      } // End of main loop for candles

      function handleTradeExecution(
        tradeSignal: TradeSignal,
        signalCandle: Candle,
        allCandles: Candle[],
        signalCandleIndex: number
      ): boolean {
        if (!tradeSignal.entry || !tradeSignal.stopLoss || !tradeSignal.takeProfit) {
            totalTradesAttempted++; totalTradesIgnored++;
            backtestTrades.push({
                assetId: assetIdForBacktest, signalCandleDate: signalCandle.date,
                signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : 'VENDA',
                entryDate: signalCandle.date, entryPrice: 0, stopLossPrice: 0, takeProfitPrice: 0,
                result: 'IGNORED', reasonForExit: 'NO_CLEAR_SETUP',
                capitalBeforeTrade: currentCapitalBRL, capitalAfterTrade: currentCapitalBRL
            });
            return true;
        }
        totalTradesAttempted++;

        if (currentCapitalBRL < riskPerTrade) {
            totalTradesIgnored++;
            backtestTrades.push({
                assetId: assetIdForBacktest, signalCandleDate: signalCandle.date,
                signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : 'VENDA',
                entryDate: signalCandle.date, entryPrice: tradeSignal.entry,
                stopLossPrice: tradeSignal.stopLoss, takeProfitPrice: tradeSignal.takeProfit,
                result: 'NO_TRIGGER', reasonForExit: 'INSUFFICIENT_CAPITAL',
                capitalBeforeTrade: currentCapitalBRL, capitalAfterTrade: currentCapitalBRL,
            });
            return true;
        }

        totalTradesExecuted++;
        const backtestTrade: BacktestTrade = {
            assetId: assetIdForBacktest,
            signalCandleDate: signalCandle.date,
            signalType: tradeSignal.type.includes('COMPRA') ? 'COMPRA' : 'VENDA',
            entryDate: signalCandle.date, entryPrice: tradeSignal.entry,
            stopLossPrice: tradeSignal.stopLoss, takeProfitPrice: tradeSignal.takeProfit,
            result: 'OPEN', capitalBeforeTrade: currentCapitalBRL,
        };

        for (let j = signalCandleIndex + 1; j < allCandles.length; j++) {
            const executionCandle = allCandles[j];
            backtestTrade.durationCandles = (j - signalCandleIndex);

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
            } else { // VENDA
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
            backtestTrade.exitPrice = allCandles[allCandles.length - 1].close;
            backtestTrade.exitDate = allCandles[allCandles.length - 1].date;
            backtestTrade.reasonForExit = 'END_OF_BACKTEST_PERIOD';
        }

        if (backtestTrade.exitPrice !== undefined) {
            backtestTrade.pnlPoints = backtestTrade.signalType === 'COMPRA'
                ? backtestTrade.exitPrice - backtestTrade.entryPrice
                : backtestTrade.entryPrice - backtestTrade.exitPrice;

            let pnlForThisTradeBRL = 0;
            if (backtestTrade.result === 'WIN') {
                pnlForThisTradeBRL = riskPerTrade * SMC_STRATEGY_MIN_RR_RATIO;
            } else if (backtestTrade.result === 'LOSS') {
                pnlForThisTradeBRL = -riskPerTrade;
            } else { // END_OF_BACKTEST_PERIOD might have PNL
                const pointsToSL = Math.abs(backtestTrade.entryPrice - backtestTrade.stopLossPrice);
                if (pointsToSL > 0.0000001) { // Avoid division by zero
                    const pnlRatioToRisk = backtestTrade.pnlPoints / pointsToSL;
                    pnlForThisTradeBRL = pnlRatioToRisk * riskPerTrade;
                    // Cap PNL to max defined by RR or max loss
                    pnlForThisTradeBRL = Math.min(pnlForThisTradeBRL, riskPerTrade * SMC_STRATEGY_MIN_RR_RATIO);
                    pnlForThisTradeBRL = Math.max(pnlForThisTradeBRL, -riskPerTrade);
                } else {
                    pnlForThisTradeBRL = 0; // No risk, no PNL
                }
            }

            backtestTrade.pnlBRL = pnlForThisTradeBRL;
            currentCapitalBRL += pnlForThisTradeBRL;
            backtestTrade.capitalAfterTrade = currentCapitalBRL;

            peakCapitalBRL = Math.max(peakCapitalBRL, currentCapitalBRL);
            maxDrawdownBRL = Math.max(maxDrawdownBRL, peakCapitalBRL - currentCapitalBRL);

            if (backtestTrade.pnlBRL > 0) {
                winningTrades++; grossProfitPoints += backtestTrade.pnlPoints;
            } else if (backtestTrade.pnlBRL < 0) {
                losingTrades++; grossLossPoints += Math.abs(backtestTrade.pnlPoints);
            }
            if (backtestTrade.reasonForExit === 'END_OF_BACKTEST_PERIOD' && backtestTrade.result !== 'WIN' && backtestTrade.result !== 'LOSS') {
                 backtestTrade.result = backtestTrade.pnlBRL > 0 ? 'WIN' : (backtestTrade.pnlBRL < 0 ? 'LOSS' : 'OPEN');
            }
        }
        backtestTrades.push(backtestTrade);
        return true;
      }

      const totalPnlBRLFromTrades = backtestTrades.reduce((sum, trade) => sum + (trade.pnlBRL || 0), 0);
      const winRateExecuted = totalTradesExecuted > 0 ? (winningTrades / totalTradesExecuted) * 100 : 0;
      const profitFactorPoints = grossLossPoints > 0 ? grossProfitPoints / grossLossPoints : grossProfitPoints > 0 ? Infinity : 0;
      const averageWinPoints = winningTrades > 0 ? grossProfitPoints / winningTrades : undefined;
      const averageLossPoints = losingTrades > 0 ? (grossLossPoints / losingTrades) * -1 : undefined;
      const maxDrawdownPercentageValue = (peakCapitalBRL > 0 && initialCapital > 0) ? (maxDrawdownBRL / peakCapitalBRL) * 100 : 0;
      const percentageReturnValue = (initialCapital > 0) ? (totalPnlBRLFromTrades / initialCapital) * 100 : 0;

      let summary = `Backtest SMC (${periodDays}d) para ${asset.name}: ${totalTradesExecuted} trades de ${totalTradesAttempted} sinais (${totalTradesIgnored} ignorados). Cap. Inicial: ${initialCapital.toFixed(2)} BRL. Risco/Trade: ${riskPerTrade.toFixed(2)} BRL. PnL Total: ${totalPnlBRLFromTrades.toFixed(2)} BRL. Retorno: ${percentageReturnValue.toFixed(2)}%. Cap. Final: ${currentCapitalBRL.toFixed(2)} BRL. Acerto: ${winRateExecuted.toFixed(1)}%. RR Alvo: 1:${SMC_STRATEGY_MIN_RR_RATIO}.`;
      summary += `\nNota: A estratégia busca por Quebra de Estrutura, Inducement e entrada em POIs (FVG/OB) em Killzones.`;

      return {
        assetId: assetIdForBacktest, periodDays, startDate: backtestPeriodStartDate, endDate: backtestPeriodEndDate,
        initialCapitalBRL: initialCapital, riskPerTradeBRL: riskPerTrade,
        finalCapitalBRL: currentCapitalBRL, totalPnlBRL: totalPnlBRLFromTrades, percentageReturn: percentageReturnValue,
        totalTradesAttempted, totalTradesExecuted, totalTradesIgnored, winningTrades, losingTrades, winRateExecuted,
        totalPnlPoints: backtestTrades.reduce((sum, trade) => sum + (trade.pnlPoints || 0), 0),
        averageWinPoints, averageLossPoints, profitFactor: profitFactorPoints,
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
      lastPendingSignalRef.current = null;

      const result = await runSingleAssetBacktestLogic(selectedAssetId, BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL, BACKTEST_PERIOD_DAYS);

      if (result) {
          if(result.error) setError(`Erro no backtest do ativo atual: ${result.error}`);
          setAnalysisReport(prev => {
            const currentAsset = getSelectedAsset(selectedAssetId);
            const baseReport = prev || {
                asset: currentAsset?.name || selectedAssetId,
                lastCandle: null,
                technicalIndicators: {},
                smcAnalysis: { swingHighs:[], swingLows:[], marketStructurePoints:[], inducementPoints:[], orderBlocks:[], fvgs:[], potentialBullishPOIs:[], potentialBearishPOIs:[]},
                finalSignal: {type: 'NEUTRO', details:[], justification: ""},
            };
            return {...baseReport, strategyBacktestResult: result};
          });
      } else {
          setError("Falha ao executar o backtest para o ativo atual.");
      }
      setIsPerformingBacktest(false);
  }, [selectedAssetId, runSingleAssetBacktestLogic, getSelectedAsset]);

  const handleRunMultiAssetBacktest = useCallback(async () => {
      setIsPerformingMultiBacktest(true);
      setMultiBacktestProgress("Iniciando backtest de múltiplos ativos (SMC)...");
      setAllAssetsBacktestResults([]);
      setError(null);
      lastPendingSignalRef.current = null;

      const assetsToTest = MASTER_ASSET_LIST.filter(a => a.type === AssetType.CRYPTO);
      const results: StrategyBacktestResult[] = [];
      const currentBacktestPeriodDays = BACKTEST_PERIOD_DAYS;

      for (let i = 0; i < assetsToTest.length; i++) {
          const asset = assetsToTest[i];
          setMultiBacktestProgress(`Backtestando ${asset.name} (${i + 1}/${assetsToTest.length}) para ${currentBacktestPeriodDays} dias (SMC)...`);
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

      setMultiBacktestProgress(`Backtest SMC de ${assetsToTest.length} ativos (${currentBacktestPeriodDays} dias) concluído. Gerando PDF...`);
      if (results.length > 0) {
          try {
            generateMultiAssetBacktestPdfReport(results, BACKTEST_INITIAL_CAPITAL_BRL, BACKTEST_RISK_PER_TRADE_BRL, currentBacktestPeriodDays, SMC_STRATEGY_MIN_RR_RATIO);
            setMultiBacktestProgress("Relatório PDF consolidado de backtest (SMC) gerado!");
          } catch(pdfError: any) {
            console.error("Erro ao gerar PDF consolidado SMC:", pdfError);
            setMultiBacktestProgress(`Falha ao gerar PDF consolidado SMC: ${pdfError.message}`);
            setError(`Falha ao gerar PDF consolidado SMC: ${pdfError.message}`);
          }
      } else {
          setMultiBacktestProgress("Nenhum resultado de backtest SMC para gerar PDF.");
      }

      setIsPerformingMultiBacktest(false);
  }, [runSingleAssetBacktestLogic]);


  useEffect(() => {
    // Auto-run on load is disabled
  }, []);


  const handleScanAllAssets = useCallback(async () => {
    setError(null);
    setIsScanning(true);
    setAnalysisReport(null);
    setChartData([]);
    scannerStopFlag.current = false;
    let strongSignalFound = false;
    // For scan, each asset analysis is independent, so pending signals don't carry over between assets
    // lastPendingSignalRef will be managed by performSingleAnalysis for each asset individually.

    const assetsToScan = MASTER_ASSET_LIST.filter(asset => asset.type === AssetType.CRYPTO);

    for (let i = 0; i < assetsToScan.length; i++) {
      if (scannerStopFlag.current) {
        setScanProgress(prev => `${prev}\nVarredura SMC interrompida.`);
        break;
      }
      const asset = assetsToScan[i];
      setScanProgress(`Varrendo ${asset.name} (${i + 1}/${assetsToScan.length}) com estratégia SMC...`);

      await new Promise(resolve => setTimeout(resolve, SCAN_UPDATE_INTERVAL_MS));

      // Create a temporary ref for this specific asset's scan iteration if needed,
      // or rely on performSingleAnalysis to clear the main ref if asset ID changes.
      // The current setup with performSingleAnalysis taking lastPendingSignalRef and clearing it
      // if assetIdForRef mismatches is suitable.
      const report = await performSingleAnalysis(asset.id, lastPendingSignalRef);

      if (report && report.finalSignal) {
        if (report.finalSignal.type.includes('FORTE') ||
            (report.finalSignal.type === 'COMPRA' || report.finalSignal.type === 'VENDA') && report.finalSignal.confidenceScore === 'ALTA' ||
            report.finalSignal.type === 'AGUARDANDO_ENTRADA' && report.finalSignal.confidenceScore !== 'BAIXA'
           ) {
          setScanProgress(`SINAL SMC (${report.finalSignal.type}) encontrado/pendente para ${asset.name}! Carregando detalhes...`);
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
      setScanProgress(`Varredura SMC completa. Nenhum sinal forte/pendente de alta confiança encontrado em ${assetsToScan.length} ativos.`);
    } else if (scannerStopFlag.current && !strongSignalFound){
        setScanProgress(prev => `${prev}\nVarredura SMC interrompida antes de encontrar sinal forte ou completar.`);
    }
    setIsScanning(false);
  }, [performSingleAnalysis, runAnalysis]);

  const stopScan = () => {
    scannerStopFlag.current = true;
    setScanProgress(prev => `${prev}\nInterrompendo varredura SMC...`);
  };


  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <header className="p-3 sm:p-4 shadow-md bg-surface-light dark:bg-surface-dark sticky top-0 z-50">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center space-x-2">
            <ChartBarIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary dark:text-primary-light" />
            <h1 className="text-xl sm:text-2xl font-bold text-text_primary-light dark:text-text_primary-dark">
              Fiscal Cripto <span className="text-primary dark:text-primary-light">SMC</span>
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
                lastPendingSignalRef.current = null; // Clear pending signal on manual asset change
              }}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
            />
            <button
              onClick={() => {setError(null); runAnalysis();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
              className="px-3 py-2 sm:px-4 bg-primary dark:bg-primary-dark hover:bg-primary-light dark:hover:bg-primary-light text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title="Analisar Ativo Selecionado (SMC)"
            >
              <CogIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Analisando...' : 'Analisar SMC'}</span>
              <span className="sm:hidden text-xs">{isLoading ? '...' : 'Analisar SMC'}</span>
            </button>
             <button
              onClick={isScanning ? stopScan : () => {setError(null); handleScanAllAssets();}}
              disabled={isLoading || isPerformingBacktest || isPerformingMultiBacktest}
              className={`px-3 py-2 sm:px-4 font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform ${
                isScanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white'
              }`}
              title={isScanning ? "Parar Varredura SMC" : "Iniciar Varredura SMC de Todos os Ativos"}
            >
              <PlayCircleIcon className={`w-5 h-5 ${isScanning && !scannerStopFlag.current ? 'animate-ping' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? (scannerStopFlag.current ? 'Parando...' : 'Parar Scan') : 'Scan All SMC'}</span>
              <span className="sm:hidden text-xs">{isScanning ? (scannerStopFlag.current ? '...' : 'Parar') : 'Scan All SMC'}</span>
            </button>
            <button
              onClick={() => {setError(null); handleRunCurrentAssetBacktest();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest }
              className="px-3 py-2 sm:px-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title={`Executar Backtest SMC de ${BACKTEST_PERIOD_DAYS} Dias para o Ativo Atual (RR 1:${SMC_STRATEGY_MIN_RR_RATIO})`}
            >
              <BeakerIcon className={`w-5 h-5 ${isPerformingBacktest ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isPerformingBacktest ? 'Testando...' : `BT Ativo SMC (${BACKTEST_PERIOD_DAYS}d)`}</span>
              <span className="sm:hidden text-xs">{isPerformingBacktest ? '...' : `BT Ativo SMC (${BACKTEST_PERIOD_DAYS}d)`}</span>
            </button>
            <button
              onClick={() => {setError(null); handleRunMultiAssetBacktest();}}
              disabled={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest}
              className="px-3 py-2 sm:px-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 hover:scale-105 hover:brightness-110 transform"
              title={`Executar Backtest SMC de ${BACKTEST_PERIOD_DAYS} Dias para Todos os Ativos (RR 1:${SMC_STRATEGY_MIN_RR_RATIO})`}
            >
              <ListBulletIcon className={`w-5 h-5 ${isPerformingMultiBacktest ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isPerformingMultiBacktest ? 'Testando Todos...' : `BT Todos SMC (${BACKTEST_PERIOD_DAYS}d)`}</span>
              <span className="sm:hidden text-xs">{isPerformingMultiBacktest ? '...' : `BT Todos SMC (${BACKTEST_PERIOD_DAYS}d)`}</span>
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
              <LoadingSpinner size="lg" text={`Analisando ${getSelectedAsset()?.name || 'ativo'} (SMC)...`} />
            </div>
          )}
          {isPerformingBacktest && !analysisReport?.strategyBacktestResult && (
             <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner size="lg" text={`Executando backtest SMC de ${BACKTEST_PERIOD_DAYS} dias para ${getSelectedAsset()?.name || 'ativo'}...`} />
            </div>
          )}
           {(isScanning || isPerformingMultiBacktest) && !analysisReport && (
             <div className="flex flex-col items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark p-4">
                <LoadingSpinner size="lg" text={isScanning ? "Varredura SMC em progresso..." : "Backtest SMC de múltiplos ativos em progresso..."} />
                <p className="mt-2 text-sm">O gráfico e a análise do ativo com sinal (ou primeiro ativo do multi-backtest) aparecerão aqui se aplicável.</p>
             </div>
          )}
          {!isLoading && !isPerformingBacktest && !isPerformingMultiBacktest && error && !analysisReport && ( <ErrorMessage title="Falha na Operação" message={error} /> )}

          {chartData.length > 0 && analysisReport && (
            <ChartDisplay
              data={chartData}
              smcAnalysis={analysisReport.smcAnalysis}
              tradeSignal={analysisReport.finalSignal}
              assetName={analysisReport.asset}
            />
          )}

           {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && !error && chartData.length === 0 && !analysisReport && (
             <div className="flex items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark p-4 text-center">
                <p>Selecione um ativo e clique em "Analisar SMC", "Scan All SMC" ou um dos botões de "Backtest SMC".</p>
             </div>
           )}
        </div>
        <div className="lg:col-span-1 bg-transparent dark:bg-transparent p-0 rounded-lg max-h-[calc(100vh-160px)] lg:max-h-[calc(100vh-120px)] overflow-y-auto">
          {((isLoading || isPerformingBacktest || isPerformingMultiBacktest) && !isScanning && !analysisReport?.strategyBacktestResult && (!analysisReport?.finalSignal || analysisReport.finalSignal.type === 'NEUTRO')) && (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text={isLoading ? "Carregando relatório SMC..." : (isPerformingBacktest ? "Executando backtest SMC..." : "Executando múltiplos backtests SMC...")} />
            </div>
          )}
           {isScanning && !analysisReport && (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
              <LoadingSpinner size="md" text="Aguardando resultado da varredura SMC..." />
            </div>
          )}
          
          {analysisReport && <AnalysisPanel report={analysisReport} isLoading={isLoading || isScanning || isPerformingBacktest || isPerformingMultiBacktest} isScanning={isScanning} isPerformingBacktest={isPerformingBacktest || isPerformingMultiBacktest} />}


          {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && !analysisReport && !error && (
            <div className="p-6 text-center text-text_secondary-light dark:text_text_secondary-dark bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full flex items-center justify-center">O relatório SMC aparecerá aqui.</div>
          )}
           {!isLoading && !isScanning && !isPerformingBacktest && !isPerformingMultiBacktest && error && !analysisReport && ( <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full"><ErrorMessage title="Erro no Relatório SMC" message={error} /></div> )}
        </div>
      </main>
      <footer className="text-center p-3 text-xs text-text_secondary-light dark:text_text_secondary-dark border-t border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark">
        Fiscal Cripto SMC | Aviso: Apenas para fins educacionais. Não é aconselhamento financeiro.
      </footer>
    </div>
  );
};

export default App;
