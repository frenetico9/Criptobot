
import jsPDF from 'jspdf';
import { AnalysisReport, StrategyBacktestResult, BacktestTrade, SmcAnalysis, MarketStructurePoint, FVG, OrderBlock, InducementPoint, KillzoneSession } from '../types'; 
import { formatPrice } from '../utils/formatters';
import { EMA_TREND_PERIOD, SMC_STRATEGY_MIN_RR_RATIO, BACKTEST_PERIOD_DAYS } from '../constants';


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
  const effectiveLabelWidthFactor = options.labelWidthFactor || 0.45; // Adjusted for potentially longer SMC labels
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
  doc.text('Relatório de Análise Técnica SMC/ICT', PAGE_WIDTH / 2, currentY, { align: 'center' }); 
  currentY += LINE_HEIGHT_NORMAL * 1.5;

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
  doc.setTextColor(100, 100, 100); 
  doc.text(`Ativo: ${report.asset}`, MARGIN, currentY);
  const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em: ${reportDate}`, PAGE_WIDTH - MARGIN, currentY, { align: 'right' });
  currentY += SECTION_SPACING * 1.5;

  // Main Signal Section
  addSectionTitle(doc, 'Sinal da Estratégia SMC/ICT');
  let signalColorTuple: [number, number, number] = [0, 0, 0]; 
  if (report.finalSignal.type.includes('COMPRA')) signalColorTuple = [16, 185, 129]; 
  else if (report.finalSignal.type.includes('VENDA')) signalColorTuple = [239, 68, 68];  
  else if (report.finalSignal.type === 'NEUTRO') signalColorTuple = [245, 158, 11]; 
  else if (report.finalSignal.type === 'AGUARDANDO_ENTRADA') signalColorTuple = [59, 130, 246];

  addKeyValue(doc, 'Tipo de Sinal', report.finalSignal.type.replace(/_/g, ' '), { valueColor: signalColorTuple, boldValue: true });
  addKeyValue(doc, 'Confiança do Sinal', report.finalSignal.confidenceScore || 'N/D');
  if(report.finalSignal.killzone && report.finalSignal.killzone !== 'NONE') {
    addKeyValue(doc, 'Killzone', report.finalSignal.killzone, { valueColor: (report.finalSignal.killzone === 'LONDON' ? [128,0,128] : [255,165,0])});
  }
  addParagraph(doc, `Justificativa Principal: ${report.finalSignal.justification}`);
  
  if (report.finalSignal.details && report.finalSignal.details.length > 0) {
    currentY += LINE_HEIGHT_NORMAL * 0.3;
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 10);
    doc.setTextColor(70,70,70);
    addPageIfNeeded(doc);
    doc.text('Contexto e Detalhes da Estratégia SMC:', MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.8;
    report.finalSignal.details.forEach(detail => {
        // Basic color coding for details, can be expanded
        let detailColor: [number, number, number] | undefined = undefined;
        if (detail.toLowerCase().includes('killzone') && (detail.includes('LONDON') || detail.includes('NEWYORK'))) detailColor = [0, 100, 0]; 
        if (detail.toLowerCase().includes('varrido ✓')) detailColor = [16, 185, 129];
        if (detail.toLowerCase().includes('aguardando x')) detailColor = [245, 158, 11];
        addParagraph(doc, `• ${detail}`, {fontSize: 9, color: detailColor, leftMargin: MARGIN + 3});
    });
    currentY += LINE_HEIGHT_NORMAL * 0.3;
  }

  if (report.finalSignal.entry !== undefined || report.finalSignal.type === 'AGUARDANDO_ENTRADA') {
    currentY += LINE_HEIGHT_NORMAL * 0.5;
    if (report.finalSignal.type !== 'AGUARDANDO_ENTRADA') {
        addKeyValue(doc, 'Entrada Sugerida', formatPrice(report.finalSignal.entry, report.asset), { boldValue: true, valueColor: [59, 130, 246]});
    }
    if(report.finalSignal.poiUsed) {
        const poi = report.finalSignal.poiUsed;
        const poiType = 'startIndex' in poi ? 'FVG' : 'OB';
        addKeyValue(doc, `POI Alvo (${poi.type} ${poiType})`, `De ${formatPrice(poi.bottom, report.asset)} a ${formatPrice(poi.top, report.asset)}`);
    }
    addKeyValue(doc, 'Stop Loss Sugerido', formatPrice(report.finalSignal.stopLoss, report.asset), { boldValue: true, valueColor: [220, 38, 38] });
    addKeyValue(doc, 'Take Profit Sugerido', formatPrice(report.finalSignal.takeProfit, report.asset), { boldValue: true, valueColor: [5, 150, 105] });
    addKeyValue(doc, 'Fonte dos Níveis', report.finalSignal.levelsSource || 'SMC Strategy');
    addKeyValue(doc, 'Risco/Retorno Alvo', `1:${SMC_STRATEGY_MIN_RR_RATIO.toFixed(1)}`);
  }
  currentY += SECTION_SPACING;

  // SMC Analysis Section
  addSectionTitle(doc, 'Análise Detalhada SMC/ICT');
  const { smcAnalysis: smc, asset } = report;
  const lastMSS = smc.marketStructurePoints.filter(p => p.type === 'CHoCH' || p.type === 'BOS').pop();
  if (lastMSS) {
    addKeyValue(doc, `Última Estrutura (${lastMSS.type})`, `${lastMSS.direction} @ ${formatPrice(lastMSS.level, asset)} (${new Date(lastMSS.date).toLocaleTimeString('pt-BR')})`, {valueColor: lastMSS.direction === 'bullish' ? [16,185,129] : [239,68,68]});
  }
  const lastIDM = smc.inducementPoints.pop();
  if (lastIDM) {
     addKeyValue(doc, `Inducement (${lastIDM.type})`, `${formatPrice(lastIDM.level, asset)} ${lastIDM.isSwept ? '(Varrido ✓)' : '(Aguardando X)'}`, {valueColor: lastIDM.isSwept ? [16,185,129] : [245,158,11]});
  }
  // List a few key unmitigated POIs
  const unmitigatedBullishFVGs = smc.fvgs.filter(f => f.type === 'bullish' && !f.isMitigated).slice(0,2);
  unmitigatedBullishFVGs.forEach((fvg, i) => addKeyValue(doc, `FVG Bullish #${i+1}`, `De ${formatPrice(fvg.bottom, asset)} a ${formatPrice(fvg.top, asset)}`));
  const unmitigatedBearishFVGs = smc.fvgs.filter(f => f.type === 'bearish' && !f.isMitigated).slice(0,2);
  unmitigatedBearishFVGs.forEach((fvg, i) => addKeyValue(doc, `FVG Bearish #${i+1}`, `De ${formatPrice(fvg.bottom, asset)} a ${formatPrice(fvg.top, asset)}`));
  currentY += SECTION_SPACING;


  // Last Candle Data Section
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

  // General TA Context Section (Simplified)
  addSectionTitle(doc, 'Contexto Técnico Geral (Indicadores)');
  const { technicalIndicators: ta } = report;
  const lastEMATrend = Array.isArray(ta.emaTrend) && ta.emaTrend.length > 0 ? ta.emaTrend[0] : undefined;
  const lastRSI = Array.isArray(ta.rsi) && ta.rsi.length > 0 ? ta.rsi[0] : undefined;
  addKeyValue(doc, `MME Tendência (${EMA_TREND_PERIOD})`, formatPrice(lastEMATrend, asset));
  addKeyValue(doc, 'IFR (RSI)', lastRSI?.toFixed(2));
  currentY += SECTION_SPACING;
  
  addDisclaimer(doc);

  const filename = `Relatorio_SMC_ICT_${report.asset.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,16).replace(/[:T]/g, '-')}.pdf`;
  doc.save(filename);
};

const _addBacktestResultSummaryToDoc = (doc: jsPDF, result: StrategyBacktestResult, assetName: string, rrRatio: number) => {
    const startDateStr = result.startDate ? new Date(result.startDate).toLocaleDateString('pt-BR') : 'N/D';
    const endDateStr = result.endDate ? new Date(result.endDate).toLocaleDateString('pt-BR') : 'N/D';
    
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Ativo: ${assetName} | Período: ${result.periodDays} dias (${startDateStr} - ${endDateStr}) | RR Alvo: 1:${rrRatio.toFixed(1)}`, MARGIN, currentY);
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
    addKeyValue(doc, 'Trades Ignorados (Filtros/Sem Entrada)', result.totalTradesIgnored || 0, {fontSize: 9});
    addKeyValue(doc, 'Trades Executados', result.totalTradesExecuted, {fontSize: 9});
    addKeyValue(doc, 'Trades Vencedores', result.winningTrades, {fontSize: 9, valueColor: [16, 185, 129]});
    addKeyValue(doc, 'Trades Perdedores', result.losingTrades, {fontSize: 9, valueColor: [239, 68, 68]});
    addKeyValue(doc, 'Taxa de Acerto (Executados)', `${result.winRateExecuted.toFixed(1)}%`, {fontSize: 9});
    addKeyValue(doc, 'Total PnL (Pontos)', result.totalPnlPoints.toFixed(assetName.toUpperCase().includes("BTC") ? 2 : 4), {fontSize: 9});
    addKeyValue(doc, 'Fator de Lucro (Pontos)', result.profitFactor?.toFixed(2) || 'N/A', {fontSize: 9});
      
    let summaryText = result.summaryMessage;
    if (!summaryText.includes("Nota: Estratégia SMC/ICT")) { // Add note if not present
        summaryText += `\nNota: Estratégia SMC/ICT aplicada com foco em Quebra de Estrutura, Inducement e entrada em POIs (FVG/OB). RR Alvo de 1:${rrRatio.toFixed(1)}.`;
    } else { // Ensure RR is updated
        summaryText = summaryText.replace(/RR Alvo de 1:\d+(\.\d+)?/g, `RR Alvo de 1:${rrRatio.toFixed(1)}`);
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


export const generateBacktestPdfReport = (result: StrategyBacktestResult, assetName: string, rrRatio: number = SMC_STRATEGY_MIN_RR_RATIO) => {
  const doc = new jsPDF();
  resetY();

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 16);
  doc.setTextColor(20, 80, 160); 
  doc.text(`Relatório Detalhado de Backtest (${result.periodDays} Dias - Estratégia SMC/ICT)`, PAGE_WIDTH / 2, currentY, { align: 'center' });
  currentY += LINE_HEIGHT_NORMAL * 0.5; 

  const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 8);
  doc.setTextColor(150, 150, 150); 
  doc.text(`Gerado em: ${reportDate}`, PAGE_WIDTH - MARGIN, currentY, { align: 'right' });
  currentY += LINE_HEIGHT_NORMAL * 0.8;


  addSectionTitle(doc, 'Resumo do Desempenho da Estratégia SMC/ICT', 12);
  _addBacktestResultSummaryToDoc(doc, result, assetName, rrRatio);

  addSectionTitle(doc, 'Detalhes das Operações', 12);
  _addBacktestTradesTableToDoc(doc, result, assetName);
  
  addDisclaimer(doc);

  const filename = `Relatorio_Backtest_SMC_${assetName.replace(/[^a-zA-Z0-9]/g, '_')}_${result.periodDays}d_${new Date().toISOString().slice(0,16).replace(/[:T]/g, '-')}.pdf`;
  doc.save(filename);
};


export const generateMultiAssetBacktestPdfReport = (
    allResults: StrategyBacktestResult[],
    initialCapital: number,
    riskPerTrade: number,
    periodDays: number, // This is now correctly passed and should be used
    rrRatio: number     // This is now correctly passed for SMC
) => {
    const doc = new jsPDF();
    resetY();

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 20);
    doc.setTextColor(20, 80, 160);
    doc.text(`Relatório Consolidado de Backtest SMC/ICT (${periodDays} Dias)`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL * 2;

    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 11);
    doc.setTextColor(80, 80, 80);
    doc.text(`Período de Backtest por Ativo: ${periodDays} dias`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Capital Inicial por Ativo: ${formatBRL_PDF(initialCapital)}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Risco por Operação: ${formatBRL_PDF(riskPerTrade)}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += LINE_HEIGHT_NORMAL;
    doc.text(`Relação Risco/Retorno Alvo (SMC): 1:${rrRatio.toFixed(1)}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
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
    doc.text(`Resultados Agregados (${allResults.length} Ativos - Estratégia SMC/ICT):`, MARGIN, currentY);
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

        addSectionTitle(doc, `Resultados SMC/ICT para: ${assetDisplayName}`, 14);
        _addBacktestResultSummaryToDoc(doc, result, assetDisplayName, rrRatio); // Pass rrRatio
        
        if(result.trades && result.trades.length > 0){
            addSectionTitle(doc, 'Detalhes das Operações', 12, true);
            _addBacktestTradesTableToDoc(doc, result, assetDisplayName);
        } else {
            addParagraph(doc, "Nenhuma operação executada ou todas ignoradas para este ativo durante o período de backtest SMC/ICT.", {fontSize: 10, isItalic: true});
            currentY += SECTION_SPACING;
        }
    });

    addDisclaimer(doc);

    const filename = `Relatorio_Multi_Backtest_SMC_${periodDays}d_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
};
