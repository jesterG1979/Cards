import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const { fetchCardsByIds, spawn } = vi.hoisted(() => ({ fetchCardsByIds: vi.fn(), spawn: vi.fn() }));
vi.mock("@/lib/pokemon", async () => ({
  ...(await vi.importActual<object>("@/lib/pokemon")),
  fetchCardsByIds: (...args: unknown[]) => fetchCardsByIds(...args),
}));
vi.mock("@/lib/fx", () => ({
  getRates: async () => ({ usdAud: 1.5, eurAud: 1.7, usdDate: "2026-10-13", eurDate: "2026-10-13" }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => spawn(...args) }));

import { GET as cardsGet } from "@/app/api/cards/route";
import { applyFreshPrices } from "@/lib/collection";
import { runTesseract } from "@/lib/ocr";
import { collectionQuote, quotesForCard, toPricedCard } from "@/lib/prices";
import type { ApiCard, CollectionItem, FxRates } from "@/lib/types";

const rates: FxRates = { usdAud: 1.5, eurAud: 1.7, usdDate: "2026-10-13", eurDate: "2026-10-13" };

function apiCard(overrides: Partial<ApiCard>): ApiCard {
  return { id: "base1-4", name: "Charizard", number: "4", set: { id: "base1", name: "Base", printedTotal: 102, total: 102 }, ...overrides };
}

describe("/api/cards ids (F-05)", () => {
  it("accepts real ids with _, ! and ?", async () => {
    fetchCardsByIds.mockResolvedValue([]);
    const response = await cardsGet(new Request("http://local/api/cards?ids=cel25c-15_A1,ex10-!,ex10-?,base1-4"));
    expect(response.status).toBe(200);
    expect(fetchCardsByIds).toHaveBeenCalledWith(["cel25c-15_A1", "ex10-!", "ex10-?", "base1-4"]);
  });

  it("still rejects quotes, spaces and query syntax", async () => {
    for (const bad of ['a"b', "a b", "a:b", "a)b", "x".repeat(40)]) {
      const response = await cardsGet(new Request(`http://local/api/cards?ids=${encodeURIComponent(bad)}`));
      expect(response.status).toBe(400);
    }
  });
});

describe("Cardmarket printing (F-11, F-14)", () => {
  it("files Cardmarket's average under the only printing, including unlimited holo", () => {
    const quotes = quotesForCard(
      apiCard({ tcgplayer: { prices: { unlimitedHolofoil: { market: null, low: 50 } } }, cardmarket: { prices: { averageSellPrice: 45 } } }),
      rates,
    );
    expect(collectionQuote(quotes, "unlimitedHolofoil")?.source).toBe("Cardmarket");
    expect(quotes.some((quote) => quote.variantKey === "cardmarket")).toBe(false);
  });

  it("files it under reverse holo when that is the only printing listed", () => {
    const quotes = quotesForCard(
      apiCard({
        tcgplayer: { prices: { reverseHolofoil: { market: 2 } } },
        cardmarket: { prices: { averageSellPrice: 1, reverseHoloSell: 1.1 } },
      }),
      rates,
    );
    expect(new Set(quotes.map((quote) => quote.variantKey))).toEqual(new Set(["reverseHolofoil"]));
    expect(quotes.filter((quote) => quote.source === "Cardmarket")).toHaveLength(1);
  });

  it("labels the mixed-printing Cardmarket bucket as any printing", () => {
    const quotes = quotesForCard(
      apiCard({
        tcgplayer: { prices: { "1stEditionHolofoil": { market: 9000 }, unlimitedHolofoil: { market: 400 } } },
        cardmarket: { prices: { averageSellPrice: 300 } },
      }),
      rates,
    );
    expect(quotes.find((quote) => quote.variantKey === "cardmarket")?.variantLabel).toBe("Any printing (Cardmarket)");
  });

  it("moves a saved item to the current printing when its old one disappears", () => {
    const saved: CollectionItem = {
      cardId: "sv1-200", name: "X", setName: "S", number: "200", rarity: "R", image: null,
      variantKey: "normal", variantLabel: "Normal", quantity: 1, amountAud: null,
      priceSource: null, priceDate: null, savedAt: "2026-10-01T00:00:00.000Z",
    };
    const card = toPricedCard(
      apiCard({ id: "sv1-200", tcgplayer: { prices: { holofoil: { market: 10 } } } }),
      rates,
    );
    const [next] = applyFreshPrices([saved], [card]);
    expect(next.variantKey).toBe("holofoil");
    expect(next.amountAud).toBe(15);
  });
});

function fakeProcess() {
  const proc = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  return proc;
}

describe("runTesseract (F-13)", () => {
  it("limits OpenMP threads and kills the process when the scan is aborted", async () => {
    const proc = fakeProcess();
    spawn.mockReturnValue(proc);
    const controller = new AbortController();
    const pending = runTesseract(Buffer.from("x"), "6", controller.signal);
    expect(spawn.mock.calls[0]?.[2]?.env?.OMP_THREAD_LIMIT).toBe("1");
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 499 });
    expect(proc.kill).toHaveBeenCalledWith("SIGKILL");
  });
});
