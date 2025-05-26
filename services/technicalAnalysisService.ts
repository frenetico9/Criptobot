
import { Candle, TechnicalIndicators } from '../types';
import {
  // FIX: Use EMA_SHORT_PERIOD_DISPLAY and EMA_LONG_PERIOD_DISPLAY as EMA_SHORT_PERIOD and EMA_LONG_PERIOD are no longer exported
  EMA_SHORT_PERIOD_DISPLAY, EMA_LONG_PERIOD_DISPLAY, EMA_TREND_PERIOD, RSI_PERIOD,
  MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD,
  BBANDS_PERIOD, BBANDS_STDDEV, ATR_PERIOD,
  STOCH_K_PERIOD, STOCH_D_PERIOD, STOCH_SMOOTH_K, VOLUME_SMA_PERIOD,
  REVERSAL_CANDLE_WICK_BODY_RATIO, REVERSAL_CANDLE_MAX_OTHER_WICK_RATIO,
  PATTERN_BULLISH_ENGULFING, PATTERN_BEARISH_ENGULFING, PATTERN_HAMMER, PATTERN_SHOOTING_STAR
} from '../constants';

const calculateSMA = (data: number[], period: number): (number | undefined)[] => {
  if (period <= 0 || data.length < period) return Array(data.length).fill(undefined);
  const sma: (number | undefined)[] = Array(period - 1).fill(undefined);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  sma.push(sum / period);
  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period] + data[i];
    sma.push(sum / period);
  }
  return sma;
};

const calculateEMA = (data: number[], period: number): (number | undefined)[] => {
  if (period <= 0) return Array(data.length).fill(undefined);
  
  const ema: (number | undefined)[] = [];
  if (data.length === 0) return ema;

  if (data.length < period) {
      for(let j=0; j < data.length; j++) ema.push(undefined);
      return ema;
  }
  
  let sumForSma = 0;
  for (let i = 0; i < period; i++) {
    sumForSma += data[i];
    if (i < period -1) ema.push(undefined);
  }
  ema.push(sumForSma / period);


  const multiplier = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    const prevEma = ema[i-1];
    if(prevEma === undefined) {
        let tempSum = 0;
        let count = 0;
        for(let k = Math.max(0, i - period + 1); k <= i; k++){
            if(data[k] !== undefined) { 
                tempSum += data[k];
                count++;
            }
        }
        if(count === period) ema.push(tempSum/period);
        else ema.push(undefined);
        continue;
    }
    const currentEma = (data[i] - prevEma) * multiplier + prevEma;
    ema.push(currentEma);
  }
  return ema;
};

const calculateRSI = (data: number[], period: number): (number | undefined)[] => {
  if (period <= 0 || data.length < period + 1) return Array(data.length).fill(undefined);
  const rsi: (number | undefined)[] = Array(period).fill(undefined);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss; 
  rsi.push(100 - (100 / (1 + firstRS)));

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    if (change > 0) currentGain = change;
    else currentLoss = Math.abs(change);

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const currentRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    if(avgLoss === 0 && avgGain === 0 && rsi[i-1] !== undefined) rsi.push(rsi[i-1] as number); 
    else rsi.push(100 - (100 / (1 + currentRS)));
  }
  return rsi;
};

const calculateMACD = (
  data: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macdLine: (number | undefined)[]; signalLine: (number | undefined)[]; hist: (number | undefined)[]; } => {

  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);

  const macdLine: (number | undefined)[] = emaFast.map((val, idx) => {
    if (val === undefined || emaSlow[idx] === undefined) return undefined;
    return val - (emaSlow[idx] as number);
  });

  const validMacdValues = macdLine.filter(v => v !== undefined) as number[];
  let signalLineSegment = calculateEMA(validMacdValues, signalPeriod);

  const alignedSignalLine: (number | undefined)[] = Array(data.length).fill(undefined);
  let macdIndex = 0;
  for(let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== undefined) {
      if (macdIndex < signalLineSegment.length) {
        alignedSignalLine[i] = signalLineSegment[macdIndex];
      }
      macdIndex++;
    }
  }

  const hist: (number | undefined)[] = macdLine.map((val, idx) => {
    if (val === undefined || alignedSignalLine[idx] === undefined) return undefined;
    return val - (alignedSignalLine[idx] as number);
  });

  return { macdLine, signalLine: alignedSignalLine, hist };
};

const calculateBollingerBands = (data: number[], period: number, stdDevMultiplier: number):
{ upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[]; } => {
  if (period <= 0 || data.length < period) {
    const empty = Array(data.length).fill(undefined);
    return { upper: empty, middle: empty, lower: empty };
  }

  const middle = calculateSMA(data, period);
  const upper: (number | undefined)[] = Array(data.length).fill(undefined);
  const lower: (number | undefined)[] = Array(data.length).fill(undefined);

  for (let i = period - 1; i < data.length; i++) {
    if (middle[i] === undefined) continue;
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSqDiff += Math.pow(data[j] - (middle[i] as number), 2);
    }
    const stdDev = Math.sqrt(sumSqDiff / period);
    upper[i] = (middle[i] as number) + stdDev * stdDevMultiplier;
    lower[i] = (middle[i] as number) - stdDev * stdDevMultiplier;
  }
  return { upper, middle, lower };
};

const calculateATR = (candles: Candle[], period: number): (number | undefined)[] => {
  if (period <= 0 || candles.length < period) return Array(candles.length).fill(undefined);

  const trValues: number[] = [];
  if (candles.length === 0) return [];
  if (candles.length > 0) {
      trValues.push(candles[0].high - candles[0].low);
  }

  for (let i = 1; i < candles.length; i++) {
    const tr1 = candles[i].high - candles[i].low;
    const tr2 = Math.abs(candles[i].high - candles[i-1].close);
    const tr3 = Math.abs(candles[i].low - candles[i-1].close);
    trValues.push(Math.max(tr1, tr2, tr3));
  }

  const atr = calculateSMA(trValues, period); 

  const alignedAtr: (number | undefined)[] = Array(candles.length).fill(undefined);
  const atrOffset = candles.length - atr.length;
  for(let i=0; i<atr.length; i++){
      if(atrOffset + i < candles.length){
          alignedAtr[atrOffset + i] = atr[i];
      }
  }
  return alignedAtr; 
};

const calculateStochastic = (candles: Candle[], kPeriod: number, dPeriod: number, smoothK: number):
{ stochK: (number | undefined)[]; stochD: (number | undefined)[]; } => {
    if (kPeriod <= 0 || dPeriod <=0 || smoothK <=0 || candles.length < kPeriod) {
        const empty = Array(candles.length).fill(undefined);
        return { stochK: empty, stochD: empty };
    }

    const percentKRaw: (number | undefined)[] = Array(kPeriod - 1).fill(undefined);
    for (let i = kPeriod - 1; i < candles.length; i++) {
        let periodLow = Infinity;
        let periodHigh = -Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            periodLow = Math.min(periodLow, candles[j].low);
            periodHigh = Math.max(periodHigh, candles[j].high);
        }
        if (periodHigh === periodLow) {
            percentKRaw.push(percentKRaw[i-1] !== undefined ? percentKRaw[i-1] : 50);
        } else {
            percentKRaw.push(((candles[i].close - periodLow) / (periodHigh - periodLow)) * 100);
        }
    }

    const stochKIntermediate = calculateSMA(percentKRaw.filter(v => v !== undefined) as number[], smoothK);
    const alignedStochK: (number|undefined)[] = Array(candles.length).fill(undefined);
    let kIdx = 0;
    for(let i = 0; i < percentKRaw.length; i++) {
        if(percentKRaw[i] !== undefined) {
            if(kIdx < stochKIntermediate.length) {
                alignedStochK[i] = stochKIntermediate[kIdx];
            }
            kIdx++;
        }
    }

    const stochDIntermediate = calculateSMA(alignedStochK.filter(v => v !== undefined) as number[], dPeriod);
    const alignedStochD: (number|undefined)[] = Array(candles.length).fill(undefined);
    let dIdx = 0;
    for(let i = 0; i < alignedStochK.length; i++) {
        if(alignedStochK[i] !== undefined) {
            if(dIdx < stochDIntermediate.length) {
                alignedStochD[i] = stochDIntermediate[dIdx];
            }
            dIdx++;
        }
    }
    return { stochK: alignedStochK, stochD: alignedStochD };
};

const calculateCandlestickPatterns = (candles: Candle[]): number[] => {
    const patterns: number[] = Array(candles.length).fill(0);
    if (candles.length < 2) return patterns;

    for (let i = 1; i < candles.length; i++) {
        const prev = candles[i-1];
        const curr = candles[i];

        const prevBodyLow = Math.min(prev.open, prev.close);
        const prevBodyHigh = Math.max(prev.open, prev.close);
        const currBodyLow = Math.min(curr.open, curr.close);
        const currBodyHigh = Math.max(curr.open, curr.close);
        const currBodySize = Math.abs(curr.open - curr.close);
        const currUpperWick = curr.high - currBodyHigh;
        const currLowerWick = currBodyLow - curr.low;

        // Bullish Engulfing
        if (curr.close > curr.open && prev.close < prev.open && 
            currBodyHigh > prevBodyHigh && currBodyLow < prevBodyLow) {
            patterns[i] = PATTERN_BULLISH_ENGULFING;
        }
        // Bearish Engulfing
        else if (curr.close < curr.open && prev.close > prev.open && 
                 currBodyHigh > prevBodyHigh && currBodyLow < prevBodyLow) {
            patterns[i] = PATTERN_BEARISH_ENGULFING;
        }

        // Hammer (after a downtrend - simplified check: prev candle was bearish)
        // Small body, long lower wick, short upper wick
        if (currBodySize > 0 && prev.close < prev.open) { // Current has body, prev was bearish
            if (currLowerWick >= currBodySize * REVERSAL_CANDLE_WICK_BODY_RATIO &&
                currUpperWick <= currBodySize * REVERSAL_CANDLE_MAX_OTHER_WICK_RATIO) {
                 patterns[i] = PATTERN_HAMMER;
            }
        }

        // Shooting Star (after an uptrend - simplified check: prev candle was bullish)
        // Small body, long upper wick, short lower wick
        if (currBodySize > 0 && prev.close > prev.open) { // Current has body, prev was bullish
             if (currUpperWick >= currBodySize * REVERSAL_CANDLE_WICK_BODY_RATIO &&
                 currLowerWick <= currBodySize * REVERSAL_CANDLE_MAX_OTHER_WICK_RATIO) {
                 patterns[i] = PATTERN_SHOOTING_STAR;
            }
        }
    }
    return patterns;
};


export const calculateAllIndicators = (candles: Candle[]): TechnicalIndicators => {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const { macdLine, signalLine: macdSignal, hist: macdHist } = calculateMACD(closes, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD);
  const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = calculateBollingerBands(closes, BBANDS_PERIOD, BBANDS_STDDEV);
  const { stochK, stochD } = calculateStochastic(candles, STOCH_K_PERIOD, STOCH_D_PERIOD, STOCH_SMOOTH_K);

  return {
    // FIX: Use EMA_SHORT_PERIOD_DISPLAY and EMA_LONG_PERIOD_DISPLAY
    emaShort: calculateEMA(closes, EMA_SHORT_PERIOD_DISPLAY),
    emaLong: calculateEMA(closes, EMA_LONG_PERIOD_DISPLAY),
    emaTrend: calculateEMA(closes, EMA_TREND_PERIOD), // Added EMA Trend
    rsi: calculateRSI(closes, RSI_PERIOD),
    macdLine,
    macdSignal,
    macdHist,
    bbUpper,
    bbMiddle,
    bbLower,
    atr: calculateATR(candles, ATR_PERIOD),
    stochK,
    stochD,
    volumeSma: calculateSMA(volumes, VOLUME_SMA_PERIOD),
    engulfing: calculateCandlestickPatterns(candles), // Enhanced to include Hammer/Shooting Star
  };
};
