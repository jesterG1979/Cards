import { describe, expect, it } from "vitest";
import { canonicalNumber, nameMatch, parseOcr } from "@/lib/ocr-parse";
import { buildSearchQuery } from "@/lib/search-query";

const PIKACHU_OCR = `
Pikachu — . w00 4)
NO..0025 Mouse Pokemon HT 1/4 WT 13.2 lbs
Pika Punch 50
(c) CE) 025/165 @ energy stored in the pouches in its cheeks.
When it is angered, it immediately discharges the energy.
©2023 Pokemon Nintendo / Creatures / GAME FREAK
`;

describe("parseOcr", () => {
  it("reads the collector number and the card name from a real scan", () => {
    const parsed = parseOcr(PIKACHU_OCR);
    expect(parsed.numbers[0]).toMatchObject({ num: "25", denom: "165" });
    expect(parsed.numbers.some((item) => item.denom === "4")).toBe(false);
    expect(parsed.names[0]?.toLowerCase()).toBe("pikachu");
  });

  it("folds letter-like digits in the collector number", () => {
    const parsed = parseOcr("Charizard\nO25/198");
    expect(parsed.numbers[0]).toMatchObject({ num: "25", denom: "198" });
  });
});

describe("nameMatch", () => {
  it("matches the full name inside the scan text", () => {
    expect(nameMatch("Pikachu", PIKACHU_OCR)).toBe(1);
    expect(nameMatch("Raichu", PIKACHU_OCR)).toBe(0);
  });

  it("matches a name when only the Pokémon word was read", () => {
    expect(nameMatch("Umbreon ex", "wimbreon on the bench")).toBe(0);
    expect(nameMatch("Umbreon ex", "Umbreon is on the bench")).toBe(0.85);
  });
});

describe("search query", () => {
  it("builds a contains query and keeps a collector number", () => {
    expect(buildSearchQuery("  pikachu ")).toBe('name:"*pikachu*"');
    expect(buildSearchQuery("pikachu 025")).toBe('name:"*pikachu*" number:"25"');
    expect(canonicalNumber("025")).toBe("25");
  });

  it("rejects an empty search", () => {
    expect(() => buildSearchQuery("   ")).toThrow(/card name/i);
  });
});
