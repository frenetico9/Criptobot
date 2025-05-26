
import { Candle, FVG, SmcAnalysis, SwingPoint, MarketStructurePoint, OrderBlock, InducementPoint, TechnicalIndicators } from '../types';
import { 
    SMC_MARKET_STRUCTURE_LOOKBACK, SMC_FRACTAL_SWING_POINTS_PERIOD,
    SMC_POI_FVG_MIN_ATR_FACTOR, SMC_POI_ORDER_BLOCK_IMBALANCE_MIN_FACTOR,
    SMC_IDM_LOOKBACK
} from '../constants';

// Helper to find N-bar fractal swing points
export const findFractalSwingPoints = (candles: Candle[], period: number = SMC_FRACTAL_SWING_POINTS_PERIOD): { highs: SwingPoint[], lows: SwingPoint[] } => {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];
    if (candles.length < (2 * period + 1)) return { highs, lows };

    for (let i = period; i < candles.length - period; i++) {
        let isHigh = true;
        for (let j = 1; j <= period; j++) {
            if (candles[i].high < candles[i - j].high || candles[i].high < candles[i + j].high) {
                isHigh = false;
                break;
            }
        }
        if (isHigh) {
            // Ensure it's higher than immediate neighbors if period is 1, or strictly higher if period > 1
            // For period=2, it means candle[i].high >= candle[i-1].high, candle[i].high >= candle[i-2].high etc.
            // To be a distinct swing, often a stricter check is used (e.g. candle[i].high > candle[i-1].high AND candle[i].high > candle[i+1].high)
            // The current loop already ensures it's the highest in `period` candles on both sides.
            highs.push({ type: 'high', price: candles[i].high, index: i, date: candles[i].date });
        }

        let isLow = true;
        for (let j = 1; j <= period; j++) {
            if (candles[i].low > candles[i - j].low || candles[i].low > candles[i + j].low) {
                isLow = false;
                break;
            }
        }
        if (isLow) {
            lows.push({ type: 'low', price: candles[i].low, index: i, date: candles[i].date });
        }
    }
    return { highs, lows };
};


export const identifyMarketStructure = (
    candles: Candle[],
    swingHighs: SwingPoint[],
    swingLows: SwingPoint[],
    lookbackPeriod: number = SMC_MARKET_STRUCTURE_LOOKBACK 
): MarketStructurePoint[] => {
    const structurePoints: MarketStructurePoint[] = [];
    if (candles.length === 0 || (swingHighs.length === 0 && swingLows.length === 0)) {
        return structurePoints;
    }

    const combinedSwings = [...swingHighs, ...swingLows].sort((a, b) => a.index - b.index);
    if (combinedSwings.length < 2) return structurePoints;

    let lastConfirmedMajorHigh: SwingPoint | null = null;
    let lastConfirmedMajorLow: SwingPoint | null = null;
    
    // Attempt to establish initial trend context based on last few major swings
    // This is simplified; robust trend ID is complex.
    let currentTrendDirection: 'bullish' | 'bearish' = 'ranging' as any; // Will be set
    const recentHighs = swingHighs.slice(-3);
    const recentLows = swingLows.slice(-3);

    if (recentHighs.length >= 2 && recentLows.length >=2) {
        if (recentHighs[recentHighs.length-1].price > recentHighs[recentHighs.length-2].price &&
            recentLows[recentLows.length-1].price > recentLows[recentLows.length-2].price) {
            currentTrendDirection = 'bullish';
            lastConfirmedMajorHigh = recentHighs[recentHighs.length-1];
            lastConfirmedMajorLow = recentLows[recentLows.length-1];
        } else if (recentHighs[recentHighs.length-1].price < recentHighs[recentHighs.length-2].price &&
                   recentLows[recentLows.length-1].price < recentLows[recentLows.length-2].price) {
            currentTrendDirection = 'bearish';
            lastConfirmedMajorHigh = recentHighs[recentHighs.length-1];
            lastConfirmedMajorLow = recentLows[recentLows.length-1];
        }
    }


    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        
        // Check for Liquidity Sweeps (wicking beyond a prior swing but closing back)
        const prevHighsBeforeCandle = swingHighs.filter(sh => sh.index < i).sort((a, b) => b.index - a.index);
        if (prevHighsBeforeCandle.length > 0) {
            const latestPrevHigh = prevHighsBeforeCandle[0];
            if (candle.high > latestPrevHigh.price && candle.close < latestPrevHigh.price && candle.open < latestPrevHigh.price) {
                // Avoid duplicate sweeps of the same point unless a new MS has formed
                if (!structurePoints.some(sp => sp.type === 'Sweep' && sp.sweptPoint?.index === latestPrevHigh.index && sp.index > (lastConfirmedMajorLow?.index || 0))) {
                     structurePoints.push({ type: 'Sweep', level: latestPrevHigh.price, index: i, date: candle.date, direction: 'bearish', sweptPoint: latestPrevHigh });
                }
            }
        }
        const prevLowsBeforeCandle = swingLows.filter(sl => sl.index < i).sort((a, b) => b.index - a.index);
         if (prevLowsBeforeCandle.length > 0) {
            const latestPrevLow = prevLowsBeforeCandle[0];
            if (candle.low < latestPrevLow.price && candle.close > latestPrevLow.price && candle.open > latestPrevLow.price) {
                if (!structurePoints.some(sp => sp.type === 'Sweep' && sp.sweptPoint?.index === latestPrevLow.index && sp.index > (lastConfirmedMajorHigh?.index || 0))) {
                    structurePoints.push({ type: 'Sweep', level: latestPrevLow.price, index: i, date: candle.date, direction: 'bullish', sweptPoint: latestPrevLow });
                }
            }
        }


        // Check for BOS/CHoCH
        // Bullish break: Close above a prior swing high
        const relevantHighToBreak = currentTrendDirection === 'bullish' ? lastConfirmedMajorHigh : swingHighs.filter(sh => sh.index < i && (!lastConfirmedMajorLow || sh.index > lastConfirmedMajorLow.index)).sort((a,b) => b.index - a.index)[0];
        
        if (relevantHighToBreak && candle.close > relevantHighToBreak.price) {
            const type = (currentTrendDirection === 'bearish' || (lastConfirmedMajorLow && relevantHighToBreak.index < lastConfirmedMajorLow.index)) ? 'CHoCH' : 'BOS';
            structurePoints.push({ type, level: relevantHighToBreak.price, index: i, date: candle.date, direction: 'bullish', sweptPoint: relevantHighToBreak });
            currentTrendDirection = 'bullish';
            lastConfirmedMajorHigh = swingHighs.find(sh => sh.index === i) || relevantHighToBreak; // Update with current high if it's a new swing
             // Invalidate prior lows below the new structure's origin for bullish trend
            const originLowOfBullishMove = swingLows.filter(sl => sl.index < relevantHighToBreak.index).sort((a,b) => b.index - a.index)[0];
            if(originLowOfBullishMove) lastConfirmedMajorLow = originLowOfBullishMove;
        }

        // Bearish break: Close below a prior swing low
        const relevantLowToBreak = currentTrendDirection === 'bearish' ? lastConfirmedMajorLow : swingLows.filter(sl => sl.index < i && (!lastConfirmedMajorHigh || sl.index > lastConfirmedMajorHigh.index)).sort((a,b) => b.index - a.index)[0];

        if (relevantLowToBreak && candle.close < relevantLowToBreak.price) {
            const type = (currentTrendDirection === 'bullish' || (lastConfirmedMajorHigh && relevantLowToBreak.index < lastConfirmedMajorHigh.index)) ? 'CHoCH' : 'BOS';
            structurePoints.push({ type, level: relevantLowToBreak.price, index: i, date: candle.date, direction: 'bearish', sweptPoint: relevantLowToBreak });
            currentTrendDirection = 'bearish';
            lastConfirmedMajorLow = swingLows.find(sl => sl.index === i) || relevantLowToBreak;
            const originHighOfBearishMove = swingHighs.filter(sh => sh.index < relevantLowToBreak.index).sort((a,b) => b.index - a.index)[0];
            if(originHighOfBearishMove) lastConfirmedMajorHigh = originHighOfBearishMove;
        }
    }
    
    // Filter out less significant breaks if multiple happen quickly, keep the most recent dominant one.
    // This needs more sophisticated logic for "major" vs "minor" structure. For now, simple sort.
    return structurePoints.sort((a, b) => a.index - b.index);
};

export const identifyFVGs = (candles: Candle[], atrValues?: number[]): FVG[] => {
    const fvgs: FVG[] = [];
    if (candles.length < 3) return fvgs;

    const defaultAtr = candles.length > 0 ? (candles[candles.length - 1].high - candles[candles.length - 1].low) * 0.1 : 0.001;

    for (let i = 2; i < candles.length; i++) {
        const c1 = candles[i - 2];
        const c2 = candles[i - 1]; // Middle candle, not used for FVG boundary but for context
        const c3 = candles[i];
        const currentAtr = atrValues && atrValues[i] !== undefined && atrValues[i] > 0 ? atrValues[i] : defaultAtr;
        const minFvgSize = currentAtr * SMC_POI_FVG_MIN_ATR_FACTOR;

        // Bullish FVG (Gap between c1.high and c3.low)
        if (c1.high < c3.low && (c3.low - c1.high >= minFvgSize)) {
            // Standard FVG definition doesn't strictly require c2 wick not to mitigate.
            // The FVG exists if c1.high < c3.low. Mitigation is a separate check.
            fvgs.push({ type: 'bullish', top: c3.low, bottom: c1.high, mid: (c3.low + c1.high) / 2, startIndex: i - 2, endIndex: i, isMitigated: false });
        }

        // Bearish FVG (Gap between c1.low and c3.high)
        if (c1.low > c3.high && (c1.low - c3.high >= minFvgSize)) {
            fvgs.push({ type: 'bearish', top: c1.low, bottom: c3.high, mid: (c1.low + c3.high) / 2, startIndex: i - 2, endIndex: i, isMitigated: false });
        }
    }
    return fvgs;
};

export const identifyOrderBlocks = (
    candles: Candle[],
    marketStructure: MarketStructurePoint[],
    fvgs: FVG[], // All FVGs for checking imbalance
    swingHighs: SwingPoint[],
    swingLows: SwingPoint[],
    atrValues?: number[]
): OrderBlock[] => {
    const orderBlocks: OrderBlock[] = [];
    if (candles.length < 2) return orderBlocks;

    const defaultAtr = candles.length > 0 ? (candles[candles.length - 1].high - candles[candles.length - 1].low) * 0.1 : 0.001;

    // Consider candles that swept liquidity OR are the last opposing candle before a strong move that broke structure
    for (let i = 1; i < candles.length - 1; i++) { // iterate through candles that can be OBs
        const obCandle = candles[i];
        const nextCandle = candles[i+1];
        const currentAtr = (atrValues && atrValues[i] !== undefined && atrValues[i] > 0) ? atrValues[i] : defaultAtr;
        const minImbalanceSize = currentAtr * SMC_POI_ORDER_BLOCK_IMBALANCE_MIN_FACTOR;
        
        let sweptLiquidityPrior = false;
        // Check if OB candle swept a recent swing high/low
        const prevLow = swingLows.filter(sl => sl.index < i).sort((a,b) => b.index - a.index)[0];
        if (prevLow && obCandle.low < prevLow.price && obCandle.close > prevLow.price) sweptLiquidityPrior = true;
        
        const prevHigh = swingHighs.filter(sh => sh.index < i).sort((a,b) => b.index - a.index)[0];
        if (prevHigh && obCandle.high > prevHigh.price && obCandle.close < prevHigh.price) sweptLiquidityPrior = true;

        // Bullish OB: Last down candle before an up move that creates imbalance / BOS
        if (obCandle.close < obCandle.open) { // Down candle
            // Check for subsequent imbalance (FVG) starting *after* this OB candle
            const subsequentBullishFVG = fvgs.find(fvg => fvg.type === 'bullish' && fvg.startIndex === i && (fvg.top - fvg.bottom) >= minImbalanceSize);
            // Check if this OB led to a bullish BOS/CHoCH
            const ledToBullishMS = marketStructure.some(ms => ms.direction === 'bullish' && ms.sweptPoint && ms.sweptPoint.index > i && ms.index > i && (candles[ms.index].high - obCandle.low) > currentAtr * 2);


            if (subsequentBullishFVG || sweptLiquidityPrior || ledToBullishMS) {
                if (nextCandle.close > obCandle.high) { // Strong move after OB
                    orderBlocks.push({
                        type: 'bullish', top: obCandle.high, bottom: obCandle.low, mid: (obCandle.high + obCandle.low) / 2,
                        open: obCandle.open, close: obCandle.close, index: i, date: obCandle.date,
                        hasImbalance: !!subsequentBullishFVG, sweptLiquidityBefore: sweptLiquidityPrior, isMitigated: false
                    });
                }
            }
        }
        // Bearish OB: Last up candle before a down move
        else if (obCandle.close > obCandle.open) { // Up candle
            const subsequentBearishFVG = fvgs.find(fvg => fvg.type === 'bearish' && fvg.startIndex === i && (fvg.top - fvg.bottom) >= minImbalanceSize);
            const ledToBearishMS = marketStructure.some(ms => ms.direction === 'bearish' && ms.sweptPoint && ms.sweptPoint.index > i && ms.index > i && (obCandle.high - candles[ms.index].low) > currentAtr * 2);

            if (subsequentBearishFVG || sweptLiquidityPrior || ledToBearishMS) {
                 if (nextCandle.close < obCandle.low) { // Strong move after OB
                    orderBlocks.push({
                        type: 'bearish', top: obCandle.high, bottom: obCandle.low, mid: (obCandle.high + obCandle.low) / 2,
                        open: obCandle.open, close: obCandle.close, index: i, date: obCandle.date,
                        hasImbalance: !!subsequentBearishFVG, sweptLiquidityBefore: sweptLiquidityPrior, isMitigated: false
                    });
                }
            }
        }
    }
    
    // Filter out duplicates or very close OBs, prefer ones with imbalance or sweeps.
    const uniqueOBs: OrderBlock[] = [];
    for (const ob of orderBlocks.sort((a,b) => a.index - b.index)) {
        if (!uniqueOBs.find(uob => Math.abs(uob.index - ob.index) <= 1 && uob.type === ob.type) ) {
            uniqueOBs.push(ob);
        }
    }
    return uniqueOBs;
};

export const identifyInducement = (
    candles: Candle[],
    marketStructure: MarketStructurePoint[],
    swingHighs: SwingPoint[],
    swingLows: SwingPoint[],
    lookbackIDM: number = SMC_IDM_LOOKBACK
): InducementPoint[] => {
    const inducementPoints: InducementPoint[] = [];
    const lastMSS = marketStructure.filter(ms => ms.type === 'CHoCH' || ms.type === 'BOS').sort((a,b) => b.index - a.index)[0];

    if (!lastMSS) return inducementPoints;

    // Inducement is typically the first clear pullback (fractal point) after the MSS,
    // in the direction opposite to the MSS.
    if (lastMSS.direction === 'bullish') {
        // After bullish MSS, IDM is a low formed by a pullback.
        const relevantLows = swingLows.filter(sl => sl.index > lastMSS.index && sl.index < lastMSS.index + lookbackIDM);
        if (relevantLows.length > 0) {
            const firstPullbackLow = relevantLows.sort((a,b)=> a.index - b.index)[0];
             inducementPoints.push({
                level: firstPullbackLow.price, index: firstPullbackLow.index, date: firstPullbackLow.date,
                type: 'low', relatedMSS: lastMSS, isSwept: false
            });
        }
    } else { // Bearish MSS
        // After bearish MSS, IDM is a high formed by a pullback.
        const relevantHighs = swingHighs.filter(sh => sh.index > lastMSS.index && sh.index < lastMSS.index + lookbackIDM);
        if (relevantHighs.length > 0) {
            const firstPullbackHigh = relevantHighs.sort((a,b)=>a.index - b.index)[0];
            inducementPoints.push({
                level: firstPullbackHigh.price, index: firstPullbackHigh.index, date: firstPullbackHigh.date,
                type: 'high', relatedMSS: lastMSS, isSwept: false
            });
        }
    }
    return inducementPoints;
};


// Main analysis function
export const analyzeSMC = (candles: Candle[], indicators: TechnicalIndicators): SmcAnalysis => {
  const { highs: fractalHighs, lows: fractalLows } = findFractalSwingPoints(candles, SMC_FRACTAL_SWING_POINTS_PERIOD);
  
  const marketStructurePoints = identifyMarketStructure(candles, fractalHighs, fractalLows, SMC_MARKET_STRUCTURE_LOOKBACK);
  const fvgs = identifyFVGs(candles, indicators.atr);
  const orderBlocks = identifyOrderBlocks(candles, marketStructurePoints, fvgs, fractalHighs, fractalLows, indicators.atr);
  const inducementPointsInitial = identifyInducement(candles, marketStructurePoints, fractalHighs, fractalLows);

  // Check and update inducement sweep status
   const inducementPoints = inducementPointsInitial.map(idm => {
        let isSwept = false;
        if (idm.relatedMSS) {
            for (let k = idm.index + 1; k < candles.length; k++) {
                const candle = candles[k];
                 // If a new MSS occurred before sweep, this IDM might be irrelevant for that new MSS
                const newMSSAfterIDM = marketStructurePoints.find(ms => ms.index > idm.index && ms.index < k && ms.direction !== idm.relatedMSS?.direction);
                if (newMSSAfterIDM) break;

                if (idm.type === 'low' && candle.low < idm.level) { isSwept = true; break; }
                if (idm.type === 'high' && candle.high > idm.level) { isSwept = true; break; }
            }
        }
        return { ...idm, isSwept };
    });


  // Basic mitigation check for FVGs and OBs
  fvgs.forEach(fvg => {
      for(let k = fvg.endIndex + 1; k < candles.length; k++) {
          const candle = candles[k];
          // Mitigated if price CLOSES into 50% of the FVG or more
          if (fvg.type === 'bullish') {
              if (candle.low <= fvg.mid && candle.close >= fvg.bottom) { // Touched mid and closed within or above FVG
                  fvg.isMitigated = true; break;
              }
              if (candle.low < fvg.bottom) { // Swept past the FVG
                   fvg.isMitigated = true; break;
              }
          }
          if (fvg.type === 'bearish') {
              if (candle.high >= fvg.mid && candle.close <= fvg.top) {
                  fvg.isMitigated = true; break;
              }
               if (candle.high > fvg.top) {
                   fvg.isMitigated = true; break;
              }
          }
      }
  });
  orderBlocks.forEach(ob => {
      for(let k = ob.index + 1; k < candles.length; k++) {
          const candle = candles[k];
          if (ob.type === 'bullish') {
              if (candle.low <= ob.mid && candle.close >= ob.bottom) {
                  ob.isMitigated = true; break;
              }
              if(candle.low < ob.bottom) { // Swept past OB
                  ob.isMitigated = true; break;
              }
          }
          if (ob.type === 'bearish') {
              if (candle.high >= ob.mid && candle.close <= ob.top) {
                  ob.isMitigated = true; break;
              }
              if(candle.high > ob.top) {
                  ob.isMitigated = true; break;
              }
          }
      }
  });

  const lastMSS = marketStructurePoints.filter(ms => ms.type === 'BOS' || ms.type === 'CHoCH').pop();
  const lastInducement = inducementPoints.length > 0 ? inducementPoints[inducementPoints.length -1] : undefined;


  return {
    swingHighs: fractalHighs,
    swingLows: fractalLows,
    marketStructurePoints,
    inducementPoints,
    orderBlocks,
    fvgs,
    potentialBullishPOIs: [], // To be populated by strategy logic in App.tsx
    potentialBearishPOIs: [], // To be populated by strategy logic in App.tsx
    lastMSS,
    lastInducement,
  };
};
