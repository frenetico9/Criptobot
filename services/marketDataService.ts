
import { Candle, AssetType } from '../types';
import { NUM_CANDLES_TO_FETCH, CANDLE_DURATION_MINUTES, MASTER_ASSET_LIST } from '../constants';

const assetToBinanceSymbolMap: Record<string, string> = {
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
  'TON-USD': 'TONUSDT', // Toncoin might be TONCOINUSDT or similar, verify on Binance
  'ATOM-USD': 'ATOMUSDT',
  'ETC-USD': 'ETCUSDT',
  'VET-USD': 'VETUSDT',
  'HBAR-USD': 'HBARUSDT',
  'ALGO-USD': 'ALGOUSDT',
  'XTZ-USD': 'XTZUSDT',
  'SAND-USD': 'SANDUSDT',
  // 'MANA-USD': 'MANAUSDT', // Example if MANA were added
  // 'AAVE-USD': 'AAVEUSDT', // Example if AAVE were added
};


const mapAssetIdToBinanceSymbol = (assetId: string): string | null => {
  return assetToBinanceSymbolMap[assetId.toUpperCase()] || null;
};

const mapIntervalToString = (intervalMinutes: number): string => {
  // Mapeia para intervalos válidos da Binance API
  // https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#enum-definitions
  if (intervalMinutes === 1) return '1m';
  if (intervalMinutes === 3) return '3m';
  if (intervalMinutes === 5) return '5m';
  if (intervalMinutes === 15) return '15m';
  if (intervalMinutes === 30) return '30m';
  if (intervalMinutes === 60) return '1h';
  if (intervalMinutes === 120) return '2h';
  if (intervalMinutes === 240) return '4h';
  if (intervalMinutes === 360) return '6h';
  if (intervalMinutes === 480) return '8h';
  if (intervalMinutes === 720) return '12h';
  if (intervalMinutes === 1440) return '1d';
  return '5m'; // Default
}

export const fetchHistoricalData = async (assetId: string): Promise<Candle[]> => {
  const assetConfig = MASTER_ASSET_LIST.find(a => a.id === assetId);
  if (!assetConfig) {
    console.error(`Configuração de ativo não encontrada para ${assetId}`);
    throw new Error(`Configuração de ativo não encontrada para ${assetId}`);
  }

  // Como agora todos os ativos são CRYPTO, o 'else' raramente será atingido,
  // mas é mantido como uma salvaguarda se AssetType for expandido novamente.
  if (assetConfig.type === AssetType.CRYPTO) {
    const binanceSymbol = mapAssetIdToBinanceSymbol(assetId);
    if (!binanceSymbol) {
      console.error(`Símbolo Binance não mapeado para criptoativo: ${assetId}`);
      throw new Error(`Não é possível buscar dados para ${assetId}: símbolo não mapeado para Binance.`);
    }

    const interval = mapIntervalToString(CANDLE_DURATION_MINUTES);
    const limit = NUM_CANDLES_TO_FETCH;
    // Uso de proxy para contornar CORS pode ser necessário em ambientes de desenvolvimento local sem configuração de servidor.
    // Para produção, um backend que faz as chamadas para a Binance é a solução mais robusta.
    // const proxyUrl = 'http://localhost:3001/binance-proxy?'; // Exemplo de URL de proxy local
    // const url = `${proxyUrl}symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

    try {
      console.log(`Buscando dados da Binance para ${binanceSymbol}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Tenta pegar corpo do erro
        console.error(`Erro da API Binance (${response.status}) para ${binanceSymbol}: `, errorData);
        throw new Error(`Falha ao buscar dados da Binance para ${binanceSymbol} (status: ${response.status}). ${errorData.msg || ''}`);
      }
      const rawData: any[] = await response.json();
      
      const candles: Candle[] = rawData.map(kline => ({
        date: new Date(kline[0]).toISOString(), // openTime
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      }));
      
      console.log(`Dados recebidos e transformados para ${binanceSymbol}: ${candles.length} velas.`);
      if (candles.length === 0) {
          throw new Error(`Nenhuma vela retornada da Binance para ${binanceSymbol}. Verifique o símbolo e o intervalo.`);
      }
      return candles;

    } catch (error) {
      console.error(`Erro ao buscar ou processar dados da Binance para ${assetId}:`, error);
      if (error instanceof Error) {
        throw new Error(`Erro de rede ou processamento para ${assetId} (Binance): ${error.message}`);
      }
      throw new Error(`Erro desconhecido ao buscar dados para ${assetId} (Binance).`);
    }
  } else {
    // Este bloco se torna menos provável de ser atingido, mas é mantido por robustez.
    const message = `Tipo de ativo não suportado para busca de dados reais: ${assetConfig.type} (${assetId}). Apenas CRIPTO é suportado.`;
    console.warn(message);
    throw new Error(message);
  }
};