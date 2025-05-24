
import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  ReferenceArea,
} from 'recharts';
import { ChartDatapoint, FVG, SwingPoint, TradeSignal } from '../types';
import { NUM_CANDLES_TO_DISPLAY, RSI_OVERBOUGHT, RSI_OVERSOLD, EMA_SHORT_PERIOD, EMA_LONG_PERIOD } from '../constants';

interface ChartDisplayProps {
  data: ChartDatapoint[];
  fvgs?: FVG[];
  swingHighs?: SwingPoint[];
  swingLows?: SwingPoint[];
  tradeSignal?: TradeSignal;
  assetName?: string;
}

// Custom shape renderer for candlesticks - More robust version
const CandleShapeRenderer = (props: any) => {
  const { x, width, yAxis, payload } = props; // `data` prop is also passed from <Bar> but not used directly here for individual candle rendering logic.

  // Basic validation for core props needed from Recharts
  if (!payload || typeof payload !== 'object' || 
      !yAxis || typeof yAxis.scale !== 'function' ||
      typeof x !== 'number' || !Number.isFinite(x) ||
      typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    // console.warn('CandleShapeRenderer: Invalid base props (x, width, yAxis, payload)', props);
    return null;
  }

  const { open, high, low, close } = payload;

  // Robust check for valid, finite numeric data for OHLC
  if (typeof open !== 'number' || !Number.isFinite(open) ||
      typeof high !== 'number' || !Number.isFinite(high) ||
      typeof low !== 'number' || !Number.isFinite(low) ||
      typeof close !== 'number' || !Number.isFinite(close)) {
    // console.warn('Candlestick data invalid or incomplete:', payload);
    return null;
  }

  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);

  // Check if scaling produced valid numbers
  if (!Number.isFinite(yOpen) || !Number.isFinite(yClose) || !Number.isFinite(yHigh) || !Number.isFinite(yLow)) {
    // console.warn('Candlestick y-scale results invalid:', {yOpen, yClose, yHigh, yLow});
    return null;
  }
  
  const isUp = close >= open;
  // Using hardcoded colors to remove CSS variable resolution as a potential issue
  const bodyFillColor = isUp ? "#26A69A" : "#EF5350"; // Teal Green / Red
  const wickStrokeColor = isUp ? "#26A69A" : "#EF5350";

  const bodyTopInPixels = Math.min(yOpen, yClose);
  const bodyHeightInPixels = Math.max(1.5, Math.abs(yOpen - yClose)); // Ensure minimum height

  // Simplified and robust bar width calculation
  const minBarWidth = 1; // Absolute minimum width
  const maxBarWidth = Math.max(minBarWidth, width * 0.9); // Cap at 90% of allocated slot, but allow it to be small if slot is small
  const actualBarWidth = Math.max(minBarWidth, Math.min(maxBarWidth, width * 0.7)); // Try for 70% of slot, clamped by min/max
  
  const barX = x + (width - actualBarWidth) / 2; // Center the bar in its allocated slot
  const wickX = x + width / 2; // Center of the allocated slot for the wick

  return (
    <g>
      {/* Wick */}
      <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} stroke={wickStrokeColor} strokeWidth={1} />
      {/* Body */}
      <rect x={barX} y={bodyTopInPixels} width={actualBarWidth} height={bodyHeightInPixels} fill={bodyFillColor} />
    </g>
  );
};


const ChartDisplay: React.FC<ChartDisplayProps> = ({
  data,
  fvgs = [],
  swingHighs = [],
  swingLows = [],
  tradeSignal,
  assetName
}) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark">Nenhum dado de gráfico disponível.</div>;
  }

  const chartData = data.slice(-NUM_CANDLES_TO_DISPLAY);

  const yAxisTickFormatter = (value: number) => {
    if (value === 0) return '0';
    if (assetName?.toUpperCase().includes('BTC') || Math.abs(value) > 10000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    if (Math.abs(value) < 0.01 && Math.abs(value) > 0) return value.toExponential(2);
    if (Math.abs(value) < 1) return value.toFixed(4);
    if (Math.abs(value) < 100) return value.toFixed(2);
    return Math.round(value).toLocaleString('pt-BR');
  };

  const dateTimeTickFormatter = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltipContent: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      if (!point) return null;
      const isBTC = assetName?.toUpperCase().includes('BTC');
      const priceFixedDigits = isBTC ? 2 : 4;

      return (
        <div className="bg-surface-light dark:bg-surface-dark p-3 shadow-lg rounded-md border border-gray-300 dark:border-gray-700 text-text_primary-light dark:text-text_primary-dark">
          <p className="text-sm font-semibold mb-1">{new Date(point.date).toLocaleString('pt-BR')}</p>
          <p className="text-xs">Abertura: <span className="font-medium">{point.open?.toFixed(priceFixedDigits)}</span></p>
          <p className="text-xs">Máxima: <span className="font-medium">{point.high?.toFixed(priceFixedDigits)}</span></p>
          <p className="text-xs">Mínima: <span className="font-medium">{point.low?.toFixed(priceFixedDigits)}</span></p>
          <p className="text-xs">Fechamento: <span className="font-medium">{point.close?.toFixed(priceFixedDigits)}</span></p>
          <p className="text-xs">Volume: <span className="font-medium">{point.volume?.toLocaleString('pt-BR')}</span></p>
          {point.emaShort && <p className="text-xs" style={{color: 'var(--tw-color-chart_sma_short)'}}>{`MME Curta (${EMA_SHORT_PERIOD})`}: {point.emaShort.toFixed(priceFixedDigits)}</p>}
          {point.emaLong && <p className="text-xs" style={{color: 'var(--tw-color-chart_sma_long)'}}>{`MME Longa (${EMA_LONG_PERIOD})`}: {point.emaLong.toFixed(priceFixedDigits)}</p>}
          {point.rsi && <p className="text-xs text-purple-500 dark:text-purple-400">IFR: {point.rsi.toFixed(2)}</p>}
        </div>
      );
    }
    return null;
  };

  const visibleDataForDomain = chartData.filter(d => d.low && d.high && Number.isFinite(d.low) && Number.isFinite(d.high));
  const priceLowValues = visibleDataForDomain.map(d => d.low);
  if (tradeSignal?.stopLoss !== undefined && Number.isFinite(tradeSignal.stopLoss)) priceLowValues.push(tradeSignal.stopLoss);

  const priceHighValues = visibleDataForDomain.map(d => d.high);
  if (tradeSignal?.takeProfit !== undefined && Number.isFinite(tradeSignal.takeProfit)) priceHighValues.push(tradeSignal.takeProfit);

  let minPrice = Math.min(...priceLowValues.filter(v => v !== undefined && v !== null && Number.isFinite(v)));
  let maxPrice = Math.max(...priceHighValues.filter(v => v !== undefined && v !== null && Number.isFinite(v)));
  
  if (!Number.isFinite(minPrice) && !Number.isFinite(maxPrice) && chartData.length > 0) {
      const firstClose = chartData[0]?.close;
      if (Number.isFinite(firstClose)) {
          minPrice = firstClose * 0.95;
          maxPrice = firstClose * 1.05;
      } else { 
          minPrice = 0;
          maxPrice = 100;
      }
  } else if (!Number.isFinite(minPrice) && Number.isFinite(maxPrice)) {
      minPrice = maxPrice * 0.9; 
  } else if (Number.isFinite(minPrice) && !Number.isFinite(maxPrice)) {
      maxPrice = minPrice * 1.1; 
  }


  const pricePadding = (maxPrice - minPrice) * 0.1 || 0.1;

  const priceDomain: [number | string, number | string] =
    (Number.isFinite(minPrice) && Number.isFinite(maxPrice))
    ? [Math.max(0, minPrice - pricePadding), maxPrice + pricePadding]
    : ['auto', 'auto'];


  const formatTradeLevelLabel = (value?: number) => {
      if (value === undefined || !Number.isFinite(value)) return '';
      const isBTC = assetName?.toUpperCase().includes('BTC');
      return value.toFixed(isBTC ? 2 : 4);
  }

  const tickColor = document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280';

  return (
    <div className="w-full h-[700px] p-1 sm:p-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow">
      <ResponsiveContainer width="100%" height="60%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={document.documentElement.classList.contains('dark') ? 0.15 : 0.25} />
          <XAxis dataKey="date" tickFormatter={dateTimeTickFormatter} interval="preserveStartEnd" minTickGap={50} tick={{ fill: tickColor, fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            orientation="left"
            domain={priceDomain}
            tickFormatter={yAxisTickFormatter}
            allowDataOverflow={true}
            tick={{ fill: tickColor, fontSize: 12 }}
          />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val.toLocaleString('pt-BR')} tick={{ fill: tickColor, fontSize: 12 }} />
          <Tooltip content={<CustomTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>

          <Bar
            yAxisId="left"
            dataKey="close" 
            name="Preço (Candles)"
            shape={<CandleShapeRenderer />} // Removed data={chartData} prop as it's not standard for shape and can be sourced from payload/context if needed by a more complex shape.
            isAnimationActive={false}
          />

          {chartData.some(d => d.emaShort !== undefined) && <Line yAxisId="left" type="monotone" dataKey="emaShort" stroke={'var(--tw-color-chart_sma_short)'} strokeWidth={1.5} dot={false} name={`MME Curta (${EMA_SHORT_PERIOD})`} />}
          {chartData.some(d => d.emaLong !== undefined) && <Line yAxisId="left" type="monotone" dataKey="emaLong" stroke={'var(--tw-color-chart_sma_long)'} strokeWidth={1.5} dot={false} name={`MME Longa (${EMA_LONG_PERIOD})`} />}

          
          {chartData.some(d => d.bbUpper !== undefined) && <Line yAxisId="left" type="monotone" dataKey="bbUpper" stroke={tickColor} strokeDasharray="3 3" strokeWidth={1} dot={false} name="BB Sup" legendType="none" />}
          {chartData.some(d => d.bbMiddle !== undefined) && <Line yAxisId="left" type="monotone" dataKey="bbMiddle" stroke={tickColor} strokeWidth={1} dot={false} name="BB Meio" legendType="none"/>}
          {chartData.some(d => d.bbLower !== undefined) && <Line yAxisId="left" type="monotone" dataKey="bbLower" stroke={tickColor} strokeDasharray="3 3" strokeWidth={1} dot={false} name="BB Inf" legendType="none"/>}

          {tradeSignal?.entry && Number.isFinite(tradeSignal.entry) && <ReferenceLine yAxisId="left" y={tradeSignal.entry} label={{ value: `Entrada: ${formatTradeLevelLabel(tradeSignal.entry)}`, position: 'insideRight', fill: '#3B82F6' }} stroke="#3B82F6" strokeDasharray="4 4" />}
          {tradeSignal?.stopLoss && Number.isFinite(tradeSignal.stopLoss) && <ReferenceLine yAxisId="left" y={tradeSignal.stopLoss} label={{ value: `SL: ${formatTradeLevelLabel(tradeSignal.stopLoss)}`, position: 'insideRight', fill: 'var(--tw-color-danger)' }} stroke={'var(--tw-color-danger)'} strokeDasharray="4 4" />}
          {tradeSignal?.takeProfit && Number.isFinite(tradeSignal.takeProfit) && <ReferenceLine yAxisId="left" y={tradeSignal.takeProfit} label={{ value: `TP: ${formatTradeLevelLabel(tradeSignal.takeProfit)}`, position: 'insideRight', fill: 'var(--tw-color-success)' }} stroke={'var(--tw-color-success)'} strokeDasharray="4 4" />}

          {fvgs.map((fvg, i) => {
             const fullDataFvgStartIndex = fvg.startIndex;
             const fullDataFvgEndIndex = fvg.endIndex;

             const chartFvgStartItem = chartData.find(cd => cd.date === data[fullDataFvgStartIndex]?.date);
             const chartFvgEndItem = chartData.find(cd => cd.date === data[fullDataFvgEndIndex]?.date);

             const x1Display = chartFvgStartItem ? chartData.indexOf(chartFvgStartItem) : -1;
             const x2Display = chartFvgEndItem ? chartData.indexOf(chartFvgEndItem) : -1;

             if (x1Display === -1 && x2Display === -1) return null; 

             const finalX1 = x1Display !== -1 ? x1Display : 0;
             const finalX2 = x2Display !== -1 ? x2Display : chartData.length -1;
             if (finalX1 > finalX2) return null; 
             if (!Number.isFinite(fvg.bottom) || !Number.isFinite(fvg.top)) return null;


             return (
                <ReferenceArea
                    key={`fvg-${i}`}
                    yAxisId="left"
                    x1={finalX1}
                    x2={finalX2}
                    y1={fvg.bottom}
                    y2={fvg.top}
                    strokeOpacity={0.4}
                    fillOpacity={0.2}
                    fill={fvg.type === 'bullish' ? "rgba(38, 166, 154, 0.2)" : "rgba(239, 83, 80, 0.2)"}
                    label={{value: fvg.type === 'bullish' ? 'FVG Alta' : 'FVG Baixa', fill: fvg.type === 'bullish' ? 'var(--tw-color-chart_green)' : 'var(--tw-color-chart_red)', fontSize: '10px', position: 'insideTopLeft'}}
                />
             );
          })}

          {swingHighs.map((sh, i) => {
             const candleIndexInChart = chartData.findIndex(d=> d.date === data[sh.index]?.date);
             if (candleIndexInChart === -1 || !Number.isFinite(sh.price)) return null;
             const yDomainMin = Array.isArray(priceDomain) && Number.isFinite(priceDomain[0]) ? priceDomain[0] as number : 0;
             const yDomainMax = Array.isArray(priceDomain) && Number.isFinite(priceDomain[1]) ? priceDomain[1] as number : sh.price * 1.1;
             const yDomainRange = yDomainMax - yDomainMin;
             if (isNaN(yDomainRange) || yDomainRange <=0) return null;
             return <ReferenceLine key={`sh-${i}`} yAxisId="left" x={candleIndexInChart} segment={[{x: candleIndexInChart, y: sh.price + yDomainRange *0.01 }]} label={{value: "PH", fill:"var(--tw-color-chart_red)", fontSize: '10px', position:"top"}} stroke={'var(--tw-color-chart_red)'} strokeDasharray="2 2" strokeWidth={1} ifOverflow="extendDomain" />;
          })}
          {swingLows.map((sl, i) => {
             const candleIndexInChart = chartData.findIndex(d=> d.date === data[sl.index]?.date);
             if (candleIndexInChart === -1 || !Number.isFinite(sl.price)) return null;
             const yDomainMin = Array.isArray(priceDomain) && Number.isFinite(priceDomain[0]) ? priceDomain[0] as number : sl.price * 0.9;
             const yDomainMax = Array.isArray(priceDomain) && Number.isFinite(priceDomain[1]) ? priceDomain[1] as number : 0;
             const yDomainRange = yDomainMax - yDomainMin;
             if (isNaN(yDomainRange) || yDomainRange <=0) return null;
             return <ReferenceLine key={`sl-${i}`} yAxisId="left" x={candleIndexInChart} segment={[{x: candleIndexInChart, y: sl.price - yDomainRange*0.01}]} label={{value: "PB", fill:"var(--tw-color-chart_green)", fontSize: '10px', position:"bottom"}} stroke={'var(--tw-color-chart_green)'} strokeDasharray="2 2" strokeWidth={1} ifOverflow="extendDomain" />;
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume Chart */}
      <ResponsiveContainer width="100%" height="12%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={document.documentElement.classList.contains('dark') ? 0.1 : 0.2} />
          <XAxis dataKey="date" tickFormatter={dateTimeTickFormatter} interval="preserveStartEnd" minTickGap={50} tick={{ fill: tickColor, fontSize: 12 }} />
          <YAxis yAxisId="left" orientation="left" tickFormatter={(val) => (val / 1000).toFixed(0) + 'k'} allowDataOverflow={true} tick={{ fill: tickColor, fontSize: 12 }}/>
          <Tooltip content={<CustomTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          <Bar yAxisId="left" dataKey="volume" name="Volume" barSize={5} isAnimationActive={false}>
            {chartData.map((entry, index) => (
                <rect key={`cell-vol-${index}`} fill={entry.close >= entry.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* RSI Chart */}
      <ResponsiveContainer width="100%" height="14%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={document.documentElement.classList.contains('dark') ? 0.1 : 0.2} />
          <XAxis dataKey="date" tickFormatter={dateTimeTickFormatter} interval="preserveStartEnd" minTickGap={50} tick={{ fill: tickColor, fontSize: 12 }}/>
          <YAxis yAxisId="left" orientation="left" domain={[0, 100]} allowDataOverflow={true} tick={{ fill: tickColor, fontSize: 12 }}/>
          <Tooltip content={<CustomTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          {chartData.some(d => d.rsi !== undefined) && <Line yAxisId="left" type="monotone" dataKey="rsi" stroke="#C084FC" dot={false} name="IFR" />}
          <ReferenceLine yAxisId="left" y={RSI_OVERBOUGHT} label={{ value: "SC", position: 'insideRight', fill: 'var(--tw-color-chart_red)' }} stroke={'var(--tw-color-chart_red)'} strokeDasharray="3 3" />
          <ReferenceLine yAxisId="left" y={RSI_OVERSOLD} label={{ value: "SV", position: 'insideRight', fill: 'var(--tw-color-chart_green)' }} stroke={'var(--tw-color-chart_green)'} strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* MACD Chart (kept for context) */}
      <ResponsiveContainer width="100%" height="14%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={document.documentElement.classList.contains('dark') ? 0.1 : 0.2} />
          <XAxis dataKey="date" tickFormatter={dateTimeTickFormatter} interval="preserveStartEnd" minTickGap={50} tick={{ fill: tickColor, fontSize: 12 }}/>
          <YAxis yAxisId="left" orientation="left" tickFormatter={yAxisTickFormatter} allowDataOverflow={true} tick={{ fill: tickColor, fontSize: 12 }}/>
          <Tooltip content={<CustomTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          {chartData.some(d => d.macdLine !== undefined) && <Line yAxisId="left" type="monotone" dataKey="macdLine" stroke="#82ca9d" dot={false} name="Linha MACD" legendType="none"/>}
          {chartData.some(d => d.macdSignal !== undefined) && <Line yAxisId="left" type="monotone" dataKey="macdSignal" stroke="#ffc658" dot={false} name="Linha Sinal" legendType="none"/>}
          {chartData.some(d => d.macdHist !== undefined) &&
            <Bar yAxisId="left" dataKey="macdHist" name="Histograma MACD" isAnimationActive={false} legendType="none">
              {chartData.map((entry, index) => (
                <rect key={`cell-macd-${index}`} fill={entry.macdHist && entry.macdHist > 0 ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)'} />
              ))}
            </Bar>
          }
          <ReferenceLine yAxisId="left" y={0} stroke={tickColor} strokeDasharray="2 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartDisplay;
