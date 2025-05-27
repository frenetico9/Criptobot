
import React from 'react';
import { AnalysisReport, Candle, FVG, SwingPoint, TradeSignalType, TechnicalIndicators, StrategyBacktestResult, MarketStructurePoint, OrderBlock, InducementPoint, SmcAnalysis, KillzoneSession } from '../types';
import { ArrowDownIcon, ArrowUpIcon, MinusSmallIcon, SparklesIcon, DownloadIcon, ClockIcon } from './icons'; // Added ClockIcon
// FIX: Import BACKTEST_PERIOD_DAYS from constants
import { EMA_TREND_PERIOD, EMA_SHORT_PERIOD_DISPLAY, EMA_LONG_PERIOD_DISPLAY, SMC_STRATEGY_MIN_RR_RATIO, BACKTEST_PERIOD_DAYS } from '../constants';
import { generatePdfReport, generateBacktestPdfReport } from '../services/pdfGenerator'; 
import { formatPrice as utilFormatPrice } from '../utils/formatters';


interface AnalysisPanelProps {
  report: AnalysisReport | null;
  isLoading?: boolean;
  isScanning?: boolean; 
  isPerformingBacktest?: boolean; 
}

const SignalIcon: React.FC<{ type: TradeSignalType }> = ({ type }) => {
  switch (type) {
    case 'COMPRA_FORTE':
    case 'COMPRA':
      return <ArrowUpIcon className="text-success inline-block mr-2" />;
    case 'VENDA_FORTE':
    case 'VENDA':
      return <ArrowDownIcon className="text-danger inline-block mr-2" />;
    case 'NEUTRO':
      return <MinusSmallIcon className="text-warning inline-block mr-2" />;
    case 'AGUARDANDO_ENTRADA':
      return <ClockIcon className="text-blue-500 dark:text-blue-400 inline-block mr-2" />;
    default: // ERRO
      return <SparklesIcon className="text-gray-500 dark:text-gray-400 inline-block mr-2" />;
  }
};

const formatPrice = (price?: number, assetName?: string) => {
    return utilFormatPrice(price, assetName);
}

const formatBRL = (value?: number) => {
    if (value === undefined || value === null) return 'N/D';
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`mb-4 p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-lg dark:shadow-black/25 ${className}`}>
    <h3 className="text-lg font-semibold text-primary dark:text-primary-light mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">{title}</h3>
    <div className="space-y-1">
        {children}
    </div>
  </div>
);

const KeyValue: React.FC<{ label: string; value: string | number | undefined | React.ReactNode; unit?: string; className?: string; valueClassName?: string }> = ({ label, value, unit, className, valueClassName }) => (
  <div className={`text-sm flex justify-between items-start py-0.5 ${className || ''}`}>
    <span className="font-medium text-text_secondary-light dark:text-text_secondary-dark whitespace-nowrap mr-2">{label}: </span>
    <span className={`text-text_primary-light dark:text-text_primary-dark text-right ${valueClassName || ''}`}>
      {value !== undefined && value !== null ? <>{value}{unit || ''}</> : 'N/D'}
    </span>
  </div>
);

const renderLastCandle = (candle: Candle | null, assetName?: string) => candle ? (
    <>
        <KeyValue label="Horário" value={new Date(candle.date).toLocaleString('pt-BR')} />
        <KeyValue label="Abertura" value={formatPrice(candle.open, assetName)} />
        <KeyValue label="Máxima" value={formatPrice(candle.high, assetName)} />
        <KeyValue label="Mínima" value={formatPrice(candle.low, assetName)} />
        <KeyValue label="Fechamento" value={formatPrice(candle.close, assetName)} />
        <KeyValue label="Volume" value={candle.volume?.toLocaleString('pt-BR')} />
    </>
) : <p className="text-sm text-text_secondary-light dark:text-text_secondary-dark">Não disponível.</p>;

// General TA remains for context, not primary signal driver
const renderTAContext = (ta: Partial<TechnicalIndicators>, assetName?: string) => {
    const lastRSI = Array.isArray(ta.rsi) && ta.rsi.length > 0 ? ta.rsi[0] : undefined;
    const lastEMATrend = Array.isArray(ta.emaTrend) && ta.emaTrend.length > 0 ? ta.emaTrend[0] : undefined;

    return (
        <>
            <KeyValue label={`MME Tendência (${EMA_TREND_PERIOD})`} value={formatPrice(lastEMATrend, assetName)} />
            <KeyValue label="IFR (RSI)" value={lastRSI?.toFixed(2)} />
             {/* Candlestick patterns can be confluences */}
             {ta.engulfing?.[0] === 150 && <KeyValue label="Padrão Vela Recente" value="Martelo (Alta Potencial)" valueClassName="text-green-500"/>}
             {ta.engulfing?.[0] === -150 && <KeyValue label="Padrão Vela Recente" value="Estrela Cadente (Baixa Potencial)" valueClassName="text-red-500"/>}
             {ta.engulfing?.[0] === 100 && <KeyValue label="Padrão Vela Recente" value="Engolfo de Alta Potencial" valueClassName="text-green-500"/>}
             {ta.engulfing?.[0] === -100 && <KeyValue label="Padrão Vela Recente" value="Engolfo de Baixa Potencial" valueClassName="text-red-500"/>}
        </>
    );
};

const renderSMC = (smc: SmcAnalysis, assetName?: string) => {
    const { marketStructurePoints, inducementPoints, selectedPOI } = smc;
    const lastMSS = marketStructurePoints.filter(p => p.type === 'CHoCH' || p.type === 'BOS').pop();
    const lastIDM = inducementPoints.length > 0 ? inducementPoints[inducementPoints.length-1] : undefined;

    return (
    <>
        {lastMSS && (
            <KeyValue 
                label={`Última Estrutura (${lastMSS.type})`} 
                value={`${lastMSS.direction === 'bullish' ? 'Alta' : 'Baixa'} em ${formatPrice(lastMSS.level, assetName)} (${new Date(lastMSS.date).toLocaleTimeString('pt-BR')})`} 
                valueClassName={lastMSS.direction === 'bullish' ? 'text-success' : 'text-danger'}
            />
        )}
        {!lastMSS && <KeyValue label="Estrutura Principal" value="Nenhuma clara recentemente."/>}

        {lastIDM && (
             <KeyValue 
                label={`Inducement (${lastIDM.type === 'high' ? 'Topo' : 'Fundo'})`} 
                value={`${formatPrice(lastIDM.level, assetName)} ${lastIDM.isSwept ? '(Varrido ✓)' : '(Aguardando X)'}`} 
                valueClassName={lastIDM.isSwept ? 'text-green-500' : 'text-amber-500'}
            />
        )}
        {!lastIDM && lastMSS && <KeyValue label="Inducement" value="Nenhum claro após MSS."/>}
        
        {selectedPOI && (
            <KeyValue 
                label={`POI Alvo (${selectedPOI.type} ${'startIndex' in selectedPOI ? 'FVG' : 'OB'})`}
                value={<div className="text-xs text-right">{`De ${formatPrice(selectedPOI.bottom, assetName)} a ${formatPrice(selectedPOI.top, assetName)}`} <br/> {`Índice: ${'startIndex' in selectedPOI ? selectedPOI.startIndex : selectedPOI.index}`}</div> }
                valueClassName={selectedPOI.type === 'bullish' ? 'text-blue-500 dark:text-blue-400' : 'text-purple-500 dark:text-purple-400'}
            />
        )}
        {lastMSS && lastIDM?.isSwept && !selectedPOI && <KeyValue label="POI Alvo" value="Nenhum POI válido encontrado/selecionado."/>}

        <KeyValue label="FVGs Relevantes (Não Mitigados)" value={smc.fvgs.filter(f=>!f.isMitigated).length} />
        <KeyValue label="Order Blocks Relevantes (Não Mitigados)" value={smc.orderBlocks.filter(ob=>!ob.isMitigated).length} />
    </>
    );
};


const renderStrategyBacktestResult = (result: StrategyBacktestResult, assetName?: string) => (
    <>
        <KeyValue label="Período Testado" value={`${result.periodDays} dias`} />
        <KeyValue label="Data Início Teste" value={new Date(result.startDate).toLocaleDateString('pt-BR')} />
        <KeyValue label="Data Fim Teste" value={new Date(result.endDate).toLocaleDateString('pt-BR')} />
        <hr className="my-2 border-gray-300 dark:border-gray-600" />
        <KeyValue label="Capital Inicial" value={formatBRL(result.initialCapitalBRL)} />
        <KeyValue label="Risco por Trade" value={formatBRL(result.riskPerTradeBRL)} />
        <KeyValue label="Capital Final" value={formatBRL(result.finalCapitalBRL)} valueClassName={result.finalCapitalBRL > result.initialCapitalBRL ? 'text-success font-bold' : result.finalCapitalBRL < result.initialCapitalBRL ? 'text-danger font-bold' : 'font-bold'}/>
        <KeyValue label="Resultado Total (BRL)" value={formatBRL(result.totalPnlBRL)} valueClassName={result.totalPnlBRL > 0 ? 'text-success font-semibold' : result.totalPnlBRL < 0 ? 'text-danger font-semibold' : 'font-semibold'} />
        <KeyValue label="Retorno sobre Capital" value={`${result.percentageReturn.toFixed(2)}%`} valueClassName={result.percentageReturn > 0 ? 'text-success' : result.percentageReturn < 0 ? 'text-danger' : ''} />
         <KeyValue label="Pico de Capital (BRL)" value={formatBRL(result.peakCapitalBRL)} />
        <KeyValue label="Max Drawdown (BRL)" value={formatBRL(result.maxDrawdownBRL)} valueClassName="text-danger" />
        <KeyValue label="Max Drawdown (%)" value={`${result.maxDrawdownPercentage.toFixed(2)}%`} valueClassName="text-danger" />
        <hr className="my-2 border-gray-300 dark:border-gray-600" />
        <KeyValue label="Total Sinais Gerados" value={result.totalTradesAttempted} />
        <KeyValue label="Total Trades Ignorados" value={result.totalTradesIgnored} />
        <KeyValue label="Total Trades Executados" value={result.totalTradesExecuted} />
        <KeyValue label="Trades Vencedores" value={result.winningTrades} valueClassName="text-success" />
        <KeyValue label="Trades Perdedores" value={result.losingTrades} valueClassName="text-danger" />
        <KeyValue label="Taxa de Acerto (Exec.)" value={result.winRateExecuted.toFixed(1)} unit="%" />
        <KeyValue label="Total PnL (Pontos)" value={result.totalPnlPoints.toFixed(assetName?.toUpperCase().includes("BTC") ? 2 : 4)} valueClassName={result.totalPnlPoints > 0 ? 'text-success' : result.totalPnlPoints < 0 ? 'text-danger' : ''} />
        {result.profitFactor !== undefined && <KeyValue label="Fator de Lucro (Pontos)" value={result.profitFactor.toFixed(2)} />}
        {result.averageWinPoints !== undefined && <KeyValue label="Média Ganho (Pontos)" value={result.averageWinPoints.toFixed(assetName?.toUpperCase().includes("BTC") ? 2 : 4)} />}
        {result.averageLossPoints !== undefined && <KeyValue label="Média Perda (Pontos)" value={Math.abs(result.averageLossPoints).toFixed(assetName?.toUpperCase().includes("BTC") ? 2 : 4)} />}
         {result.summaryMessage && <p className="text-xs sm:text-sm mt-2 whitespace-pre-wrap text-text_secondary-light dark:text-text_secondary-dark">{result.summaryMessage}</p>}
         {result.error && <p className="text-xs text-danger mt-1">{result.error}</p>}
    </>
);


const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ report, isLoading, isScanning, isPerformingBacktest }) => {
  if (!report) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark p-6 text-center text-text_secondary-light dark:text-text_secondary-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full flex items-center justify-center">
        Nenhum relatório de análise disponível. Selecione um ativo e clique em Analisar ou inicie uma varredura.
      </div>
    );
  }

  const { asset, lastCandle, technicalIndicators, smcAnalysis, finalSignal, strategyBacktestResult } = report;

  const displaySignalType = (type: TradeSignalType) => {
    return type.replace(/_/g, ' ').replace('FORTE', '(FORTE)').replace('AGUARDANDO ENTRADA', 'AGUARD. ENTRADA');
  }

  let signalBgColor = 'bg-gray-200 dark:bg-gray-600/30';
  let signalTextColor = 'text-gray-700 dark:text-gray-300';

  if (finalSignal.type.includes('COMPRA')) {
    signalBgColor = 'bg-success/10 dark:bg-success/20';
    signalTextColor = 'text-success';
  } else if (finalSignal.type.includes('VENDA')) {
    signalBgColor = 'bg-danger/10 dark:bg-danger/20';
    signalTextColor = 'text-danger';
  } else if (finalSignal.type === 'NEUTRO') {
    signalBgColor = 'bg-warning/10 dark:bg-warning/20';
    signalTextColor = 'text-warning';
  } else if (finalSignal.type === 'AGUARDANDO_ENTRADA') {
    signalBgColor = 'bg-blue-500/10 dark:bg-blue-500/20';
    signalTextColor = 'text-blue-500 dark:text-blue-400';
  }


  const handleDownloadSingleAnalysisPdf = () => {
    if (report) {
      generatePdfReport(report);
    }
  };

  const handleDownloadBacktestPdf = () => {
    if (report && strategyBacktestResult && strategyBacktestResult.trades.length > 0) {
      // Pass SMC_STRATEGY_MIN_RR_RATIO to the PDF generator
      generateBacktestPdfReport(strategyBacktestResult, report.asset, SMC_STRATEGY_MIN_RR_RATIO);
    }
  };


  return (
    <div className="bg-surface-light dark:bg-surface-dark p-2 sm:p-4 space-y-4 h-full overflow-y-auto text-text_primary-light dark:text-text_primary-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
      <h2 className="text-xl sm:text-2xl font-bold text-center text-primary dark:text-primary-light mb-3">Análise SMC/ICT para {asset} (M5)</h2>

      <Section title="Sinal da Estratégia SMC" className="!bg-opacity-50 dark:!bg-opacity-50">
        <div className={`p-3 rounded-md text-center font-semibold text-lg ${signalBgColor} ${signalTextColor}`}>
          <SignalIcon type={finalSignal.type} /> {displaySignalType(finalSignal.type)}
        </div>
        {finalSignal.confidenceScore && (
            <KeyValue label="Confiança do Sinal" value={finalSignal.confidenceScore} className="text-xs mt-1" />
        )}
        {finalSignal.killzone && finalSignal.killzone !== 'NONE' && (
            <KeyValue label="Killzone" value={finalSignal.killzone} className="text-xs" valueClassName={finalSignal.killzone === 'LONDON' ? 'text-purple-500' : 'text-orange-500'}/>
        )}
        <p className="text-xs sm:text-sm mt-2 whitespace-pre-wrap text-text_secondary-light dark:text_secondary-dark">{finalSignal.justification}</p>
        
        {(finalSignal.type !== 'NEUTRO' && finalSignal.type !== 'ERRO' && finalSignal.type !== 'AGUARDANDO_ENTRADA') && (
            <button
                onClick={handleDownloadSingleAnalysisPdf}
                disabled={isLoading || isScanning || isPerformingBacktest}
                className="mt-3 w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                title="Baixar Relatório de Análise Individual em PDF"
            >
                <DownloadIcon /> <span>Baixar Análise</span>
            </button>
        )}
      </Section>

      {(finalSignal.type !== 'NEUTRO' && finalSignal.type !== 'ERRO') && (
        <Section title="Níveis de Negociação Sugeridos (SMC)">
          {finalSignal.entry !== undefined ? (
            <KeyValue label="Entrada Sugerida" value={formatPrice(finalSignal.entry, asset)} valueClassName="font-bold text-blue-600 dark:text-blue-400" />
          ) : (
             <KeyValue label="Entrada Sugerida" value="Aguardando mitigação do POI" valueClassName="font-bold text-blue-600 dark:text-blue-400" />
          )}
          {finalSignal.poiUsed && (
            <KeyValue 
                label={`POI Alvo (${finalSignal.poiUsed.type} ${'startIndex' in finalSignal.poiUsed ? 'FVG' : 'OB'})`}
                value={`De ${formatPrice(finalSignal.poiUsed.bottom, asset)} a ${formatPrice(finalSignal.poiUsed.top, asset)}`}
                valueClassName={finalSignal.poiUsed.type === 'bullish' ? 'text-blue-500' : 'text-purple-500'}
            />
          )}
          <KeyValue label="Stop Loss Sugerido" value={formatPrice(finalSignal.stopLoss, asset)} valueClassName="font-bold text-danger" />
          <KeyValue label="Take Profit Sugerido" value={formatPrice(finalSignal.takeProfit, asset)} valueClassName="font-bold text-success" />
          <KeyValue label="Fonte dos Níveis" value={finalSignal.levelsSource || 'Estratégia SMC'} />
          <KeyValue label="Risco/Retorno Mínimo" value={`1:${SMC_STRATEGY_MIN_RR_RATIO.toFixed(1)}`} />
        </Section>
      )}

      <Section title="Análise Detalhada SMC/ICT">
        {renderSMC(smcAnalysis, asset)}
      </Section>

      <Section title="Contexto Técnico Geral">
        {renderTAContext(technicalIndicators, asset)}
      </Section>

      {lastCandle && (
          <Section title="Dados da Última Vela Analisada">
              {renderLastCandle(lastCandle, asset)}
          </Section>
      )}

      {strategyBacktestResult && (
        <Section title={`Resultado do Backtest da Estratégia SMC (${BACKTEST_PERIOD_DAYS} Dias)`}>
            {renderStrategyBacktestResult(strategyBacktestResult, asset)}
             {strategyBacktestResult.trades.length > 0 && (
                <button
                    onClick={handleDownloadBacktestPdf}
                    disabled={isLoading || isScanning || isPerformingBacktest}
                    className="mt-3 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                    title="Baixar Relatório de Backtest em PDF"
                >
                    <DownloadIcon /> <span>Baixar Relatório de Backtest</span>
                </button>
            )}
        </Section>
      )}

    </div>
  );
};

export default AnalysisPanel;
