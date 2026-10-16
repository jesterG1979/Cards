import { useMemo, useSyncExternalStore } from "react";

const KEY = "cardprice.recent.v1";
const EVENT = "cardprice-recent";

export type RecentScan = {
  cardId: string;
  name: string;
  setName: string;
  number: string;
  image: string | null;
  amountAud: number | null;
  seenAt: string;
};

export function rememberScan(items: RecentScan[], next: RecentScan, limit = 8): RecentScan[] {
  const rest = items.filter((item) => item.cardId !== next.cardId);
  return [next, ...rest].slice(0, Math.max(0, limit));
}

function isScan(value: unknown): value is RecentScan {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentScan>;
  return typeof item.cardId === "string" && typeof item.name === "string" && typeof item.seenAt === "string";
}

function parseStored(raw: string | null): RecentScan[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScan);
  } catch {
    return [];
  }
}

export function readRecent(): RecentScan[] {
  if (typeof localStorage === "undefined") return [];
  return parseStored(localStorage.getItem(KEY));
}

export function writeRecent(items: RecentScan[]): void {
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

export function useRecent(): RecentScan[] {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null);
  return useMemo(() => parseStored(raw), [raw]);
}
