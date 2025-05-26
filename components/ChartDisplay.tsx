
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
  ReferenceArea,
} from 'recharts';
import { ChartDatapoint, FVG, SwingPoint, TradeSignal, MarketStructurePoint, OrderBlock, InducementPoint, SmcAnalysis } from '../types';
import { NUM_CANDLES_TO_DISPLAY, RSI_OVERBOUGHT, RSI_OVERSOLD, EMA_SHORT_PERIOD_DISPLAY, EMA_LONG_PERIOD_DISPLAY, EMA_TREND_PERIOD, LONDON_KILLZONE_UTC_START, LONDON_KILLZONE_UTC_END, NEWYORK_KILLZONE_UTC_START, NEWYORK_KILLZONE_UTC_END } from '../constants';

interface ChartDisplayProps {
  data: ChartDatapoint[];
  smcAnalysis?: SmcAnalysis; // Changed from individual fvgs, swingHighs, swingLows
  tradeSignal?: TradeSignal;
  assetName?: string;
}

// Custom shape renderer for candlesticks (no changes needed here unless style update)
const CandleShapeRenderer = (props: any) => {
  const { x, width, yAxis, payload } = props;
  if (!payload || !yAxis || typeof yAxis.scale !== 'function') {
    return null;
  }

  const { open, high, low, close } = payload;
  if ([open, high, low, close].some(val => typeof val !== 'number')) {
    return null;
  }

  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);

  const isUp = close >= open;
  const bodyColor = isUp ? 'var(--tw-color-chart_green)' : 'var(--tw-color-chart_red)';
  const wickColor = isUp ? 'var(--tw-color-chart_green)' : 'var(--tw-color-chart_red)';


  const bodyTopInPixels = Math.min(yOpen, yClose);
  const bodyHeightInPixels = Math.max(1.5, Math.abs(yOpen - yClose));

  const numDataPoints = props.data?.length || NUM_CANDLES_TO_DISPLAY;
  const maxBarWidth = 15;
  const minBarWidth = 2;

  const calculatedBarWidth = width * (numDataPoints > 100 ? 0.7 : 0.8);
  const actualBarWidth = Math.max(minBarWidth, Math.min(maxBarWidth, calculatedBarWidth));

  const barX = x + (width - actualBarWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g>
      <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} stroke={wickColor} strokeWidth={1} />
      <rect x={barX} y={bodyTopInPixels} width={actualBarWidth} height={bodyHeightInPixels} fill={bodyColor} />
    </g>
  );
};


const ChartDisplay: React.FC<ChartDisplayProps> = ({
  data,
  smcAnalysis,
  tradeSignal,
  assetName
}) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-text_secondary-light dark:text-text_secondary-dark">Nenhum dado de gráfico disponível.</div>;
  }

  const chartData = data.slice(-NUM_CANDLES_TO_DISPLAY);
  const fullDataStartIndex = Math.max(0, data.length - NUM_CANDLES_TO_DISPLAY);


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
          {point.emaShort && <p className="text-xs" style={{color: 'var(--tw-color-chart_sma_short)'}}>{`MME Curta (${EMA_SHORT_PERIOD_DISPLAY})`}: {point.emaShort.toFixed(priceFixedDigits)}</p>}
          {point.emaLong && <p className="text-xs" style={{color: 'var(--tw-color-chart_sma_long)'}}>{`MME Longa (${EMA_LONG_PERIOD_DISPLAY})`}: {point.emaLong.toFixed(priceFixedDigits)}</p>}
          {point.emaTrend && <p className="text-xs" style={{color: 'var(--tw-color-secondary-dark)'}}>{`MME Tend. (${EMA_TREND_PERIOD})`}: {point.emaTrend.toFixed(priceFixedDigits)}</p>}
          {point.rsi && <p className="text-xs text-purple-500 dark:text-purple-400">IFR: {point.rsi.toFixed(2)}</p>}
          {point.isLondonKillzone && <p className="text-xs text-purple-600 dark:text-purple-400">London Killzone</p>}
          {point.isNewYorkKillzone && <p className="text-xs text-orange-500 dark:text-orange-400">New York Killzone</p>}
        </div>
      );
    }
    return null;
  };

  const visibleDataForDomain = chartData.filter(d => d.low && d.high);
  const priceLowValues = visibleDataForDomain.map(d => d.low);
  if (tradeSignal?.stopLoss !== undefined) priceLowValues.push(tradeSignal.stopLoss);

  const priceHighValues = visibleDataForDomain.map(d => d.high);
  if (tradeSignal?.takeProfit !== undefined) priceHighValues.push(tradeSignal.takeProfit);

  const minPrice = Math.min(...priceLowValues.filter(v => v !== undefined && v !== null && isFinite(v)));
  const maxPrice = Math.max(...priceHighValues.filter(v => v !== undefined && v !== null && isFinite(v)));
  const pricePadding = (maxPrice - minPrice) * 0.1 || 0.1;
  const priceDomain: [number | string, number | string] =
    (isFinite(minPrice) && isFinite(maxPrice))
    ? [Math.max(0, minPrice - pricePadding), maxPrice + pricePadding]
    : ['auto', 'auto'];

  const formatTradeLevelLabel = (value?: number) => {
      if (value === undefined) return '';
      const isBTC = assetName?.toUpperCase().includes('BTC');
      return value.toFixed(isBTC ? 2 : 4);
  }

  const tickColor = document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280';

  const mapFullIndexToChartIndex = (fullIndex: number) => fullIndex - fullDataStartIndex;
  
  const londonKZColor = document.documentElement.classList.contains('dark') ? 'rgba(168, 85, 247, 0.07)' : 'rgba(168, 85, 247, 0.1)'; // purple
  const nyKZColor = document.documentElement.classList.contains('dark') ? 'rgba(249, 115, 22, 0.07)' : 'rgba(249, 115, 22, 0.1)';    // orange


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

          {/* Killzone ReferenceAreas */}
            {chartData.map((entry, index) => {
                 if (entry.isLondonKillzone) {
                    return <ReferenceArea key={`lkz-${index}`} yAxisId="left" x1={index} x2={index + 1} fill={londonKZColor} strokeOpacity={0} />;
                }
                if (entry.isNewYorkKillzone) {
                    return <ReferenceArea key={`nykz-${index}`} yAxisId="left" x1={index} x2={index + 1} fill={nyKZColor} strokeOpacity={0} />;
                }
                return null;
            })}


          <Bar yAxisId="left" dataKey="close" shape={<CandleShapeRenderer data={chartData} />} isAnimationActive={false} />

          {chartData[0]?.emaShort !== undefined && <Line yAxisId="left" type="monotone" dataKey="emaShort" stroke={'var(--tw-color-chart_sma_short)'} strokeWidth={1.5} dot={false} name={`MME Curta (${EMA_SHORT_PERIOD_DISPLAY})`} />}
          {chartData[0]?.emaLong !== undefined && <Line yAxisId="left" type="monotone" dataKey="emaLong" stroke={'var(--tw-color-chart_sma_long)'} strokeWidth={1.5} dot={false} name={`MME Longa (${EMA_LONG_PERIOD_DISPLAY})`} />}
          {chartData[0]?.emaTrend !== undefined && <Line yAxisId="left" type="monotone" dataKey="emaTrend" stroke={'var(--tw-color-secondary-dark)'} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name={`MME Tend. (${EMA_TREND_PERIOD})`} />}
          
          {/* SMC Visualizations */}
          {smcAnalysis?.marketStructurePoints?.map((ms, i) => {
             const chartIndex = mapFullIndexToChartIndex(ms.index);
             if (chartIndex < 0 || chartIndex >= chartData.length) return null;
             const color = ms.direction === 'bullish' ? 'var(--tw-color-success)' : 'var(--tw-color-danger)';
             return <ReferenceLine key={`ms-${i}`} yAxisId="left" x={chartIndex} y={ms.level} 
                        label={{ value: `${ms.type} ${ms.direction.slice(0,1).toUpperCase()}`, position: ms.direction === 'bullish' ? 'top' : 'bottom', fill: color, fontSize: '10px' }} 
                        stroke={color} strokeDasharray="2 2" strokeWidth={1.5} />;
          })}

          {smcAnalysis?.inducementPoints?.map((idm, i) => {
            const chartIndex = mapFullIndexToChartIndex(idm.index);
            if (chartIndex < 0 || chartIndex >= chartData.length) return null;
            const color = idm.isSwept ? 'var(--tw-color-primary)' : 'var(--tw-color-warning)';
            const labelText = `IDM ${idm.type === 'high' ? 'H' : 'L'} ${idm.isSwept ? '✓' : 'X'}`;
            return <ReferenceLine key={`idm-${i}`} yAxisId="left" x={chartIndex} segment={[{ x: chartIndex, y: idm.level }]} 
                        label={{ value: labelText, position: idm.type === 'high' ? 'top' : 'bottom', fill: color, fontSize: '10px' }}
                        stroke={color} strokeDasharray="4 4" strokeWidth={1} />;
          })}

          {smcAnalysis?.fvgs?.filter(fvg => !fvg.isMitigated || fvg.isPotentialPOI).map((fvg, i) => {
             const x1Display = mapFullIndexToChartIndex(fvg.startIndex);
             const x2Display = mapFullIndexToChartIndex(fvg.endIndex);
             if (x1Display >= chartData.length || x2Display < 0 || x1Display > x2Display) return null;
             const finalX1 = Math.max(0, x1Display);
             const finalX2 = Math.min(chartData.length -1, x2Display);

             return (
                <ReferenceArea
                    key={`fvg-${i}`}
                    yAxisId="left"
                    x1={finalX1}
                    x2={finalX2}
                    y1={fvg.bottom}
                    y2={fvg.top}
                    strokeOpacity={fvg.isPotentialPOI ? 0.7 : 0.4}
                    fillOpacity={fvg.isPotentialPOI ? 0.3 : 0.15}
                    fill={fvg.type === 'bullish' ? "rgba(38, 166, 154, 0.3)" : "rgba(239, 83, 80, 0.3)"}
                    stroke={fvg.type === 'bullish' ? "var(--tw-color-chart_green)" : "var(--tw-color-chart_red)"}
                    label={{value: `${fvg.type === 'bullish' ? 'FVG Buli' : 'FVG Bear'} ${fvg.isPotentialPOI ? '(POI)' : ''}`, fill: fvg.type === 'bullish' ? 'var(--tw-color-chart_green)' : 'var(--tw-color-chart_red)', fontSize: '9px', position: 'insideTopLeft'}}
                />
             );
          })}
          
          {smcAnalysis?.orderBlocks?.filter(ob => !ob.isMitigated || ob.isPotentialPOI).map((ob, i) => {
             const chartIndex = mapFullIndexToChartIndex(ob.index);
             if (chartIndex < 0 || chartIndex >= chartData.length) return null;
              return (
                <ReferenceArea
                    key={`ob-${i}`}
                    yAxisId="left"
                    x1={chartIndex} 
                    x2={chartIndex + 1} // Represent as a single candle width area
                    y1={ob.bottom}
                    y2={ob.top}
                    strokeOpacity={ob.isPotentialPOI ? 0.7 : 0.4}
                    fillOpacity={ob.isPotentialPOI ? 0.35 : 0.2}
                    fill={ob.type === 'bullish' ? "rgba(60, 100, 200, 0.35)" : "rgba(180, 80, 180, 0.35)"}
                    stroke={ob.type === 'bullish' ? "blue" : "purple"}
                    label={{value: `${ob.type === 'bullish' ? 'OB Buli' : 'OB Bear'} ${ob.isPotentialPOI ? '(POI)' : ''}`, fill: ob.type === 'bullish' ? 'blue' : 'purple', fontSize: '9px', position: 'insideTopRight'}}
                />
             );
          })}


          {tradeSignal?.entry && <ReferenceLine yAxisId="left" y={tradeSignal.entry} label={{ value: `Entrada: ${formatTradeLevelLabel(tradeSignal.entry)}`, position: 'insideRight', fill: '#3B82F6' }} stroke="#3B82F6" strokeDasharray="4 4" />}
          {tradeSignal?.stopLoss && <ReferenceLine yAxisId="left" y={tradeSignal.stopLoss} label={{ value: `SL: ${formatTradeLevelLabel(tradeSignal.stopLoss)}`, position: 'insideRight', fill: 'var(--tw-color-danger)' }} stroke={'var(--tw-color-danger)'} strokeDasharray="4 4" />}
          {tradeSignal?.takeProfit && <ReferenceLine yAxisId="left" y={tradeSignal.takeProfit} label={{ value: `TP: ${formatTradeLevelLabel(tradeSignal.takeProfit)}`, position: 'insideRight', fill: 'var(--tw-color-success)' }} stroke={'var(--tw-color-success)'} strokeDasharray="4 4" />}

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
          {chartData[0]?.rsi !== undefined && <Line yAxisId="left" type="monotone" dataKey="rsi" stroke="#C084FC" dot={false} name="IFR" />}
          <ReferenceLine yAxisId="left" y={RSI_OVERBOUGHT} label={{ value: "SC", position: 'insideRight', fill: 'var(--tw-color-chart_red)' }} stroke={'var(--tw-color-chart_red)'} strokeDasharray="3 3" />
          <ReferenceLine yAxisId="left" y={RSI_OVERSOLD} label={{ value: "SV", position: 'insideRight', fill: 'var(--tw-color-chart_green)' }} stroke={'var(--tw-color-chart_green)'} strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* MACD Chart */}
      <ResponsiveContainer width="100%" height="14%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={document.documentElement.classList.contains('dark') ? 0.1 : 0.2} />
          <XAxis dataKey="date" tickFormatter={dateTimeTickFormatter} interval="preserveStartEnd" minTickGap={50} tick={{ fill: tickColor, fontSize: 12 }}/>
          <YAxis yAxisId="left" orientation="left" tickFormatter={yAxisTickFormatter} allowDataOverflow={true} tick={{ fill: tickColor, fontSize: 12 }}/>
          <Tooltip content={<CustomTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          {chartData[0]?.macdLine !== undefined && <Line yAxisId="left" type="monotone" dataKey="macdLine" stroke="#82ca9d" dot={false} name="Linha MACD" legendType="none"/>}
          {chartData[0]?.macdSignal !== undefined && <Line yAxisId="left" type="monotone" dataKey="macdSignal" stroke="#ffc658" dot={false} name="Linha Sinal" legendType="none"/>}
          {chartData[0]?.macdHist !== undefined &&
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
