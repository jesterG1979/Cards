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

const RETRY_MS = 5 * 60 * 1000;

type Rate = { rate: number; date: string };
// Last good rate per currency, kept so one failed call doesn't blank out that currency.
let lastUsd: Rate | null = null;
let lastEur: Rate | null = null;
let inFlight: Promise<FxRates> | null = null;

async function loadRates(): Promise<FxRates> {
  const [usd, eur] = await Promise.all([fetchRate("USD"), fetchRate("EUR")]);
  if (usd) lastUsd = usd;
  if (eur) lastEur = eur;
  const useUsd = usd ?? lastUsd;
  const useEur = eur ?? lastEur;
  const rates: FxRates = {
    usdAud: useUsd?.rate ?? null,
    eurAud: useEur?.rate ?? null,
    usdDate: useUsd?.date ?? null,
    eurDate: useEur?.date ?? null,
  };
  if (usd && eur) {
    cache = { at: Date.now(), rates };
  } else if (useUsd || useEur) {
    // Partial or total outage: serve what we have, but try again in a few minutes, not an hour.
    cache = { at: Date.now() - TTL_MS + RETRY_MS, rates };
  }
  return rates;
}

export async function getRates(): Promise<FxRates> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;
  if (!inFlight) {
    inFlight = loadRates().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function resetRateCache(): void {
  cache = null;
  lastUsd = null;
  lastEur = null;
  inFlight = null;
}
