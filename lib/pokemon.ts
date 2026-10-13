import { CardPriceError } from "@/lib/errors";
import { denomValue, numberQueryVariants } from "@/lib/ocr-parse";
import type { ApiCard } from "@/lib/types";

const BASE = "https://api.pokemontcg.io/v2";
const USER_AGENT = "CardPrice/1.0 (pokemon card pricer)";
const SELECT = "id,name,number,rarity,supertype,subtypes,set,images,tcgplayer,cardmarket";

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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    const response = await fetch(url, { headers: headers(), cache: "no-store" });
    if (response.ok) {
      const body = (await response.json()) as { data?: unknown[]; totalCount?: number };
      const data = (body.data ?? []).map(asCard).filter((card): card is ApiCard => card !== null);
      return { data, totalCount: body.totalCount ?? data.length };
    }
    lastStatus = response.status;
    if (response.status < 500 && response.status !== 429) break;
  }
  console.error(`Pokemon TCG API failed with status ${lastStatus}`);
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

export async function fetchCardsByIds(ids: string[]): Promise<ApiCard[]> {
  if (ids.length === 0) return [];
  const query = ids.map((id) => `id:"${id.replace(/"/g, "")}"`).join(" OR ");
  const url = new URL(`${BASE}/cards`);
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(Math.min(250, ids.length)));
  url.searchParams.set("select", SELECT);
  const { data } = await apiGet(url);
  return data;
}

export function narrowByDenom(cards: ApiCard[], denom: string): ApiCard[] {
  const value = denomValue(denom);
  if (value == null) return cards;
  const hits = cards.filter((card) => card.set.printedTotal === value || card.set.total === value);
  return hits.length > 0 ? hits : cards;
}

export async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`image ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
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
