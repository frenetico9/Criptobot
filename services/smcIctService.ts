
import { Candle, FVG, SmcAnalysis, SwingPoint } from '../types';
import { SMC_LOOKBACK_PERIOD_CANDLES, SMC_FVG_MIN_ATR_FACTOR } from '../constants';

export const analyzeSMC = (candles: Candle[], atrValues?: number[]): SmcAnalysis => {
  const fvgs: FVG[] = [];
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];

  if (candles.length < 3) {
    return { fvgs, swingHighs, swingLows };
  }

  const defaultAtr = candles.length > 0 ? (candles[candles.length-1].high - candles[candles.length-1].low) * 0.1 : 0.001;

  // Identify FVGs
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Middle candle, not used for FVG boundary
    const c3 = candles[i];
    const currentAtr = atrValues && atrValues[i] !== undefined ? atrValues[i] : defaultAtr;
    const minFvgSize = currentAtr * SMC_FVG_MIN_ATR_FACTOR;

    // Bullish FVG (Gap between c1.high and c3.low)
    if (c1.high < c3.low) {
      const fvgTop = c3.low;
      const fvgBottom = c1.high;
       // Check if candle 2 (middle candle) didn't fill it (simplified: its body is outside the gap)
      const c2BodyLow = Math.min(c2.open, c2.close);
      const c2BodyHigh = Math.max(c2.open, c2.close);

      if (fvgTop - fvgBottom >= minFvgSize && !(c2BodyLow < fvgTop && c2BodyHigh > fvgBottom)) {
         fvgs.push({ type: 'bullish', top: fvgTop, bottom: fvgBottom, mid: (fvgTop + fvgBottom) / 2, startIndex: i-2, endIndex: i });
      }
    }

    // Bearish FVG (Gap between c1.low and c3.high)
    if (c1.low > c3.high) {
      const fvgTop = c1.low;
      const fvgBottom = c3.high;
      const c2BodyLow = Math.min(c2.open, c2.close);
      const c2BodyHigh = Math.max(c2.open, c2.close);

      if (fvgTop - fvgBottom >= minFvgSize && !(c2BodyLow < fvgTop && c2BodyHigh > fvgBottom)) {
        fvgs.push({ type: 'bearish', top: fvgTop, bottom: fvgBottom, mid: (fvgTop + fvgBottom) / 2, startIndex: i-2, endIndex: i });
      }
    }
  }

  // Identify Swing Highs/Lows (simple version: local max/min in a 3-candle window)
  // More robust would use a larger window or fractal definition
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    if (curr.high > prev.high && curr.high > next.high) {
      swingHighs.push({ type: 'high', price: curr.high, index: i });
    }
    if (curr.low < prev.low && curr.low < next.low) {
      swingLows.push({ type: 'low', price: curr.low, index: i });
    }
  }
  
  // Identify recent swing high/low from lookback period
  const lookbackData = candles.slice(-SMC_LOOKBACK_PERIOD_CANDLES);
  let recentSwingHigh: number | undefined = undefined;
  let recentSwingLow: number | undefined = undefined;

  if (lookbackData.length > 0) {
    recentSwingHigh = Math.max(...lookbackData.map(c => c.high));
    recentSwingLow = Math.min(...lookbackData.map(c => c.low));
  }

  // Find closest relevant FVGs to current price
  const currentPrice = candles[candles.length-1].close;
  const bullishFVGsBelowPrice = fvgs.filter(fvg => fvg.type === 'bullish' && fvg.top < currentPrice);
  const bearishFVGsAbovePrice = fvgs.filter(fvg => fvg.type === 'bearish' && fvg.bottom > currentPrice);

  const closestBullishFVG = bullishFVGsBelowPrice.length > 0 
    ? bullishFVGsBelowPrice.reduce((prev, curr) => (currentPrice - curr.top < currentPrice - prev.top ? curr : prev))
    : undefined;
  
  const closestBearishFVG = bearishFVGsAbovePrice.length > 0
    ? bearishFVGsAbovePrice.reduce((prev, curr) => (curr.bottom - currentPrice < prev.bottom - currentPrice ? curr : prev))
    : undefined;


  return { 
    fvgs, 
    swingHighs: swingHighs.slice(-10), // Keep last 10 for display
    swingLows: swingLows.slice(-10),   // Keep last 10 for display
    recentSwingHigh,
    recentSwingLow,
    closestBullishFVG,
    closestBearishFVG,
  };
};
