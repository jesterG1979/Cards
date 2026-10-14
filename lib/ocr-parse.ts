import type { CollectorNumber, OcrRead } from "@/lib/types";

const STOP = new Set([
  "basic",
  "stage",
  "pokemon",
  "pokémon",
  "mouse",
  "weakness",
  "resistance",
  "retreat",
  "illus",
  "illustrator",
  "nintendo",
  "creatures",
  "freak",
  "game",
  "evolves",
  "evolve",
  "evolved",
  "search",
  "your",
  "deck",
  "shuffle",
  "attach",
  "damage",
  "energy",
  "prize",
  "when",
  "this",
  "that",
  "then",
  "with",
  "and",
  "the",
  "for",
  "you",
  "opponent",
  "knocked",
  "active",
  "bench",
  "during",
  "next",
  "turn",
  "from",
  "onto",
  "into",
  "card",
  "cards",
  "ability",
  "rule",
  "item",
  "supporter",
  "stadium",
  "trainer",
  "special",
  "tool",
  "charge",
  "punch",
  "kick",
  "blast",
  "colorless",
  "colourless",
  "lightning",
  "fire",
  "water",
  "grass",
  "psychic",
  "fighting",
  "darkness",
  "metal",
  "dragon",
  "fairy",
  "stored",
  "immediately",
  "anger",
  "angered",
  "attack",
  "attacks",
  "discard",
  "flip",
  "coin",
  "heads",
  "tails",
  "draw",
  "hand",
  "benched",
  "defending",
  "prevent",
  "effect",
  "effects",
  "height",
  "weight",
  "length",
  "vmax",
  "vstar",
  "tera",
  "has",
  "are",
  "all",
  "its",
  "not",
  "may",
  "can",
  "one",
  "two",
  "put",
]);

const NUMBER_RE = /\b([A-Z]{0,3}\d{1,3}[A-Z]?)\s*[/|]\s*([A-Z]{0,3}\d{2,3})\b/gi;

export function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalNumber(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  // Optional one-letter suffix for alternate prints such as 75a.
  const match = trimmed.match(/^([A-Z]*?)(\d+)([A-Z]?)$/);
  if (!match) return trimmed;
  let prefix = match[1];
  let digits = match[2];
  const suffix = match[3].toLowerCase();
  // A lone O in front of the digits is almost always a misread 0.
  if (prefix.length > 0 && /^O+$/.test(prefix)) {
    digits = `${"0".repeat(prefix.length)}${digits}`;
    prefix = "";
  }
  digits = digits.replace(/^0+/, "") || "0";
  return `${prefix}${digits}${suffix}`;
}

export function numberQueryVariants(raw: string): string[] {
  const canonical = canonicalNumber(raw);
  const match = canonical.match(/^([A-Z]*)(\d+)([a-z]?)$/);
  if (!match) return [raw.trim()];
  const prefix = match[1];
  const digits = match[2];
  const suffix = match[3];
  return [
    ...new Set([
      canonical,
      `${prefix}${digits.padStart(3, "0")}${suffix}`,
      `${prefix}${digits.padStart(2, "0")}${suffix}`,
    ]),
  ];
}

export function denomValue(raw: string): number | null {
  const digits = raw.replace(/^[A-Z]+/i, "").replace(/[A-Z]$/i, "");
  const value = parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

function plausible(num: string, denom: string): boolean {
  const n = denomValue(num);
  const d = denomValue(denom);
  if (n == null || d == null) return false;
  // Celebrations (25), McDonald's (12-25) and other small sets print totals under 30.
  // Below 10 is too easy to confuse with fractions in attack text ("1/4").
  return d >= 10 && d <= 400 && n >= 1 && n <= 400;
}

function digitFold(text: string): string {
  return text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
}

function collectNumbers(text: string): CollectorNumber[] {
  const counts = new Map<string, CollectorNumber & { count: number }>();
  for (const source of [text, digitFold(text)]) {
    for (const match of source.matchAll(NUMBER_RE)) {
      const num = match[1];
      const denom = match[2];
      if (!plausible(num, denom)) continue;
      const key = `${canonicalNumber(num)}/${denomValue(denom)}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          num: canonicalNumber(num),
          denom: String(denomValue(denom)),
          raw: match[0],
          count: 1,
        });
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ num, denom, raw }) => ({ num, denom, raw }));
}

function collectNames(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 15);
  const found: { word: string; index: number }[] = [];
  const seen = new Set<string>();
  lines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(/\p{L}{3,}/gu)) {
      const word = match[0];
      const key = norm(word);
      // Three-letter names (Mew, Muk) only count near the top, where the card name is, and
      // only when capitalised, so body words like "has" or "two" don't leak in.
      const shortName = key.length === 3 && lineIndex < 3 && /^\p{Lu}/u.test(word);
      if ((key.length < 4 && !shortName) || STOP.has(key) || seen.has(key)) continue;
      seen.add(key);
      found.push({ word, index: lineIndex });
    }
  });
  found.sort((a, b) => a.index - b.index || b.word.length - a.word.length);
  return found.slice(0, 5).map((item) => item.word);
}

export function parseOcr(text: string): OcrRead {
  return {
    text,
    numbers: collectNumbers(text).slice(0, 3),
    names: collectNames(text),
  };
}

function hasWord(text: string, word: string): boolean {
  return ` ${text} `.includes(` ${word} `);
}

/**
 * How well a card name matches the OCR text, 0 to 1. Whole words only, so "Mew"
 * does not match "Mewtwo", "Abra" does not match "Kadabra" and "N" does not match
 * every word containing an n.
 */
export function nameMatch(cardName: string, blob: string): number {
  const name = norm(cardName);
  const text = norm(blob);
  if (!name || !text) return 0;
  if (hasWord(text, name)) return 1;
  const tokens = name.split(" ").filter((token) => token.length > 2);
  if (tokens.length > 0 && tokens.every((token) => hasWord(text, token))) return 0.85;
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 4 && hasWord(text, longest)) return 0.55;
  // OCR sometimes glues the name to the next word ("pikachuhp"); allow a weak hit for longer names.
  if (name.length >= 5 && text.includes(name)) return 0.55;
  return 0;
}
