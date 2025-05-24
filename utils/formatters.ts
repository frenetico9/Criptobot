// utils/formatters.ts
export const formatPrice = (price?: number, assetName?: string): string => {
    if (price === undefined || price === null) return 'N/D';
    
    const isBTC = assetName?.toUpperCase().includes('BTC');
    
    if (isBTC) return price.toFixed(2);
    if (price > 100) return price.toFixed(2); 
    if (price > 1) return price.toFixed(4);   
    if (price > 0.01) return price.toFixed(5); 
    if (price > 0.0001) return price.toFixed(6);
    if (price === 0) return '0.00';
    return price.toPrecision(3); // For very small values or as a general fallback
};
