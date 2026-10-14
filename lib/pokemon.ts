import { CardPriceError } from "@/lib/errors";
import { denomValue, numberQueryVariants } from "@/lib/ocr-parse";
import type { ApiCard } from "@/lib/types";

const BASE = "https://api.pokemontcg.io/v2";
const USER_AGENT = "CardPrice/1.0 (pokemon card pricer)";
const SELECT = "id,name,number,rarity,supertype,subtypes,set,images,tcgplayer,cardmarket";
const API_TIMEOUT_MS = 8000;
const ID_BATCH = 20;

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  const key = process.env.POKEMONTCG_API_KEY;
  if (key) result["X-Api-Key"] = key;
  return result;
}

export function asCard(value: unknown): ApiCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Partial<ApiCard>;
  if (typeof card.id !== "string" || typeof card.name !== "string" || typeof card.number !== "string") {
    return null;
  }
  if (!card.set || typeof card.set.id !== "string" || typeof card.set.name !== "string") return null;
  return card as ApiCard;
}

async function apiGet(url: URL): Promise<{ data: ApiCard[]; totalCount: number }> {
  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    try {
      const response = await fetch(url, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json()) as { data?: unknown[]; totalCount?: number };
        const data = (body.data ?? []).map(asCard).filter((card): card is ApiCard => card !== null);
        return { data, totalCount: body.totalCount ?? data.length };
      }
      lastStatus = response.status;
      lastDetail = "";
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastStatus = 0;
      lastDetail = error instanceof Error ? error.message : "request failed";
    }
  }
  console.error(`Pokemon TCG API failed${lastStatus ? ` with status ${lastStatus}` : ""} ${lastDetail}`.trim());
  throw new CardPriceError("The card list didn't load. Try again in a moment.", 502);
}

export async function searchCards(query: string, pageSize = 20): Promise<ApiCard[]> {
  const url = new URL(`${BASE}/cards`);
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("orderBy", "-set.releaseDate");
  url.searchParams.set("select", SELECT);
  const { data } = await apiGet(url);
  return data;
}

export async function fetchCardsByNumber(num: string): Promise<ApiCard[]> {
  const variants = numberQueryVariants(num).map((value) => value.replace(/"/g, ""));
  const query = variants.map((value) => `number:"${value}"`).join(" OR ");
  const all: ApiCard[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const url = new URL(`${BASE}/cards`);
    url.searchParams.set("q", query);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("select", SELECT);
    const { data, totalCount } = await apiGet(url);
    all.push(...data);
    if (data.length === 0 || all.length >= totalCount) break;
  }
  return all;
}

async function fetchIdBatch(ids: string[]): Promise<ApiCard[]> {
  const query = ids.map((id) => `id:"${id.replace(/"/g, "")}"`).join(" OR ");
  const url = new URL(`${BASE}/cards`);
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(ids.length));
  url.searchParams.set("select", SELECT);
  const { data } = await apiGet(url);
  return data;
}

// Ids like ex10-! and ex10-? are Lucene syntax upstream and can fail a whole OR query,
// so they are looked up on their own and a failure only drops that one card.
const RISKY_ID = /[!?]/;

export async function fetchCardsByIds(ids: string[]): Promise<ApiCard[]> {
  if (ids.length === 0) return [];
  const plain = ids.filter((id) => !RISKY_ID.test(id));
  const risky = ids.filter((id) => RISKY_ID.test(id));
  const all: ApiCard[] = [];
  for (let index = 0; index < plain.length; index += ID_BATCH) {
    all.push(...(await fetchIdBatch(plain.slice(index, index + ID_BATCH))));
  }
  for (const id of risky) {
    try {
      all.push(...(await fetchIdBatch([id])));
    } catch (error) {
      if (!(error instanceof CardPriceError)) throw error;
    }
  }
  return dedupeCards(all);
}

export function selectByDenom(cards: ApiCard[], denom: string): ApiCard[] | null {
  if (cards.length === 0) return null;
  const unique = dedupeCards(cards);
  const value = denomValue(denom);
  if (value == null) return unique;
  const hits = unique.filter((card) => card.set.printedTotal === value || card.set.total === value);
  return hits.length > 0 ? hits : null;
}

const IMAGE_HOST = "images.pokemontcg.io";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Only official card art over HTTPS; anything else from upstream data is refused. */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === IMAGE_HOST && !parsed.port && !parsed.username;
  } catch {
    return false;
  }
}

export async function fetchImage(url: string): Promise<Buffer> {
  if (!isAllowedImageUrl(url)) throw new Error("image url not allowed");
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`image ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new Error("image too large");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("image too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export function dedupeCards(cards: ApiCard[]): ApiCard[] {
  const seen = new Set<string>();
  const result: ApiCard[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}
