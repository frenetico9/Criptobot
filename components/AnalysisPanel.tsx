
import React from 'react';
import { AnalysisReport, Candle, FVG, SwingPoint, TradeSignalType, TechnicalIndicators } from '../types';
import { ArrowDownIcon, ArrowUpIcon, MinusSmallIcon, SparklesIcon, DownloadIcon } from './icons';
import { EMA_SHORT_PERIOD, EMA_LONG_PERIOD } from '../constants';
import { generatePdfReport } from '../services/pdfGenerator'; 
import { formatPrice as utilFormatPrice } from '../utils/formatters';


interface AnalysisPanelProps {
  report: AnalysisReport | null;
  isLoading?: boolean; 
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
    default:
      return <SparklesIcon className="text-gray-500 dark:text-gray-400 inline-block mr-2" />;
  }
};

const formatPrice = (price?: number, assetName?: string) => {
    return utilFormatPrice(price, assetName);
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`mb-4 p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-lg dark:shadow-black/25 ${className}`}>
    <h3 className="text-lg font-semibold text-primary dark:text-primary-light mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">{title}</h3>
    <div className="space-y-1">
        {children}
    </div>
  </div>
);

const KeyValue: React.FC<{ label: string; value: string | number | undefined; unit?: string; className?: string; valueClassName?: string }> = ({ label, value, unit, className, valueClassName }) => (
  <div className={`text-sm flex justify-between items-center py-0.5 ${className || ''}`}>
    <span className="font-medium text-text_secondary-light dark:text-text_secondary-dark">{label}: </span>
    <span className={`text-text_primary-light dark:text-text_primary-dark text-right ${valueClassName || ''}`}>
      {value !== undefined && value !== null ? `${value}${unit || ''}` : 'N/D'}
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

const renderTA = (ta: Partial<TechnicalIndicators>, assetName?: string) => {
    const lastRSI = Array.isArray(ta.rsi) && ta.rsi.length > 0 ? ta.rsi[0] : undefined;
    const lastMACDHist = Array.isArray(ta.macdHist) && ta.macdHist.length > 0 ? ta.macdHist[0] : undefined;
    const lastEMAShort = Array.isArray(ta.emaShort) && ta.emaShort.length > 0 ? ta.emaShort[0] : undefined;
    const lastEMALong = Array.isArray(ta.emaLong) && ta.emaLong.length > 0 ? ta.emaLong[0] : undefined;

    return (
        <>
            <KeyValue label={`MME Curta (${EMA_SHORT_PERIOD})`} value={formatPrice(lastEMAShort, assetName)} />
            <KeyValue label={`MME Longa (${EMA_LONG_PERIOD})`} value={formatPrice(lastEMALong, assetName)} />
            <KeyValue label="IFR (RSI)" value={lastRSI?.toFixed(2)} />
            <KeyValue label="MACD Histograma" value={formatPrice(lastMACDHist, assetName)} />
        </>
    );
};

const renderSMC = (smc: AnalysisReport['smcAnalysis'], assetName?: string) => (
    <>
        <KeyValue label="Pivô de Alta Recente" value={formatPrice(smc.recentSwingHigh, assetName)} />
        <KeyValue label="Pivô de Baixa Recente" value={formatPrice(smc.recentSwingLow, assetName)} />
        {smc.closestBullishFVG && (
            <KeyValue label="FVG Alta Próximo" value={`Topo: ${formatPrice(smc.closestBullishFVG.top, assetName)}, Base: ${formatPrice(smc.closestBullishFVG.bottom, assetName)}`} />
        )}
        {smc.closestBearishFVG && (
            <KeyValue label="FVG Baixa Próximo" value={`Topo: ${formatPrice(smc.closestBearishFVG.top, assetName)}, Base: ${formatPrice(smc.closestBearishFVG.bottom, assetName)}`} />
        )}
        <KeyValue label="FVGs Identificados" value={smc.fvgs.length} />
    </>
);


const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ report, isLoading }) => {
  if (!report) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark p-6 text-center text-text_secondary-light dark:text-text_secondary-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600 h-full flex items-center justify-center">
        Nenhum relatório de análise disponível. Selecione um ativo e clique em Analisar ou inicie uma varredura.
      </div>
    );
  }

  const { asset, lastCandle, technicalIndicators, smcAnalysis, finalSignal, backtestResult } = report;

  const displaySignalType = (type: TradeSignalType) => {
    return type.replace(/_/g, ' ').replace('FORTE', '(FORTE)');
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
  }

  const isStrongSignal = finalSignal.type === 'COMPRA_FORTE' || finalSignal.type === 'VENDA_FORTE';

  const handleDownloadPdf = () => {
    if (report) {
      generatePdfReport(report);
    }
  };


  return (
    <div className="bg-surface-light dark:bg-surface-dark p-2 sm:p-4 space-y-4 h-full overflow-y-auto text-text_primary-light dark:text-text_primary-dark rounded-lg shadow-xl dark:shadow-black/25 border border-gray-300 dark:border-gray-600">
      <h2 className="text-xl sm:text-2xl font-bold text-center text-primary dark:text-primary-light mb-3">Análise para {asset} (Estratégia MME Crossover)</h2>

      <Section title="Sinal Final Consolidado" className="!bg-opacity-50 dark:!bg-opacity-50">
        <div className={`p-3 rounded-md text-center font-semibold text-lg ${signalBgColor} ${signalTextColor}`}>
          <SignalIcon type={finalSignal.type} /> {displaySignalType(finalSignal.type)}
        </div>
        {finalSignal.confidenceScore && (
            <KeyValue label="Confiança do Sinal" value={finalSignal.confidenceScore} className="text-xs mt-1" />
        )}
        <p className="text-xs sm:text-sm mt-2 whitespace-pre-wrap text-text_secondary-light dark:text_secondary-dark">{finalSignal.justification}</p>
        
        {isStrongSignal && ( // PDF download can be always available or based on 'isStrongSignal' as per preference
            <button
                onClick={handleDownloadPdf}
                disabled={isLoading}
                className="mt-3 w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                title="Baixar Relatório em PDF"
            >
                <DownloadIcon className="w-4 h-4" />
                <span>Baixar Relatório PDF</span>
            </button>
        )}

        {finalSignal.details.length > 0 && (
            <div className="mt-2">
                <p className="text-xs font-semibold text-text_primary-light dark:text-text_primary-dark">Detalhes da Estratégia:</p>
                <ul className="list-disc list-inside text-xs text-text_secondary-light dark:text-text_secondary-dark">
                    {finalSignal.details.map((detail, i) => <li key={i}>{detail}</li>)}
                </ul>
            </div>
        )}
        {finalSignal.entry && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <KeyValue label="Entrada Sugerida" value={formatPrice(finalSignal.entry, asset)} valueClassName="font-bold text-blue-600 dark:text-blue-400" />
            <KeyValue label="Stop Loss Sugerido" value={formatPrice(finalSignal.stopLoss, asset)} valueClassName="font-bold text-red-600 dark:text-red-400" />
            <KeyValue label="Take Profit Sugerido" value={formatPrice(finalSignal.takeProfit, asset)} valueClassName="font-bold text-green-600 dark:text-green-400" />
            <KeyValue label="Fonte Níveis" value={finalSignal.levelsSource || 'N/D'} className="text-xs" valueClassName="italic text-text_secondary-light dark:text_text_secondary-dark"/>
          </div>
        )}
      </Section>

      {backtestResult && (
        <Section title="Resultado do Backtest (Sinal Simulado)">
            <p className="text-xs sm:text-sm whitespace-pre-wrap text-text_secondary-light dark:text-text_secondary-dark">{backtestResult}</p>
        </Section>
      )}

      <Section title="Dados da Vela Atual">{renderLastCandle(lastCandle, asset)}</Section>
      <Section title="Indicadores Técnicos (Estratégia Principal)">{renderTA(technicalIndicators, asset)}</Section>
      <Section title="Insights SMC/ICT (Contexto Adicional)">{renderSMC(smcAnalysis, asset)}</Section>

    </div>
  );
};

export default AnalysisPanel;