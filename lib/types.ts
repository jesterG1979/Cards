export type CollectorNumber = {
  num: string;
  denom: string;
  raw: string;
};

export type OcrRead = {
  text: string;
  numbers: CollectorNumber[];
  names: string[];
};

export type FxRates = {
  usdAud: number | null;
  eurAud: number | null;
  usdDate: string | null;
  eurDate: string | null;
};

export type PriceQuote = {
  source: "TCGplayer" | "Cardmarket";
  variantKey: string;
  variantLabel: string;
  kind: "market" | "average sell";
  amountAud: number | null;
  amountOriginal: number | null;
  currencyOriginal: "USD" | "EUR";
  sourceDate: string | null;
  fxDate: string | null;
  fxRate: number | null;
};

export type TcgPrice = {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
};

export type CardmarketPrices = {
  averageSellPrice?: number | null;
  lowPrice?: number | null;
  trendPrice?: number | null;
  reverseHoloSell?: number | null;
  reverseHoloLow?: number | null;
  reverseHoloTrend?: number | null;
  avg1?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  reverseHoloAvg1?: number | null;
  reverseHoloAvg7?: number | null;
  reverseHoloAvg30?: number | null;
};

export type ApiCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  set: {
    id: string;
    name: string;
    printedTotal?: number;
    total?: number;
    releaseDate?: string;
  };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TcgPrice | undefined>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: CardmarketPrices;
  };
};

export type PricedCard = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  supertype: string;
  subtypes: string[];
  setId: string;
  setName: string;
  printedTotal: number | null;
  total: number | null;
  releaseDate: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  quotes: PriceQuote[];
};

export type ScoredCandidate = {
  card: PricedCard;
  score: number;
  hashDistance: number | null;
};

export type IdentifyResult = {
  ocrText: string;
  numbers: CollectorNumber[];
  names: string[];
  candidates: ScoredCandidate[];
};

export type CollectionItem = {
  cardId: string;
  name: string;
  setName: string;
  number: string;
  printedTotal?: number | null;
  rarity: string;
  image: string | null;
  variantKey: string;
  variantLabel: string;
  quantity: number;
  amountAud: number | null;
  priceSource: string | null;
  priceDate: string | null;
  savedAt: string;
};
