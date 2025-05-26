
import { Candle, AssetType } from '../types';
import { CANDLE_DURATION_MINUTES, MASTER_ASSET_LIST, BINANCE_MAX_KLINE_LIMIT_PER_REQUEST, NUM_CANDLES_TO_FETCH } from '../constants';

const assetToBinanceSymbolMap: Record<string, string> = {
  // Original 30 assets for M15
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'SOL-USD': 'SOLUSDT',
  'ADA-USD': 'ADAUSDT',
  'XRP-USD': 'XRPUSDT',
  'DOT-USD': 'DOTUSDT',
  'DOGE-USD': 'DOGEUSDT',
  'AVAX-USD': 'AVAXUSDT',
  'LINK-USD': 'LINKUSDT',
  'MATIC-USD': 'MATICUSDT',
  'LTC-USD': 'LTCUSDT',
  'SHIB-USD': 'SHIBUSDT',
  'TRX-USD': 'TRXUSDT',
  'UNI-USD': 'UNIUSDT',
  'BCH-USD': 'BCHUSDT',
  'XLM-USD': 'XLMUSDT',
  'NEAR-USD': 'NEARUSDT',
  'FIL-USD': 'FILUSDT',
  'ICP-USD': 'ICPUSDT',
  'APT-USD': 'APTUSDT',
  'ARB-USD': 'ARBUSDT',
  'OP-USD': 'OPUSDT',
  'TON-USD': 'TONUSDT',
  'ATOM-USD': 'ATOMUSDT',
  'ETC-USD': 'ETCUSDT',
  'VET-USD': 'VETUSDT',
  'HBAR-USD': 'HBARUSDT',
  'ALGO-USD': 'ALGOUSDT',
  'XTZ-USD': 'XTZUSDT',
  'SAND-USD': 'SANDUSDT',
  // New Memecoins
  'PEPE-USD': 'PEPEUSDT',
  'WIF-USD': 'WIFUSDT',
  'BONK-USD': 'BONKUSDT',
  'FLOKI-USD': 'FLOKIUSDT',
  'MEME-USD': 'MEMEUSDT', // Assuming MEME is the ticker for Memecoin
  'BOME-USD': 'BOMEUSDT',
  'TURBO-USD': 'TURBOUSDT',
  'COQ-USD': 'COQUSDT',
  'MYRO-USD': 'MYROUSDT',
};

const mapAssetIdToBinanceSymbol = (assetId: string): string | null => {
  return assetToBinanceSymbolMap[assetId.toUpperCase()] || null;
};

const mapIntervalToString = (intervalMinutes: number): string => {
  if (intervalMinutes === 1) return '1m';
  if (intervalMinutes === 3) return '3m';
  if (intervalMinutes === 5) return '5m';
  if (intervalMinutes === 15) return '15m'; // Ensure M15 is mapped
  if (intervalMinutes === 30) return '30m';
  if (intervalMinutes === 60) return '1h';
  // Add more intervals if needed, up to '1M' (monthly)
  return '15m'; // Default to 15m if CANDLE_DURATION_MINUTES is 15
}

const transformBinanceKline = (kline: any[]): Candle => ({
  date: new Date(kline[0]).toISOString(), // openTime
  open: parseFloat(kline[1]),
  high: parseFloat(kline[2]),
  low: parseFloat(kline[3]),
  close: parseFloat(kline[4]),
  volume: parseFloat(kline[5]),
});

export const fetchHistoricalData = async (assetId: string, numCandlesToFetchOverride?: number): Promise<Candle[]> => {
  const assetConfig = MASTER_ASSET_LIST.find(a => a.id === assetId);
  if (!assetConfig) {
    console.error(`Configuração de ativo não encontrada para ${assetId}`);
    throw new Error(`Configuração de ativo não encontrada para ${assetId}`);
  }

  if (assetConfig.type !== AssetType.CRYPTO) {
    const message = `Tipo de ativo não suportado para busca de dados reais: ${assetConfig.type} (${assetId}). Apenas CRIPTO é suportado.`;
    console.warn(message);
    throw new Error(message);
  }

  const binanceSymbol = mapAssetIdToBinanceSymbol(assetId);
  if (!binanceSymbol) {
    console.error(`Símbolo Binance não mapeado para criptoativo: ${assetId}`);
    throw new Error(`Não é possível buscar dados para ${assetId}: símbolo não mapeado para Binance.`);
  }

  const interval = mapIntervalToString(CANDLE_DURATION_MINUTES);
  const totalCandlesToRetrieve = numCandlesToFetchOverride || NUM_CANDLES_TO_FETCH;
  
  let allKlinesRaw: any[] = [];
  let lastKlineEndTime = Date.now(); 
  let candlesFetchedSoFar = 0;

  console.log(`Iniciando busca de ${totalCandlesToRetrieve} velas para ${binanceSymbol}. Intervalo: ${interval}.`);

  while (candlesFetchedSoFar < totalCandlesToRetrieve) {
    const remainingCandles = totalCandlesToRetrieve - candlesFetchedSoFar;
    const limitForThisCall = Math.min(remainingCandles, BINANCE_MAX_KLINE_LIMIT_PER_REQUEST);

    if (limitForThisCall <= 0) break;

    // Construct URL for fetching klines ending before the earliest kline of the previous batch (or now for the first call)
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limitForThisCall}&endTime=${lastKlineEndTime}`;
    
    try {
      console.log(`Buscando lote de velas: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Erro da API Binance (${response.status}) para ${binanceSymbol}: `, errorData);
        throw new Error(`Falha ao buscar dados da Binance para ${binanceSymbol} (status: ${response.status}). ${errorData.msg || ''}`);
      }
      const klinesBatchRaw: any[] = await response.json();

      if (klinesBatchRaw.length === 0) {
        console.log("Nenhuma vela adicional retornada pela API, parando a busca paginada.");
        break; // No more data from API
      }
      
      // Klines are returned oldest first by Binance if endTime is used. We want to prepend.
      allKlinesRaw = [...klinesBatchRaw, ...allKlinesRaw]; 
      candlesFetchedSoFar += klinesBatchRaw.length;
      
      // Set endTime for the next call to be 1ms before the openTime of the first candle in this batch
      lastKlineEndTime = klinesBatchRaw[0][0] - 1; 

      if (klinesBatchRaw.length < limitForThisCall) {
         console.log("Recebido menos velas que o limite solicitado, indica fim dos dados disponíveis.");
         break; // API returned fewer klines than requested, likely end of available data.
      }
       // Small delay between paginated calls to be kind to the API
      if (candlesFetchedSoFar < totalCandlesToRetrieve) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      console.error(`Erro ao buscar ou processar lote de dados da Binance para ${assetId}:`, error);
      if (error instanceof Error) {
        throw new Error(`Erro de rede ou processamento para ${assetId} (Binance Paginated): ${error.message}`);
      }
      throw new Error(`Erro desconhecido ao buscar dados paginados para ${assetId} (Binance).`);
    }
  }
  
  // Sort all collected klines by open time (ascending) just in case due to prepending logic
  allKlinesRaw.sort((a, b) => a[0] - b[0]);

  // Ensure we only return the number of candles actually requested, taking from the most recent ones.
  const finalKlines = allKlinesRaw.slice(-totalCandlesToRetrieve);

  const candles: Candle[] = finalKlines.map(transformBinanceKline);
  
  console.log(`Dados finais recebidos e transformados para ${binanceSymbol}: ${candles.length} velas (solicitado: ${totalCandlesToRetrieve}).`);
  
  if (candles.length === 0 && totalCandlesToRetrieve > 0) {
      throw new Error(`Nenhuma vela retornada da Binance para ${binanceSymbol} após busca paginada. Verifique o símbolo e o intervalo.`);
  }
  // It's possible to get fewer candles than requested if historical data is limited.
  // This is not necessarily an error, but the caller should be aware.
  if (candles.length < totalCandlesToRetrieve) {
      console.warn(`Recebido ${candles.length} velas, menos que as ${totalCandlesToRetrieve} solicitadas para ${binanceSymbol}. Pode ser limitação de histórico.`);
  }

  return candles;
};
