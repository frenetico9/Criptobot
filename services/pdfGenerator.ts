
import jsPDF from 'jspdf';
import { AnalysisReport } from '../types';
import { formatPrice } from '../utils/formatters';
import { 
    EMA_LONG_PERIOD, 
    EMA_SHORT_PERIOD, 
} from '../constants';

const FONT_FAMILY_SANS = 'Helvetica'; // Standard sans-serif font
const FONT_FAMILY_SERIF = 'Times-Roman'; // Standard serif font

// Define common font styles
const FONT_STYLES = {
    REGULAR: 'normal',
    BOLD: 'bold',
    ITALIC: 'italic',
};

const MARGIN = 15;
const LINE_HEIGHT_NORMAL = 7; // For 10pt font
const LINE_HEIGHT_SMALL = 6;  // For 8pt font
const SECTION_SPACING = 8;
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

let currentY = MARGIN; // Global Y position tracker for the current page

function resetY() {
    currentY = MARGIN;
}

function addPageIfNeeded(doc: jsPDF, spaceNeeded: number = LINE_HEIGHT_NORMAL * 2) {
  if (currentY + spaceNeeded > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    currentY = MARGIN;
  }
}

function setDocFont(doc: jsPDF, family: string, style: string, size: number) {
    doc.setFont(family, style);
    doc.setFontSize(size);
}

function addSectionTitle(doc: jsPDF, title: string) {
  addPageIfNeeded(doc, LINE_HEIGHT_NORMAL * 2.5);
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 14);
  doc.setTextColor(40, 40, 40); // Dark Gray
  doc.text(title, MARGIN, currentY);
  currentY += LINE_HEIGHT_NORMAL * 0.8; 
  doc.setDrawColor(200, 200, 200); // Light gray line
  doc.setLineWidth(0.3);
  doc.line(MARGIN, currentY, MARGIN + CONTENT_WIDTH, currentY);
  currentY += LINE_HEIGHT_NORMAL * 0.7;
  doc.setTextColor(0, 0, 0); // Reset to black
}

function addKeyValue(doc: jsPDF, label: string, value: string | number | undefined, options: { valueColor?: string | [number, number, number], boldValue?: boolean, labelWidthFactor?: number } = {}) {
  addPageIfNeeded(doc);
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
  doc.setTextColor(80, 80, 80); // Medium-dark gray for label
  
  const labelText = label + ': ';
  const effectiveLabelWidthFactor = options.labelWidthFactor || 0.4; 
  const labelMaxWidth = CONTENT_WIDTH * effectiveLabelWidthFactor;
  const valueMaxWidth = CONTENT_WIDTH * (1 - effectiveLabelWidthFactor) - 2;

  const labelLines = doc.splitTextToSize(labelText, labelMaxWidth);
  doc.text(labelLines, MARGIN, currentY);
  
  const labelHeight = labelLines.length * LINE_HEIGHT_NORMAL * 0.7;

  if (options.boldValue) {
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 10);
  } else {
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
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
  
  const valueHeight = valueLines.length * LINE_HEIGHT_NORMAL * 0.7;

  currentY += Math.max(labelHeight, valueHeight) + 2;
  doc.setTextColor(0, 0, 0); 
}

function addParagraph(doc: jsPDF, text: string | undefined, options: { isItalic?: boolean, fontSize?: number, color?: [number, number, number], family?: string } = {}) {
  if (!text) return;
  const fontSize = options.fontSize || 10;
  const lineHeight = (fontSize / 10) * LINE_HEIGHT_NORMAL * 0.8; 
  addPageIfNeeded(doc, lineHeight * 2); 

  setDocFont(doc, options.family || FONT_FAMILY_SANS, options.isItalic ? FONT_STYLES.ITALIC : FONT_STYLES.REGULAR, fontSize);
  if(options.color) {
    doc.setTextColor(options.color[0], options.color[1], options.color[2]);
  } else {
    doc.setTextColor(50,50,50); 
  }
  
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  doc.text(lines, MARGIN, currentY);
  currentY += lines.length * lineHeight + 2; 
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

export const generatePdfReport = (report: AnalysisReport) => {
  const doc = new jsPDF();
  resetY();

  // Header
  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 18);
  doc.setTextColor(20, 80, 160); // Primary Blue
  doc.text('Relatório de Análise Técnica', PAGE_WIDTH / 2, currentY, { align: 'center' });
  currentY += LINE_HEIGHT_NORMAL * 1.5;

  setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.REGULAR, 10);
  doc.setTextColor(100, 100, 100); // Medium gray
  doc.text(`Ativo: ${report.asset}`, MARGIN, currentY);
  const reportDate = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em: ${reportDate}`, PAGE_WIDTH - MARGIN, currentY, { align: 'right' });
  currentY += SECTION_SPACING * 1.5;

  // Sinal Final
  addSectionTitle(doc, 'Sinal Final Consolidado');
  let signalColorTuple: [number, number, number] = [0, 0, 0]; // Black
  if (report.finalSignal.type.includes('COMPRA')) signalColorTuple = [16, 185, 129]; // Success green rgb
  if (report.finalSignal.type.includes('VENDA')) signalColorTuple = [239, 68, 68];  // Danger red rgb
  if (report.finalSignal.type === 'NEUTRO') signalColorTuple = [245, 158, 11]; // Warning amber rgb

  addKeyValue(doc, 'Tipo de Sinal', report.finalSignal.type.replace(/_/g, ' '), { valueColor: signalColorTuple, boldValue: true });
  addKeyValue(doc, 'Confiança do Sinal', report.finalSignal.confidenceScore || 'N/D');
  addParagraph(doc, `Justificativa Principal: ${report.finalSignal.justification}`);
  if (report.finalSignal.entry !== undefined) {
    currentY += LINE_HEIGHT_NORMAL * 0.5;
    addKeyValue(doc, 'Entrada Sugerida', formatPrice(report.finalSignal.entry, report.asset), { boldValue: true, valueColor: [59, 130, 246]});
    addKeyValue(doc, 'Stop Loss Sugerido', formatPrice(report.finalSignal.stopLoss, report.asset), { boldValue: true, valueColor: [220, 38, 38] });
    addKeyValue(doc, 'Take Profit Sugerido', formatPrice(report.finalSignal.takeProfit, report.asset), { boldValue: true, valueColor: [5, 150, 105] });
    addKeyValue(doc, 'Fonte dos Níveis', report.finalSignal.levelsSource || 'N/A');
  }
  if(report.finalSignal.details.length > 0) {
    setDocFont(doc, FONT_FAMILY_SANS, FONT_STYLES.BOLD, 10);
    doc.setTextColor(80,80,80);
    doc.text('Detalhes da Estratégia:', MARGIN, currentY);
    currentY += LINE_HEIGHT_NORMAL * 0.8;
    report.finalSignal.details.forEach(detail => addParagraph(doc, `• ${detail}`, {fontSize: 9}));
  }
  currentY += SECTION_SPACING;

  // Vela Atual
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

  // Indicadores Técnicos
  addSectionTitle(doc, 'Indicadores Técnicos Chave (Última Vela)');
  const { technicalIndicators: ta, asset } = report;
  const lastEMAShort = Array.isArray(ta.emaShort) && ta.emaShort.length > 0 ? ta.emaShort[0] : undefined;
  const lastEMALong = Array.isArray(ta.emaLong) && ta.emaLong.length > 0 ? ta.emaLong[0] : undefined;
  const lastRSI = Array.isArray(ta.rsi) && ta.rsi.length > 0 ? ta.rsi[0] : undefined;
  const lastMACDHist = Array.isArray(ta.macdHist) && ta.macdHist.length > 0 ? ta.macdHist[0] : undefined;
  addKeyValue(doc, `MME Curta (${EMA_SHORT_PERIOD})`, formatPrice(lastEMAShort, asset));
  addKeyValue(doc, `MME Longa (${EMA_LONG_PERIOD})`, formatPrice(lastEMALong, asset));
  addKeyValue(doc, 'IFR (RSI)', lastRSI?.toFixed(2));
  addKeyValue(doc, 'MACD Histograma', formatPrice(lastMACDHist, asset));
  currentY += SECTION_SPACING;

  // Análise SMC/ICT
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

  // Disclaimer
  addPageIfNeeded(doc, LINE_HEIGHT_SMALL * 8); 
  
  if (PAGE_HEIGHT - currentY < LINE_HEIGHT_SMALL * 8 + MARGIN) { 
      doc.addPage();
      currentY = MARGIN;
  } else {
      currentY = Math.max(currentY, PAGE_HEIGHT - MARGIN - (LINE_HEIGHT_SMALL * 7)); 
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

  const filename = `Relatorio_Tecnico_${report.asset.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,16).replace(/[:T]/g, '-')}.pdf`;
  doc.save(filename);
};