
import jsPDF from 'jspdf';
import { AnalysisReport, StrategyBacktestResult, BacktestTrade } from '../types'; 
import { formatPrice } from '../utils/formatters';
import { EMA_TREND_PERIOD, STRATEGY_RR_RATIO, BACKTEST_PERIOD_DAYS } from '../constants'; // Added BACKTEST_PERIOD_DAYS


const FONT_FAMILY_SANS = 'Helvetica'; 
const FONT_FAMILY_SERIF = 'Times-Roman'; 

const FONT_STYLES = {
    REGULAR: 'normal',
    BOLD: 'bold',
    ITALIC: 'italic',
};

const MARGIN = 15;
const LINE_HEIGHT_NORMAL = 7; 
const LINE_HEIGHT_SMALL = 6;  
const SECTION_SPACING = 8;
const PAGE_WIDTH = 210; 
const PAGE_HEIGHT = 297; 
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

let currentY = MARGIN; 

function resetY() {
    currentY = MARGIN;
}

function addPageIfNeeded(doc: jsPDF, spaceNeeded: number = LINE_HEIGHT_NORMAL * 2) {
  if (currentY + spaceNeeded > PAGE_HEIGHT - MARGIN * 1.5) { 
    doc.addPage();
    currentY = MARGIN;
  }
}

function setDocFont(doc: jsPDF, family: string, style: string, size: number) {
    doc.setFont(family, style);
    doc.setFontSize(size);
}

function addSectionTitle(doc: jsPDF, title: string, titleSize: number = 14, noTopMargin: boolean = false) {
  if (!noTopMargin) {
    addPageIfNeeded(doc, LINE_HEIGHT_NORMAL * 2.5 + (titleSize > 14 ? LINE_HEIGHT_NORMAL : 0) );
  } else {
    addPageIfNeeded(doc, LINE_HEIGHT_NORMAL * 1.5 + (titleSize > 14 ? LINE_HEIGHT_NORMAL : 0) );
  }
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, titleSize);
  doc.setTextColor(40, 40, 40); 
  doc.text(title, MARGIN, currentY);
  currentY += (LINE_HEIGHT_NORMAL * 0.8 * (titleSize/10)); 
  doc.setDrawColor(200, 200, 200); 
  doc.setLineWidth(0.3);
  doc.line(MARGIN, currentY, MARGIN + CONTENT_WIDTH, currentY);
  currentY += (LINE_HEIGHT_NORMAL * 0.7 * (titleSize/10));
  doc.setTextColor(0, 0, 0); 
}

function addKeyValue(doc: jsPDF, label: string, value: string | number | undefined, options: { valueColor?: string | [number, number, number], boldValue?: boolean, labelWidthFactor?: number, fontSize?: number } = {}) {
  const fontSize = options.fontSize || 10;
  const lineHeight = (fontSize / 10) * LINE_HEIGHT_NORMAL * 0.8;
  
  addPageIfNeeded(doc, lineHeight);
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, fontSize);
  doc.setTextColor(80, 80, 80); 
  
  const labelText = label + ': ';
  const effectiveLabelWidthFactor = options.labelWidthFactor || 0.4;
  const labelMaxWidth = CONTENT_WIDTH * effectiveLabelWidthFactor;
  const valueMaxWidth = CONTENT_WIDTH * (1 - effectiveLabelWidthFactor) - 2;

  const labelLines = doc.splitTextToSize(labelText, labelMaxWidth);
  doc.text(labelLines, MARGIN, currentY);
  
  const labelHeight = labelLines.length * lineHeight;

  if (options.boldValue) {
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, fontSize);
  } else {
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, fontSize);
  }
  
  doc.setTextColor(0,0,0); 
  if (options.valueColor) {
    if (typeof options.valueColor === 'string') {
        const rgb = hexToRgb(options.valueColor);
        if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b);
    } else {
        doc.setTextColor(options.valueColor[0], options.valueColor[1], options.valueColor[2]);
    }
  }

  const valueText = String(value ?? 'N/D');
  const valueLines = doc.splitTextToSize(valueText, valueMaxWidth);
  doc.text(valueLines, MARGIN + labelMaxWidth + 2, currentY);
  
  const valueHeight = valueLines.length * lineHeight;

  currentY += Math.max(labelHeight, valueHeight) + (fontSize / 10 * 2); 
  doc.setTextColor(0, 0, 0);
}

function addParagraph(doc: jsPDF, text: string | undefined, options: { isItalic?: boolean, fontSize?: number, color?: [number, number, number], family?: string, leftMargin?: number } = {}) {
  if (!text) return;
  const fontSize = options.fontSize || 10;
  const lineHeight = (fontSize / 10) * LINE_HEIGHT_NORMAL * 0.8; 
  const actualLeftMargin = options.leftMargin || MARGIN;
  const paragraphWidth = CONTENT_WIDTH - (actualLeftMargin - MARGIN);

  addPageIfNeeded(doc, lineHeight * 2); 

  setDocFont(doc, options.family || FONT_FAMILY_SANS, options.isItalic ? FONT_STYLES.ITALIC : FONT_STYLES.REGULAR, fontSize);
  if(options.color) {
    doc.setTextColor(options.color[0], options.color[1], options.color[2]);
  } else {
    doc.setTextColor(50,50,50); 
  }
  
  const lines = doc.splitTextToSize(text, paragraphWidth);
  doc.text(lines, actualLeftMargin, currentY);
  currentY += lines.length * lineHeight + (fontSize/10 * 2); 
  doc.setTextColor(0, 0, 0);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

const addDisclaimer = (doc: jsPDF) => {
    addPageIfNeeded(doc, LINE_HEIGHT_SMALL * 10); 
    if (PAGE_HEIGHT - currentY < LINE_HEIGHT_SMALL * 10 + MARGIN) { 
        doc.addPage();
        currentY = MARGIN;
    } else {
        currentY = Math.max(currentY + SECTION_SPACING, PAGE_HEIGHT - MARGIN - (LINE_HEIGHT_SMALL * 9));
    }

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 10);
    doc.setTextColor(120,120,120);
    doc.text('Aviso Legal Importante', MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.6;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, currentY, MARGIN + CONTENT_WIDTH, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.4;

    const disclaimerText = "Este relatório é gerado automaticamente e destina-se exclusivamente a fins educacionais e informativos. As informações aqui contidas não constituem aconselhamento financeiro, de investimento, legal ou tributário. O desempenho passado não é indicativo de resultados futuros. Qualquer decisão de investimento baseada neste relatório é de exclusiva responsabilidade do usuário. Negociar ou investir em criptomoedas e outros ativos financeiros envolve riscos significativos, incluindo a possibilidade de perda total do capital investido. Consulte um profissional financeiro qualificado antes de tomar qualquer decisão de investimento.";
    addParagraph(doc, disclaimerText, {fontSize: 8, isItalic: true, color: [150,150,150], family: FONT_FAMILY_SERIF});
}

const formatBRL_PDF = (value?: number) => {
    if (value === undefined || value === null) return 'N/D';
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

export const generatePdfReport = (report: AnalysisReport) => {
  const doc = new jsPDF();
  resetY();

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 18);
  doc.setTextColor(20, 80, 160); 
  doc.text('Relatório de Análise Técnica Avançada', PAGE_WIDTH / 2, currentY, { align: 'center' }); 
  currentY += LINE_HEIGHT_NORMAL * 1.5;

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
  doc.setTextColor(100, 100, 100); 
  doc.text(`Ativo: ${report.asset}`, MARGIN, currentY);
  const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em: ${reportDate}`, PAGE_WIDTH - MARGIN, currentY, { align: 'right' });
  currentY += SECTION_SPACING * 1.5;

  addSectionTitle(doc, 'Sinal Final Consolidado');
  let signalColorTuple: [number, number, number] = [0, 0, 0]; 
  if (report.finalSignal.type.includes('COMPRA')) signalColorTuple = [16, 185, 129]; 
  if (report.finalSignal.type.includes('VENDA')) signalColorTuple = [239, 68, 68];  
  if (report.finalSignal.type === 'NEUTRO') signalColorTuple = [245, 158, 11]; 

  addKeyValue(doc, 'Tipo de Sinal', report.finalSignal.type.replace(/_/g, ' '), { valueColor: signalColorTuple, boldValue: true });
  addKeyValue(doc, 'Confiança do Sinal', report.finalSignal.confidenceScore || 'N/D');
  addParagraph(doc, `Justificativa Principal: ${report.finalSignal.justification}`);
  
  if (report.finalSignal.details && report.finalSignal.details.length > 0) {
    currentY += LINE_HEIGHT_NORMAL * 0.3;
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 10);
    doc.setTextColor(70,70,70);
    addPageIfNeeded(doc);
    doc.text('Fatores de Contexto / Detalhes da Estratégia:', MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.8;
    report.finalSignal.details.forEach(detail => {
        let detailColor: [number, number, number] | undefined = undefined;
        if (detail.toLowerCase().startsWith('contexto ')) {
            if (detail.includes('ALTA') && detail.includes('Liquidez')) detailColor = [0, 100, 0]; 
            else if (detail.includes('BAIXA') && detail.includes('Liquidez')) detailColor = [180, 80, 0]; 
            else if (detail.includes('ALTA') && detail.includes('Volatilidade')) detailColor = [0, 0, 139]; 
        } else if (detail.toLowerCase().startsWith('filtro:') || detail.toLowerCase().includes('ignorado')) {
            detailColor = [200,0,0];
        }
        addParagraph(doc, `• ${detail}`, {fontSize: 9, color: detailColor, leftMargin: MARGIN + 3});
    });
    currentY += LINE_HEIGHT_NORMAL * 0.3;
  }

  if (report.finalSignal.entry !== undefined) {
    currentY += LINE_HEIGHT_NORMAL * 0.5;
    addKeyValue(doc, 'Entrada Sugerida', formatPrice(report.finalSignal.entry, report.asset), { boldValue: true, valueColor: [59, 130, 246]});
    addKeyValue(doc, 'Stop Loss Sugerido', formatPrice(report.finalSignal.stopLoss, report.asset), { boldValue: true, valueColor: [220, 38, 38] });
    addKeyValue(doc, 'Take Profit Sugerido', formatPrice(report.finalSignal.takeProfit, report.asset), { boldValue: true, valueColor: [5, 150, 105] });
    addKeyValue(doc, 'Fonte dos Níveis', report.finalSignal.levelsSource || 'N/A');
  }
  currentY += SECTION_SPACING;

  if (report.lastCandle) {
    addSectionTitle(doc, 'Dados da Última Vela Analisada');
    addKeyValue(doc, 'Horário da Vela', new Date(report.lastCandle.date).toLocaleString('pt-BR'));
    addKeyValue(doc, 'Abertura', formatPrice(report.lastCandle.open, report.asset));
    addKeyValue(doc, 'Máxima', formatPrice(report.lastCandle.high, report.asset));
    addKeyValue(doc, 'Mínima', formatPrice(report.lastCandle.low, report.asset));
    addKeyValue(doc, 'Fechamento', formatPrice(report.lastCandle.close, report.asset));
    addKeyValue(doc, 'Volume', report.lastCandle.volume.toLocaleString('pt-BR'));
    currentY += SECTION_SPACING;
  }

  addSectionTitle(doc, 'Indicadores Técnicos Chave (Última Vela)');
  const { technicalIndicators: ta, asset } = report;
  const lastEMAShort = Array.isArray(ta.emaShort) && ta.emaShort.length > 0 ? ta.emaShort[0] : undefined;
  const lastEMALong = Array.isArray(ta.emaLong) && ta.emaLong.length > 0 ? ta.emaLong[0] : undefined;
  const lastEMATrend = Array.isArray(ta.emaTrend) && ta.emaTrend.length > 0 ? ta.emaTrend[0] : undefined;
  const lastRSI = Array.isArray(ta.rsi) && ta.rsi.length > 0 ? ta.rsi[0] : undefined;
  const lastMACDHist = Array.isArray(ta.macdHist) && ta.macdHist.length > 0 ? ta.macdHist[0] : undefined;
  addKeyValue(doc, `MME Curta`, formatPrice(lastEMAShort, asset)); 
  addKeyValue(doc, `MME Longa`, formatPrice(lastEMALong, asset));
  addKeyValue(doc, `MME Tendência (${EMA_TREND_PERIOD})`, formatPrice(lastEMATrend, asset));
  addKeyValue(doc, 'IFR (RSI)', lastRSI?.toFixed(2));
  addKeyValue(doc, 'MACD Histograma', formatPrice(lastMACDHist, asset));
  currentY += SECTION_SPACING;

  addSectionTitle(doc, 'Análise SMC/ICT (Contexto)');
  const { smcAnalysis: smc } = report;
  addKeyValue(doc, 'Pivô de Alta Recente (Lookback)', formatPrice(smc.recentSwingHigh, asset));
  addKeyValue(doc, 'Pivô de Baixa Recente (Lookback)', formatPrice(smc.recentSwingLow, asset));
  if (smc.closestBullishFVG) {
    addKeyValue(doc, 'FVG de Alta Próximo (Abaixo Preço)', `Topo: ${formatPrice(smc.closestBullishFVG.top, asset)}, Base: ${formatPrice(smc.closestBullishFVG.bottom, asset)}`);
  } else {
    addKeyValue(doc, 'FVG de Alta Próximo (Abaixo Preço)', 'Nenhum relevante identificado');
  }
  if (smc.closestBearishFVG) {
    addKeyValue(doc, 'FVG de Baixa Próximo (Acima Preço)', `Topo: ${formatPrice(smc.closestBearishFVG.top, asset)}, Base: ${formatPrice(smc.closestBearishFVG.bottom, asset)}`);
  } else {
    addKeyValue(doc, 'FVG de Baixa Próximo (Acima Preço)', 'Nenhum relevante identificado');
  }
  currentY += SECTION_SPACING;
  
  addDisclaimer(doc);

  const filename = `Relatorio_Analise_Tecnica_${report.asset.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,16).replace(/[:T]/g, '-')}.pdf`;
  doc.save(filename);
};

const _addBacktestResultSummaryToDoc = (doc: jsPDF, result: StrategyBacktestResult, assetName: string, rrRatio: number) => {
    // Use result.periodDays directly as it's now correctly set in StrategyBacktestResult
    const startDateStr = result.startDate ? new Date(result.startDate).toLocaleDateString('pt-BR') : 'N/D';
    const endDateStr = result.endDate ? new Date(result.endDate).toLocaleDateString('pt-BR') : 'N/D';
    
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Ativo: ${assetName} | Período: ${result.periodDays} dias (${startDateStr} - ${endDateStr}) | RR Alvo: 1:${rrRatio}`, MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 1.5;

    addKeyValue(doc, 'Capital Inicial (BRL)', formatBRL_PDF(result.initialCapitalBRL), {fontSize: 9});
    addKeyValue(doc, 'Risco por Trade (BRL)', formatBRL_PDF(result.riskPerTradeBRL), {fontSize: 9});
    const finalCapColor = result.finalCapitalBRL > result.initialCapitalBRL ? [16, 185, 129] as [number,number,number] : result.finalCapitalBRL < result.initialCapitalBRL ? [239, 68, 68] as [number,number,number] : [0,0,0] as [number,number,number];
    addKeyValue(doc, 'Capital Final (BRL)', formatBRL_PDF(result.finalCapitalBRL), {fontSize: 9, valueColor: finalCapColor, boldValue: true});
    const pnlBRLColor = result.totalPnlBRL > 0 ? [16, 185, 129] as [number,number,number] : result.totalPnlBRL < 0 ? [239, 68, 68] as [number,number,number] : [0,0,0] as [number,number,number];
    addKeyValue(doc, 'Resultado Total (BRL)', formatBRL_PDF(result.totalPnlBRL), {fontSize: 9, valueColor: pnlBRLColor, boldValue: true});
    const returnColor = result.percentageReturn > 0 ? [16, 185, 129] as [number,number,number] : result.percentageReturn < 0 ? [239, 68, 68] as [number,number,number] : [0,0,0] as [number,number,number];
    addKeyValue(doc, 'Retorno sobre Capital', `${result.percentageReturn.toFixed(2)}%`, {fontSize: 9, valueColor: returnColor});
    addKeyValue(doc, 'Pico de Capital (BRL)', formatBRL_PDF(result.peakCapitalBRL), {fontSize: 9});
    addKeyValue(doc, 'Max Drawdown (BRL)', formatBRL_PDF(result.maxDrawdownBRL), {fontSize: 9, valueColor: [239, 68, 68]});
    addKeyValue(doc, 'Max Drawdown (%)', `${result.maxDrawdownPercentage.toFixed(2)}%`, {fontSize: 9, valueColor: [239, 68, 68]});
    currentY += SECTION_SPACING * 0.3;
    addKeyValue(doc, 'Sinais Gerados (Tentativas)', result.totalTradesAttempted, {fontSize: 9});
    addKeyValue(doc, 'Trades Ignorados (Filtros)', result.totalTradesIgnored || 0, {fontSize: 9});
    addKeyValue(doc, 'Trades Executados', result.totalTradesExecuted, {fontSize: 9});
    addKeyValue(doc, 'Trades Vencedores', result.winningTrades, {fontSize: 9, valueColor: [16, 185, 129]});
    addKeyValue(doc, 'Trades Perdedores', result.losingTrades, {fontSize: 9, valueColor: [239, 68, 68]});
    addKeyValue(doc, 'Taxa de Acerto (Executados)', `${result.winRateExecuted.toFixed(1)}%`, {fontSize: 9});
    addKeyValue(doc, 'Total PnL (Pontos)', result.totalPnlPoints.toFixed(assetName.toUpperCase().includes("BTC") ? 2 : 4), {fontSize: 9});
    addKeyValue(doc, 'Fator de Lucro (Pontos)', result.profitFactor?.toFixed(2) || 'N/A', {fontSize: 9});
      
    let summaryText = result.summaryMessage;
    if (!summaryText.includes("Nota: Gerenciamento dinâmico")) {
        summaryText += `\nNota: Gerenciamento dinâmico (ex: saída parcial em 1:1, trail stop para alvo 1:${STRATEGY_RR_RATIO}) é uma sugestão avançada para otimização manual. O alvo fixo 1:${STRATEGY_RR_RATIO} foi usado neste backtest automatizado.`;
    } else { 
        summaryText = summaryText.replace(/1:\d+(\.\d+)?/g, `1:${STRATEGY_RR_RATIO}`);
    }
    addParagraph(doc, `Sumário da Estratégia Aplicada: ${summaryText}`, {fontSize: 9, isItalic: true});
  
    if (result.error) {
      addParagraph(doc, `Erro no Backtest: ${result.error}`, {fontSize: 9, color: [200,0,0]});
    }
    currentY += SECTION_SPACING * 0.5;
};

const _addBacktestTradesTableToDoc = (doc: jsPDF, result: StrategyBacktestResult, assetName: string) => {
    const tableStartY = currentY;
    const cellPadding = 1;
    const tableLineHeight = LINE_HEIGHT_SMALL * 1.2; 
    const headerFontSize = 8;
    const cellFontSize = 7.5;
  
    const colWidths = {
      seq: 7, sinal: 12, inicioOp: 20, fimOp: 20, entrada: 14, sl: 14, tp: 14, saidaPx: 14, resultado: 12, pnlBRL: 15, motivo: 28 
    }; 
    
    const colHeaders = ["#", "Sinal", "Início", "Fim", "P.Entr", "P.SL", "P.TP", "P.Saída", "Res.", "PnL(BRL)", "Motivo"];
    const colKeys: (keyof BacktestTrade | 'seq')[] = ['seq', 'signalType', 'entryDate', 'exitDate', 'entryPrice', 'stopLossPrice', 'takeProfitPrice', 'exitPrice', 'result', 'pnlBRL', 'reasonForExit'];
  
    addPageIfNeeded(doc, tableLineHeight * 2);
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, headerFontSize);
    doc.setFillColor(230, 230, 230); 
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, tableLineHeight, 'F');
    
    let currentX = MARGIN;
    for (let i = 0; i < colHeaders.length; i++) {
      const key = Object.keys(colWidths)[i] as keyof typeof colWidths;
      doc.text(colHeaders[i], currentX + cellPadding, currentY + tableLineHeight - (cellPadding * 2.5), { align: 'left', maxWidth: colWidths[key] - (cellPadding * 2) });
      currentX += colWidths[key];
    }
    currentY += tableLineHeight;
  
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, cellFontSize);
    result.trades.forEach((trade, index) => {
      addPageIfNeeded(doc, tableLineHeight);
      currentX = MARGIN;
      
      if (index % 2 === 1 && trade.result !== 'IGNORED' && trade.result !== 'NO_TRIGGER') { 
        doc.setFillColor(245, 245, 245); 
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, tableLineHeight, 'F');
      } else if (trade.result === 'IGNORED' || trade.result === 'NO_TRIGGER') {
        doc.setFillColor(250, 250, 210); 
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, tableLineHeight, 'F');
      }
  
      for (let i = 0; i < colKeys.length; i++) {
        const colKey = colKeys[i];
        const colDefKey = Object.keys(colWidths)[i] as keyof typeof colWidths;
        let cellValue = '';
        let cellColor: [number,number,number] | undefined = undefined;
  
        if (colKey === 'seq') {
          cellValue = (index + 1).toString();
        } else if (colKey === 'entryDate' || colKey === 'exitDate') {
          const dateVal = trade[colKey as keyof BacktestTrade];
          cellValue = dateVal ? new Date(dateVal as string).toLocaleString('pt-BR', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit'}) : 'N/A';
        } else if (colKey === 'entryPrice' || colKey === 'stopLossPrice' || colKey === 'takeProfitPrice' || colKey === 'exitPrice') {
          cellValue = formatPrice(trade[colKey as keyof BacktestTrade] as number | undefined, assetName);
        } else if (colKey === 'pnlBRL') {
          const pnl = trade.pnlBRL;
          cellValue = pnl !== undefined ? formatBRL_PDF(pnl) : 'N/A';
          if (pnl !== undefined) {
              cellColor = pnl > 0 ? [16, 185, 129] : pnl < 0 ? [239, 68, 68] : [0,0,0];
          }
        } else if (colKey === 'result') {
          cellValue = trade.result;
          if (trade.result === 'WIN') cellColor = [16, 185, 129];
          else if (trade.result === 'LOSS') cellColor = [239, 68, 68];
          else if (trade.result === 'IGNORED' || trade.result === 'NO_TRIGGER') cellColor = [150,150,0]; 
        } else {
          cellValue = String(trade[colKey as keyof BacktestTrade] ?? 'N/A');
        }
        
        if (cellColor) doc.setTextColor(cellColor[0], cellColor[1], cellColor[2]);
        else doc.setTextColor(50,50,50);
  
        const textLines = doc.splitTextToSize(cellValue, colWidths[colDefKey] - (cellPadding * 2));
        const textHeight = textLines.length * (cellFontSize / 10 * LINE_HEIGHT_SMALL * 0.8);
        const yOffset = (tableLineHeight - textHeight) / 2 + (cellFontSize / 10 * LINE_HEIGHT_SMALL * 0.7);
        
        doc.text(textLines, currentX + cellPadding, currentY + yOffset);
        
        doc.setTextColor(0,0,0); 
        currentX += colWidths[colDefKey];
      }
      currentY += tableLineHeight;
    });
    currentY += SECTION_SPACING;
};


export const generateBacktestPdfReport = (result: StrategyBacktestResult, assetName: string) => {
  const doc = new jsPDF();
  resetY();

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 16);
  doc.setTextColor(20, 80, 160); 
  doc.text(`Relatório Detalhado de Backtest (${result.periodDays} Dias - Estratégia M15 Simplificada)`, PAGE_WIDTH / 2, currentY, { align: 'center' });
  currentY += LINE_HEIGHT_NORMAL * 0.5; 

  const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 8);
  doc.setTextColor(150, 150, 150); 
  doc.text(`Gerado em: ${reportDate}`, PAGE_WIDTH - MARGIN, currentY, { align: 'right' });
  currentY += LINE_HEIGHT_NORMAL * 0.8;


  addSectionTitle(doc, 'Resumo do Desempenho da Estratégia', 12);
  _addBacktestResultSummaryToDoc(doc, result, assetName, STRATEGY_RR_RATIO);

  addSectionTitle(doc, 'Detalhes das Operações', 12);
  _addBacktestTradesTableToDoc(doc, result, assetName);
  
  addDisclaimer(doc);

  const filename = `Relatorio_Backtest_Capital_${assetName.replace(/[^a-zA-Z0-9]/g, '_')}_${result.periodDays}d_${new Date().toISOString().slice(0,16).replace(/[:T]/g, '-')}.pdf`;
  doc.save(filename);
};


export const generateMultiAssetBacktestPdfReport = (
    allResults: StrategyBacktestResult[],
    initialCapital: number, // Kept for consistency if needed, but individual results have it
    riskPerTrade: number,   // Kept for consistency
    periodDays: number,     // Now passed explicitly, should match BACKTEST_PERIOD_DAYS from constants
    rrRatio: number
) => {
    const doc = new jsPDF();
    resetY();

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 20);
    doc.setTextColor(20, 80, 160);
    doc.text(`Relatório Consolidado de Backtest (${periodDays} Dias - M15 Simplificada)`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL * 2;

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 11);
    doc.setTextColor(80, 80, 80);
    doc.text(`Período de Backtest por Ativo: ${periodDays} dias`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Capital Inicial por Ativo: ${formatBRL_PDF(initialCapital)}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Risco por Operação: ${formatBRL_PDF(riskPerTrade)}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Relação Risco/Retorno Alvo: 1:${rrRatio}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Relatório Gerado em: ${reportDate}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += SECTION_SPACING * 2;

    let totalOverallPnlBRL = 0;
    let totalOverallTrades = 0;
    allResults.forEach(result => {
        totalOverallPnlBRL += result.totalPnlBRL;
        totalOverallTrades += result.totalTradesExecuted;
    });

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Resultados Agregados (${allResults.length} Ativos):`, MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.8;
    const overallPnlColor = totalOverallPnlBRL > 0 ? [16, 185, 129] as [number,number,number] : totalOverallPnlBRL < 0 ? [239, 68, 68] as [number,number,number] : [0,0,0] as [number,number,number];
    addKeyValue(doc, 'PnL Total Consolidado (BRL)', formatBRL_PDF(totalOverallPnlBRL), { valueColor: overallPnlColor, boldValue: true, fontSize: 11 });
    addKeyValue(doc, 'Total de Trades Executados (Consolidado)', totalOverallTrades.toString(), { fontSize: 11 });
    currentY += SECTION_SPACING;


    allResults.forEach((result, index) => {
        if (index > 0) {
            doc.addPage();
            currentY = MARGIN;
        }
        
        const assetDisplayName = result.assetId; 

        addSectionTitle(doc, `Resultados para: ${assetDisplayName}`, 14);
        _addBacktestResultSummaryToDoc(doc, result, assetDisplayName, rrRatio);
        
        if(result.trades && result.trades.length > 0){
            addSectionTitle(doc, 'Detalhes das Operações', 12, true);
            _addBacktestTradesTableToDoc(doc, result, assetDisplayName);
        } else {
            addParagraph(doc, "Nenhuma operação executada ou todas ignoradas para este ativo durante o período de backtest.", {fontSize: 10, isItalic: true});
            currentY += SECTION_SPACING;
        }
    });

    addDisclaimer(doc);

    const filename = `Relatorio_Multi_Backtest_Capital_${periodDays}d_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
};
