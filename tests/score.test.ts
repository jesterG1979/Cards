import { describe, expect, it } from "vitest";
import { parseOcr } from "@/lib/ocr-parse";
import { scoreCandidate } from "@/lib/score";
import type { PricedCard } from "@/lib/types";

function card(overrides: Partial<PricedCard>): PricedCard {
  return {
    id: "x",
    name: "Pikachu",
    number: "25",
    rarity: "Common",
    supertype: "Pokémon",
    subtypes: ["Basic"],
    setId: "sv3pt5",
    setName: "151",
    printedTotal: 165,
    total: 207,
    releaseDate: "2023/09/22",
    imageSmall: null,
    imageLarge: null,
    quotes: [],
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("ranks the modern Pikachu above the older card with the same number", () => {
    const ocr = parseOcr("Pikachu\n025/165\nPika Punch");
    const pikachu = card({ id: "sv3pt5-25", name: "Pikachu", printedTotal: 165 });
    const raichu = card({
      id: "ecard1-25",
      name: "Raichu",
      setId: "ecard1",
      setName: "Expedition Base Set",
      printedTotal: 165,
      releaseDate: "2002/09/15",
    });

    const withPhoto = scoreCandidate(pikachu, ocr, 17);
    const otherPhoto = scoreCandidate(raichu, ocr, 28);
    expect(withPhoto).toBeGreaterThan(otherPhoto);

    const photoOnly = scoreCandidate(pikachu, { text: "", numbers: ocr.numbers, names: [] }, 0);
    const otherOnly = scoreCandidate(raichu, { text: "", numbers: ocr.numbers, names: [] }, 23);
    expect(photoOnly).toBeGreaterThan(otherOnly);
  });
});
