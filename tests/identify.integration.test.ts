import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { identifyCard } from "@/lib/identify";
import { toAud } from "@/lib/prices";

const USER_AGENT = "CardPrice/1.0 (test)";

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
  });
  if (!response.ok) throw new Error(`download ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

describe("identify a modern card photo", () => {
  it("names Pikachu from the 151 set and prices it in AUD", async () => {
    let photoUrl = "";
    for (let attempt = 0; attempt < 3 && !photoUrl; attempt += 1) {
      const response = await fetch(
        "https://api.pokemontcg.io/v2/cards?q=id:\"sv3pt5-25\"&select=id,images",
        { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
      );
      if (!response.ok) continue;
      const body = (await response.json()) as { data?: { images?: { large?: string } }[] };
      photoUrl = body.data?.[0]?.images?.large ?? "";
    }
    if (!photoUrl) throw new Error("card lookup failed");
    const photo = await download(photoUrl);
    const result = await identifyCard(photo);

    expect(result.candidates[0]?.card.id).toBe("sv3pt5-25");
    expect(result.candidates[0]?.card.name).toBe("Pikachu");
    expect(result.candidates[0]?.card.setName).toBe("151");
    expect(result.candidates[0]?.card.number).toBe("25");

    const quotes = result.candidates[0]?.card.quotes ?? [];
    const priced = quotes.filter((quote) => quote.amountAud != null);
    expect(priced.length).toBeGreaterThan(0);
    for (const quote of priced) {
      expect(quote.source === "TCGplayer" || quote.source === "Cardmarket").toBe(true);
      expect(quote.sourceDate).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
      expect(quote.fxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(quote.fxRate).toBeGreaterThan(0);
      expect(quote.amountAud).toBe(toAud(quote.amountOriginal as number, quote.fxRate as number));
    }
    const missing = quotes.filter((quote) => quote.amountAud == null);
    for (const quote of missing) {
      expect(quote.amountAud).toBeNull();
    }

    const phone = await sharp(photo).rotate(2, { background: "#d8d0c4" }).jpeg({ quality: 72 }).toBuffer();
    const again = await identifyCard(phone);
    expect(again.candidates[0]?.card.id).toBe("sv3pt5-25");
  });
});
