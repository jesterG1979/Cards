import { canonicalNumber, denomValue, nameMatch } from "@/lib/ocr-parse";
import type { OcrRead, PricedCard } from "@/lib/types";

export function scoreCandidate(card: PricedCard, ocr: OcrRead, hashDistance: number | null): number {
  const cardNumber = canonicalNumber(card.number);
  const numberHit = ocr.numbers.some((item) => item.num === cardNumber);
  const denomHit = ocr.numbers.some((item) => {
    if (item.num !== cardNumber) return false;
    const denom = denomValue(item.denom);
    if (denom == null) return false;
    return card.printedTotal === denom || card.total === denom;
  });

  let score = 0;
  if (numberHit) score += 50;
  if (denomHit) score += 40;
  score += Math.round(nameMatch(card.name, ocr.text) * 40);
  if (hashDistance != null) score += Math.max(0, 32 - hashDistance);
  return score;
}

export function releaseTime(releaseDate: string | null): number {
  if (!releaseDate) return 0;
  const time = Date.parse(releaseDate.replace(/\//g, "-"));
  return Number.isFinite(time) ? time : 0;
}
