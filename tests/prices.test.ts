import { describe, expect, it } from "vitest";
import { collectionQuote, quotesForCard, toAud } from "@/lib/prices";
import type { ApiCard, FxRates } from "@/lib/types";

const rates: FxRates = {
  usdAud: 1.4339,
  eurAud: 1.6032,
  usdDate: "2026-10-12",
  eurDate: "2026-10-12",
};

function card(overrides: Partial<ApiCard> = {}): ApiCard {
  return {
    id: "sv3pt5-25",
    name: "Pikachu",
    number: "25",
    set: { id: "sv3pt5", name: "151", printedTotal: 165, total: 207 },
    tcgplayer: {
      updatedAt: "2026/10/13",
      prices: {
        normal: { low: 0.04, mid: 0.3, high: 1000, market: 0.27, directLow: null },
        reverseHolofoil: { low: 0.2, mid: 0.99, high: 75, market: 0.92, directLow: 1.15 },
      },
    },
    cardmarket: {
      updatedAt: "2026/06/30",
      prices: {
        averageSellPrice: 0.56,
        lowPrice: 0.02,
        trendPrice: 0.02,
        reverseHoloSell: 0.45,
      },
    },
    ...overrides,
  };
}

describe("AUD prices", () => {
  it("converts USD and EUR with the rate date and does not invent a price", () => {
    expect(toAud(0.27, 1.4339)).toBe(0.39);
    const quotes = quotesForCard(card(), rates);
    const normal = quotes.find((quote) => quote.source === "TCGplayer" && quote.variantKey === "normal");
    const reverse = quotes.find(
      (quote) => quote.source === "TCGplayer" && quote.variantKey === "reverseHolofoil",
    );
    const europe = quotes.find((quote) => quote.source === "Cardmarket" && quote.variantKey === "normal");

    expect(normal).toMatchObject({
      amountOriginal: 0.27,
      amountAud: 0.39,
      currencyOriginal: "USD",
      sourceDate: "2026/10/13",
      fxDate: "2026-10-12",
      fxRate: 1.4339,
      kind: "market",
    });
    expect(normal?.amountAud).toBe(toAud(0.27, 1.4339));
    expect(reverse?.amountAud).toBe(toAud(0.92, 1.4339));
    expect(europe).toMatchObject({
      amountOriginal: 0.56,
      currencyOriginal: "EUR",
      sourceDate: "2026/06/30",
      kind: "average sell",
    });
    expect(europe?.amountAud).toBe(toAud(0.56, 1.6032));
  });

  it("says no price when market is missing, even if a low price exists", () => {
    const quotes = quotesForCard(
      card({
        tcgplayer: {
          updatedAt: "2026/10/13",
          prices: { normal: { low: 1.25, mid: 2, high: 3, market: null } },
        },
        cardmarket: { updatedAt: "2026/06/30", prices: { averageSellPrice: 0, trendPrice: 4 } },
      }),
      rates,
    );
    const normal = quotes.find((quote) => quote.source === "TCGplayer" && quote.variantKey === "normal");
    const europe = quotes.find((quote) => quote.source === "Cardmarket" && quote.variantKey === "normal");
    expect(normal?.amountAud).toBeNull();
    expect(normal?.amountOriginal).toBeNull();
    expect(normal?.sourceDate).toBe("2026/10/13");
    expect(europe?.amountAud).toBeNull();
    expect(quotes.some((quote) => quote.amountOriginal === 1.25 || quote.amountOriginal === 4)).toBe(false);
  });

  it("does not invent an Australian price when the exchange rate is missing", () => {
    const quotes = quotesForCard(card(), {
      usdAud: null,
      eurAud: 1.6,
      usdDate: null,
      eurDate: "2026-10-12",
    });
    const normal = quotes.find((quote) => quote.source === "TCGplayer" && quote.variantKey === "normal");
    expect(normal?.amountOriginal).toBe(0.27);
    expect(normal?.amountAud).toBeNull();
    expect(normal?.fxRate).toBeNull();
  });

  it("puts the Cardmarket price on the only printing the card has", () => {
    const quotes = quotesForCard(
      card({
        tcgplayer: { updatedAt: "2026/10/13", prices: { holofoil: { market: 2 } } },
        cardmarket: { updatedAt: "2026/06/30", prices: { averageSellPrice: 1.5 } },
      }),
      rates,
    );
    const europe = quotes.find((quote) => quote.source === "Cardmarket");
    expect(europe?.variantKey).toBe("holofoil");
    expect(europe?.variantLabel).toBe("Holofoil");
  });

  it("uses the TCGplayer market for the collection before Cardmarket", () => {
    const quotes = quotesForCard(card(), rates);
    const chosen = collectionQuote(quotes, "normal");
    expect(chosen?.source).toBe("TCGplayer");
    expect(chosen?.amountAud).toBe(0.39);

    const missingMarket = quotesForCard(
      card({
        tcgplayer: { updatedAt: "2026/10/13", prices: { normal: { market: null, low: 1 } } },
      }),
      rates,
    );
    expect(collectionQuote(missingMarket, "normal")?.source).toBe("Cardmarket");
  });
});
