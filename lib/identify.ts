import { dhash, hamming } from "@/lib/dhash";
import { CardPriceError } from "@/lib/errors";
import { getRates } from "@/lib/fx";
import { bottomBand, preprocessCard } from "@/lib/preprocess";
import { runTesseract } from "@/lib/ocr";
import { parseOcr } from "@/lib/ocr-parse";
import { dedupeCards, fetchCardsByNumber, fetchImage, narrowByDenom, searchCards } from "@/lib/pokemon";
import { toPricedCard } from "@/lib/prices";
import { releaseTime, scoreCandidate } from "@/lib/score";
import { buildSearchQuery } from "@/lib/search-query";
import type { ApiCard, IdentifyResult, PricedCard } from "@/lib/types";

const hashCache = new Map<string, string>();

async function readCardText(prepared: Buffer): Promise<string> {
  const full = await runTesseract(prepared, "6");
  if (parseOcr(full).numbers.length > 0) return full;
  const band = await bottomBand(prepared);
  const [sparse, bottom] = await Promise.all([
    runTesseract(prepared, "11").catch(() => ""),
    runTesseract(band, "6").catch(() => ""),
  ]);
  return [full, sparse, bottom].filter(Boolean).join("\n");
}

async function hashUrl(url: string): Promise<string | null> {
  const cached = hashCache.get(url);
  if (cached) return cached;
  try {
    const image = await fetchImage(url);
    const hash = await dhash(image);
    hashCache.set(url, hash);
    return hash;
  } catch {
    return null;
  }
}

async function searchQuietly(query: string, pageSize: number): Promise<ApiCard[]> {
  try {
    return await searchCards(query, pageSize);
  } catch (error) {
    if (!(error instanceof CardPriceError)) throw error;
    return [];
  }
}

async function lookupPool(ocr: ReturnType<typeof parseOcr>): Promise<ApiCard[]> {
  const names = ocr.names.slice(0, 3).map((name) => name.replace(/"/g, ""));
  for (const number of ocr.numbers) {
    const named: ApiCard[] = [];
    for (const name of names) {
      named.push(...(await searchQuietly(`name:"${name}" number:"${number.num}"`, 30)));
    }
    if (named.length > 0) return dedupeCards(narrowByDenom(named, number.denom));
    try {
      const found = await fetchCardsByNumber(number.num);
      if (found.length > 0) return dedupeCards(narrowByDenom(found, number.denom));
    } catch (error) {
      if (!(error instanceof CardPriceError)) throw error;
    }
  }
  for (const name of names) {
    const found = await searchQuietly(buildSearchQuery(name), 16);
    if (found.length > 0) return found;
  }
  return [];
}

export async function identifyCard(image: Buffer): Promise<IdentifyResult> {
  const prepared = await preprocessCard(image);
  const ocrText = await readCardText(prepared);
  const ocr = parseOcr(ocrText);
  const rates = await getRates();
  const pool = await lookupPool(ocr);

  const photoHash = await dhash(prepared);
  const priced: { card: PricedCard; hashDistance: number | null; score: number }[] = pool.map((card) => {
    const pricedCard = toPricedCard(card, rates);
    return {
      card: pricedCard,
      hashDistance: null,
      score: scoreCandidate(pricedCard, ocr, null),
    };
  });

  priced.sort(
    (a, b) => b.score - a.score || releaseTime(b.card.releaseDate) - releaseTime(a.card.releaseDate),
  );

  const shortlist = priced.slice(0, 8);
  await Promise.all(
    shortlist.map(async (candidate) => {
      const url = candidate.card.imageSmall;
      if (!url) return;
      const hash = await hashUrl(url);
      if (!hash) return;
      candidate.hashDistance = hamming(photoHash, hash);
      candidate.score = scoreCandidate(candidate.card, ocr, candidate.hashDistance);
    }),
  );

  shortlist.sort(
    (a, b) => b.score - a.score || releaseTime(b.card.releaseDate) - releaseTime(a.card.releaseDate),
  );

  return {
    ocrText,
    numbers: ocr.numbers,
    names: ocr.names,
    candidates: shortlist.slice(0, 5),
  };
}
