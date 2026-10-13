import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardPriceError } from "@/lib/errors";
import type { ApiCard, OcrRead } from "@/lib/types";

const { searchCards, fetchCardsByNumber } = vi.hoisted(() => ({
  searchCards: vi.fn(),
  fetchCardsByNumber: vi.fn(),
}));

vi.mock("@/lib/pokemon", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pokemon")>("@/lib/pokemon");
  return {
    ...actual,
    searchCards: (...args: unknown[]) => searchCards(...args),
    fetchCardsByNumber: (...args: unknown[]) => fetchCardsByNumber(...args),
  };
});

import { lookupPool } from "@/lib/identify";
import { fetchCardsByIds, selectByDenom } from "@/lib/pokemon";

function apiCard(id: string, printedTotal: number): ApiCard {
  return {
    id,
    name: "Pikachu",
    number: "25",
    set: { id, name: "Set", printedTotal, total: printedTotal },
  };
}

const ocr: OcrRead = {
  text: "",
  names: ["Pikachu"],
  numbers: [{ num: "25", denom: "165", raw: "25/165" }],
};

describe("lookupPool", () => {
  beforeEach(() => {
    searchCards.mockReset();
    fetchCardsByNumber.mockReset();
  });

  it("falls through to the collector number when the named cards are the wrong set", async () => {
    searchCards.mockResolvedValue([apiCard("base-58", 102)]);
    fetchCardsByNumber.mockResolvedValue([apiCard("sv3pt5-25", 165), apiCard("base-58", 102)]);

    const found = await lookupPool(ocr);

    expect(fetchCardsByNumber).toHaveBeenCalledWith("25");
    expect(found.map((card) => card.id)).toEqual(["sv3pt5-25"]);
  });

  it("reports a provider failure when every lookup fails", async () => {
    const error = new CardPriceError("The card list didn't load. Try again in a moment.", 502);
    searchCards.mockRejectedValue(error);
    fetchCardsByNumber.mockRejectedValue(error);

    await expect(lookupPool(ocr)).rejects.toMatchObject({ status: 502 });
  });

  it("keeps an empty match when the provider successfully returns nothing", async () => {
    searchCards.mockResolvedValue([]);
    fetchCardsByNumber.mockResolvedValue([]);

    await expect(lookupPool(ocr)).resolves.toEqual([]);
  });
});

describe("selectByDenom", () => {
  it("returns only cards whose set total matches the printed denominator", () => {
    const cards = [apiCard("base-58", 102), apiCard("sv3pt5-25", 165)];
    expect(selectByDenom(cards, "165")?.map((card) => card.id)).toEqual(["sv3pt5-25"]);
    expect(selectByDenom(cards, "200")).toBeNull();
    expect(selectByDenom([], "165")).toBeNull();
  });
});

describe("fetchCardsByIds", () => {
  it("loads every id in bounded batches", async () => {
    const ids = Array.from({ length: 41 }, (_, index) => `sv-${index}`);
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        const url = new URL(String(input));
        const query = url.searchParams.get("q") ?? "";
        queries.push(query);
        const data = ids.filter((id) => query.includes(`id:"${id}"`)).map((id) => apiCard(id, 165));
        return new Response(JSON.stringify({ data, totalCount: data.length }), { status: 200 });
      }),
    );

    const cards = await fetchCardsByIds(ids);

    expect(cards).toHaveLength(41);
    expect(queries).toHaveLength(3);
    expect(queries.every((query) => query.split(" OR ").length <= 20)).toBe(true);
    vi.unstubAllGlobals();
  });
});
