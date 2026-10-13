import type { FxRates } from "@/lib/types";

const USER_AGENT = "CardPrice/1.0 (pokemon card pricer)";
const TTL_MS = 60 * 60 * 1000;
const FX_TIMEOUT_MS = 4000;

type Cache = { at: number; rates: FxRates };
let cache: Cache | null = null;

type FrankfurterResponse = {
  date?: string;
  rates?: { AUD?: number };
};

async function fetchRate(base: "USD" | "EUR"): Promise<{ rate: number; date: string } | null> {
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=AUD`,
      {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(FX_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as FrankfurterResponse;
    const rate = body.rates?.AUD;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || !body.date) return null;
    return { rate, date: body.date };
  } catch {
    return null;
  }
}

export async function getRates(): Promise<FxRates> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;
  const [usd, eur] = await Promise.all([fetchRate("USD"), fetchRate("EUR")]);
  const rates: FxRates = {
    usdAud: usd?.rate ?? null,
    eurAud: eur?.rate ?? null,
    usdDate: usd?.date ?? null,
    eurDate: eur?.date ?? null,
  };
  if (usd || eur) cache = { at: Date.now(), rates };
  return rates;
}

export function resetRateCache(): void {
  cache = null;
}
