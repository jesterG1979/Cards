import type { ApiCard, FxRates, PriceQuote, PricedCard, TcgPrice } from "@/lib/types";

const VARIANT_LABELS: Record<string, string> = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse holo",
  "1stEditionHolofoil": "1st edition holo",
  "1stEditionNormal": "1st edition",
  "1stEdition": "1st edition",
  unlimitedHolofoil: "Unlimited holo",
  unlimited: "Unlimited",
  cardmarket: "Cardmarket",
};

export function variantLabel(key: string): string {
  if (VARIANT_LABELS[key]) return VARIANT_LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function positive(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function toAud(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

function quote(options: {
  source: PriceQuote["source"];
  variantKey: string;
  kind: PriceQuote["kind"];
  amount: number | null;
  currency: "USD" | "EUR";
  sourceDate: string | null;
  rate: number | null;
  fxDate: string | null;
}): PriceQuote {
  const converted = options.amount != null && options.rate != null;
  return {
    source: options.source,
    variantKey: options.variantKey,
    variantLabel: variantLabel(options.variantKey),
    kind: options.kind,
    amountOriginal: options.amount,
    currencyOriginal: options.currency,
    amountAud: converted ? toAud(options.amount as number, options.rate as number) : null,
    sourceDate: options.sourceDate,
    fxDate: converted ? options.fxDate : null,
    fxRate: converted ? options.rate : null,
  };
}

const CARDMARKET_SINGLE_PRINTINGS = new Set(["normal", "holofoil", "unlimited"]);

function cardmarketAverageKey(keys: string[]): string {
  if (keys.length === 0 || keys.includes("normal")) return "normal";
  const printings = keys.filter((key) => key !== "reverseHolofoil");
  const only = printings.length === 1 ? printings[0] : null;
  if (only && CARDMARKET_SINGLE_PRINTINGS.has(only)) return only;
  return "cardmarket";
}

export function quotesForCard(card: ApiCard, rates: FxRates): PriceQuote[] {
  const quotes: PriceQuote[] = [];
  const tcgPrices = card.tcgplayer?.prices ?? {};
  const tcgKeys = Object.keys(tcgPrices).filter((key) => tcgPrices[key]);
  const sourceDate = card.tcgplayer?.updatedAt ?? null;

  if (tcgKeys.length === 0) {
    quotes.push(
      quote({
        source: "TCGplayer",
        variantKey: "normal",
        kind: "market",
        amount: null,
        currency: "USD",
        sourceDate,
        rate: rates.usdAud,
        fxDate: rates.usdDate,
      }),
    );
  } else {
    for (const key of tcgKeys) {
      const row: TcgPrice = tcgPrices[key] ?? {};
      quotes.push(
        quote({
          source: "TCGplayer",
          variantKey: key,
          kind: "market",
          amount: positive(row.market),
          currency: "USD",
          sourceDate,
          rate: rates.usdAud,
          fxDate: rates.usdDate,
        }),
      );
    }
  }

  const cardmarketDate = card.cardmarket?.updatedAt ?? null;
  const prices = card.cardmarket?.prices;
  const mainKey = cardmarketAverageKey(tcgKeys);
  quotes.push(
    quote({
      source: "Cardmarket",
      variantKey: mainKey,
      kind: "average sell",
      amount: positive(prices?.averageSellPrice),
      currency: "EUR",
      sourceDate: cardmarketDate,
      rate: rates.eurAud,
      fxDate: rates.eurDate,
    }),
  );

  if (positive(prices?.reverseHoloSell) != null) {
    quotes.push(
      quote({
        source: "Cardmarket",
        variantKey: "reverseHolofoil",
        kind: "average sell",
        amount: positive(prices?.reverseHoloSell),
        currency: "EUR",
        sourceDate: cardmarketDate,
        rate: rates.eurAud,
        fxDate: rates.eurDate,
      }),
    );
  }

  return quotes;
}

export function toPricedCard(card: ApiCard, rates: FxRates): PricedCard {
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity ?? "Unknown rarity",
    supertype: card.supertype ?? "",
    subtypes: card.subtypes ?? [],
    setId: card.set.id,
    setName: card.set.name,
    printedTotal: card.set.printedTotal ?? null,
    total: card.set.total ?? null,
    releaseDate: card.set.releaseDate ?? null,
    imageSmall: card.images?.small ?? null,
    imageLarge: card.images?.large ?? null,
    quotes: quotesForCard(card, rates),
  };
}

export type QuoteGroup = {
  variantKey: string;
  variantLabel: string;
  quotes: PriceQuote[];
};

const VARIANT_ORDER = ["normal", "reverseHolofoil", "holofoil", "1stEditionNormal", "1stEditionHolofoil"];

export function groupQuotes(quotes: PriceQuote[]): QuoteGroup[] {
  const groups = new Map<string, QuoteGroup>();
  for (const item of quotes) {
    const current = groups.get(item.variantKey) ?? {
      variantKey: item.variantKey,
      variantLabel: item.variantLabel,
      quotes: [],
    };
    current.quotes.push(item);
    groups.set(item.variantKey, current);
  }
  return [...groups.values()].sort((a, b) => {
    const ai = VARIANT_ORDER.indexOf(a.variantKey);
    const bi = VARIANT_ORDER.indexOf(b.variantKey);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function preferredVariant(quotes: PriceQuote[]): string {
  const groups = groupQuotes(quotes);
  const priced = (key: string) =>
    groups.find((group) => group.variantKey === key && group.quotes.some((item) => item.amountAud != null));
  return (
    priced("normal")?.variantKey ??
    groups.find((group) => group.quotes.some((item) => item.amountAud != null))?.variantKey ??
    groups[0]?.variantKey ??
    "normal"
  );
}

export function collectionQuote(quotes: PriceQuote[], variantKey: string): PriceQuote | null {
  const matching = quotes.filter((item) => item.variantKey === variantKey);
  return (
    matching.find((item) => item.source === "TCGplayer" && item.amountAud != null) ??
    matching.find((item) => item.source === "Cardmarket" && item.amountAud != null) ??
    null
  );
}
