import { useMemo, useSyncExternalStore } from "react";
import { displayNumber } from "@/lib/format";
import { collectionQuote, preferredVariant, variantLabel } from "@/lib/prices";
import type { CollectionItem, PricedCard } from "@/lib/types";

const KEY = "cardprice.collection.v1";
const EVENT = "cardprice-change";
const MAX_QTY = 500;

export type ValueSummary = {
  aud: number;
  unpricedCopies: number;
  pricedCopies: number;
};

function optionalString(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.length <= 2048);
}

function isItem(value: unknown): value is CollectionItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CollectionItem>;
  return (
    typeof item.cardId === "string" &&
    typeof item.name === "string" &&
    typeof item.variantKey === "string" &&
    item.cardId.length > 0 &&
    item.cardId.length <= 64 &&
    item.variantKey.length <= 64 &&
    Number.isInteger(item.quantity) &&
    (item.quantity as number) > 0 &&
    (item.quantity as number) <= MAX_QTY &&
    (item.amountAud == null ||
      (typeof item.amountAud === "number" && Number.isFinite(item.amountAud) && item.amountAud >= 0)) &&
    optionalString(item.setName) &&
    optionalString(item.number) &&
    optionalString(item.rarity) &&
    optionalString(item.variantLabel) &&
    optionalString(item.image)
  );
}

export function totalValue(items: CollectionItem[]): ValueSummary {
  let aud = 0;
  let unpricedCopies = 0;
  let pricedCopies = 0;
  for (const item of items) {
    if (item.amountAud == null) {
      unpricedCopies += item.quantity;
    } else {
      pricedCopies += item.quantity;
      aud += item.amountAud * item.quantity;
    }
  }
  return { aud: Math.round(aud * 100) / 100, unpricedCopies, pricedCopies };
}

export function unpricedMessage(copies: number): string | null {
  if (copies <= 0) return null;
  if (copies === 1) return "1 card has no price, so it isn't in the total.";
  return `${copies} cards have no price, so they aren't in the total.`;
}

export function upsertItem(items: CollectionItem[], next: CollectionItem): CollectionItem[] {
  const index = items.findIndex(
    (item) => item.cardId === next.cardId && item.variantKey === next.variantKey,
  );
  if (index === -1) return [...items, { ...next, quantity: Math.min(MAX_QTY, next.quantity) }];
  const current = items[index];
  const copy = items.slice();
  copy[index] = {
    ...next,
    quantity: Math.min(MAX_QTY, current.quantity + next.quantity),
    savedAt: current.savedAt,
  };
  return copy;
}

export function setQuantity(items: CollectionItem[], cardId: string, variantKey: string, quantity: number): CollectionItem[] {
  if (quantity <= 0) {
    return items.filter((item) => !(item.cardId === cardId && item.variantKey === variantKey));
  }
  return items.map((item) =>
    item.cardId === cardId && item.variantKey === variantKey
      ? { ...item, quantity: Math.min(MAX_QTY, quantity) }
      : item,
  );
}

export function applyFreshPrices(items: CollectionItem[], cards: PricedCard[]): CollectionItem[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return items.map((item) => {
    const card = byId.get(item.cardId);
    if (!card) return item;
    let variantKey = item.variantKey;
    // The printing this item was saved under is gone upstream (for example it was saved as
    // "normal" while TCGplayer had no data, and TCGplayer now lists it as "holofoil").
    // Move it to the card's current preferred printing unless that would clash with another item.
    if (!card.quotes.some((quote) => quote.variantKey === variantKey)) {
      const next = preferredVariant(card.quotes);
      const clash = items.some((other) => other.cardId === item.cardId && other.variantKey === next);
      if (!clash) variantKey = next;
    }
    const quote = collectionQuote(card.quotes, variantKey);
    return {
      ...item,
      variantKey,
      name: card.name,
      setName: card.setName,
      number: card.number,
      printedTotal: card.printedTotal,
      rarity: card.rarity,
      image: card.imageSmall ?? item.image,
      variantLabel:
        quote?.variantLabel ??
        (variantKey === item.variantKey ? item.variantLabel : variantLabel(variantKey)),
      amountAud: quote?.amountAud ?? null,
      priceSource: quote?.source ?? null,
      priceDate: quote?.sourceDate ?? null,
    };
  });
}

function parseStored(raw: string | null): CollectionItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isItem);
  } catch {
    return [];
  }
}

export function readCollection(): CollectionItem[] {
  if (typeof localStorage === "undefined") return [];
  return parseStored(localStorage.getItem(KEY));
}

export function writeCollection(items: CollectionItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useCollection(): CollectionItem[] {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null);
  return useMemo(() => parseStored(raw), [raw]);
}

export function removeItem(
  items: CollectionItem[],
  cardId: string,
  variantKey: string,
): { items: CollectionItem[]; removed: CollectionItem | null } {
  const removed = items.find((item) => item.cardId === cardId && item.variantKey === variantKey) ?? null;
  return {
    items: items.filter((item) => !(item.cardId === cardId && item.variantKey === variantKey)),
    removed,
  };
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function collectionToCsv(items: CollectionItem[]): string {
  const lines = ["name,set,number,variant,quantity,price_aud,source,price_date,saved_at"];
  for (const item of items) {
    lines.push(
      [
        csvCell(item.name),
        csvCell(item.setName),
        csvCell(displayNumber(item.number, item.printedTotal)),
        csvCell(item.variantLabel),
        String(item.quantity),
        item.amountAud == null ? "" : item.amountAud.toFixed(2),
        csvCell(item.priceSource),
        csvCell(item.priceDate),
        csvCell(item.savedAt),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
