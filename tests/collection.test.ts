import { describe, expect, it } from "vitest";
import { applyFreshPrices, totalValue, unpricedMessage, upsertItem } from "@/lib/collection";
import type { CollectionItem, PricedCard } from "@/lib/types";

function item(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    cardId: "sv3pt5-25",
    name: "Pikachu",
    setName: "151",
    number: "25/165",
    rarity: "Common",
    image: null,
    variantKey: "normal",
    variantLabel: "Normal",
    quantity: 1,
    amountAud: 0.39,
    priceSource: "TCGplayer",
    priceDate: "2026/10/13",
    savedAt: "2026-10-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("collection", () => {
  it("totals priced copies and leaves missing prices out", () => {
    const summary = totalValue([
      item({ quantity: 2, amountAud: 0.39 }),
      item({ cardId: "sv1-1", amountAud: null, quantity: 1 }),
    ]);
    expect(summary.aud).toBe(0.78);
    expect(summary.unpricedCopies).toBe(1);
    expect(summary.pricedCopies).toBe(2);
    expect(unpricedMessage(1)).toBe("1 card has no price, so it isn't in the total.");
    expect(unpricedMessage(0)).toBeNull();
  });

  it("adds another copy of the same printing and refreshes a missing price to no price", () => {
    const saved = upsertItem([item()], item({ amountAud: 0.5, quantity: 1 }));
    expect(saved).toHaveLength(1);
    expect(saved[0]?.quantity).toBe(2);
    expect(saved[0]?.amountAud).toBe(0.5);

    const card: PricedCard = {
      id: "sv3pt5-25",
      name: "Pikachu",
      number: "25",
      rarity: "Common",
      supertype: "Pokémon",
      subtypes: [],
      setId: "sv3pt5",
      setName: "151",
      printedTotal: 165,
      total: 207,
      releaseDate: null,
      imageSmall: "https://example.test/small.png",
      imageLarge: null,
      quotes: [
        {
          source: "TCGplayer",
          variantKey: "normal",
          variantLabel: "Normal",
          kind: "market",
          amountAud: null,
          amountOriginal: null,
          currencyOriginal: "USD",
          sourceDate: "2026/10/13",
          fxDate: null,
          fxRate: null,
        },
      ],
    };
    const refreshed = applyFreshPrices(saved, [card]);
    expect(refreshed[0]?.amountAud).toBeNull();
    expect(refreshed[0]?.priceSource).toBeNull();
  });
});
