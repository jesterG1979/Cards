import { CardPriceError } from "@/lib/errors";
import { canonicalNumber, numberQueryVariants } from "@/lib/ocr-parse";

function numberClause(raw: string): string {
  const variants = numberQueryVariants(raw).map((value) => `number:"${value}"`);
  if (variants.length === 1) return variants[0] ?? "";
  return `(${variants.join(" OR ")})`;
}

export function buildSearchQuery(input: string): string {
  const fraction = input.match(/([A-Za-z]{0,4}\d{1,3})\s*\/\s*(\d{2,3})/);
  let nameSource = input;
  let num: string | null = null;
  let denom: number | null = null;
  if (fraction?.[1] && fraction[2]) {
    num = canonicalNumber(fraction[1]);
    denom = Number.parseInt(fraction[2], 10);
    const start = fraction.index ?? 0;
    nameSource = `${input.slice(0, start)} ${input.slice(start + fraction[0].length)}`;
  }

  const cleaned = nameSource
    .replace(/[+\-!(){}[\]^"~*?:\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (num && denom != null) {
    const denomClause = `(set.printedTotal:${denom} OR set.total:${denom})`;
    if (!cleaned) return `${numberClause(num)} ${denomClause}`;
    return `name:"*${cleaned}*" ${numberClause(num)} ${denomClause}`;
  }

  if (!cleaned) {
    throw new CardPriceError("Type a card name first.");
  }
  const parts = cleaned.split(" ");
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last && /^\d{1,3}$/.test(last)) {
    const name = parts.slice(0, -1).join(" ");
    return `name:"*${name}*" number:"${canonicalNumber(last)}"`;
  }
  return `name:"*${cleaned}*"`;
}
