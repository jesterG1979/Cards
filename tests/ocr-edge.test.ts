import { describe, expect, it } from "vitest";
import { canonicalNumber, nameMatch, numberQueryVariants, parseOcr } from "@/lib/ocr-parse";

describe("collector numbers (F-07)", () => {
  it("reads small sets like Celebrations 005/025", () => {
    expect(parseOcr("Pikachu\n005/025").numbers[0]).toMatchObject({ num: "5", denom: "25" });
  });

  it("still ignores tiny fractions from attack text", () => {
    expect(parseOcr("Flip a coin. 1/4 of the damage").numbers).toEqual([]);
  });

  it("keeps a letter suffix such as 75a/168", () => {
    const read = parseOcr("Lugia\n75a/168");
    expect(read.numbers[0]).toMatchObject({ num: "75a", denom: "168" });
    expect(numberQueryVariants("75a")).toContain("075a");
    expect(canonicalNumber("075A")).toBe("75a");
  });

  it("handles Trainer Gallery numbers", () => {
    const read = parseOcr("Pikachu\nTG05/TG30");
    expect(read.numbers[0]).toMatchObject({ num: "TG5", denom: "30" });
    expect(numberQueryVariants("TG5")).toContain("TG05");
  });
});

describe("card names (F-08)", () => {
  it("keeps a three-letter name at the top of the card", () => {
    const read = parseOcr("Basic Pokémon\nMew ex\nRestart\nDraw cards until you have 3 cards in your hand.");
    expect(read.names[0]).toBe("Mew");
    expect(read.names).not.toContain("Draw");
    expect(read.names).not.toContain("hand");
  });

  it("does not pick lowercase three-letter body words", () => {
    const read = parseOcr("Pikachu\nthe one has two");
    expect(read.names).toEqual(["Pikachu"]);
  });
});

describe("nameMatch whole words (F-09)", () => {
  it("does not give full credit for a name inside a longer word", () => {
    expect(nameMatch("Mew", "Mewtwo Strikes Back")).toBe(0);
    expect(nameMatch("Abra", "Kadabra")).toBe(0);
    expect(nameMatch("N", "Pokemon")).toBe(0);
    expect(nameMatch("Pidgeot", "Pidgeotto")).toBeLessThan(1);
  });

  it("still gives full credit for the real name", () => {
    expect(nameMatch("Mew", "Basic Mew ex")).toBe(1);
    expect(nameMatch("Pidgeotto", "Stage 1 Pidgeotto")).toBe(1);
    expect(nameMatch("Charizard ex", "Charizard ex 330 HP")).toBe(1);
    expect(nameMatch("N", "Supporter N")).toBe(1);
  });
});
