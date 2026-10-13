import { CardPriceError } from "@/lib/errors";
import { canonicalNumber } from "@/lib/ocr-parse";

export function buildSearchQuery(input: string): string {
  const cleaned = input
    .replace(/[+\-!(){}[\]^"~*?:\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    throw new CardPriceError("Type a card name first.");
  }
  const parts = cleaned.split(" ");
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /^\d{1,3}$/.test(last)) {
    const name = parts.slice(0, -1).join(" ");
    return `name:"*${name}*" number:"${canonicalNumber(last)}"`;
  }
  return `name:"*${cleaned}*"`;
}
