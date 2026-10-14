import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRates, resetRateCache } from "@/lib/fx";

function rateResponse(rate: number) {
  return new Response(JSON.stringify({ date: "2026-10-13", rates: { AUD: rate } }), { status: 200 });
}

describe("getRates (F-12)", () => {
  beforeEach(() => resetRateCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a failed currency within minutes, not an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let usdUp = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("base=USD")) return usdUp ? rateResponse(1.5) : new Response("", { status: 502 });
        return rateResponse(1.7);
      }),
    );

    const first = await getRates();
    expect(first.usdAud).toBeNull();
    expect(first.eurAud).toBe(1.7);

    usdUp = true;
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    const second = await getRates();
    expect(second.usdAud).toBe(1.5);
  });

  it("keeps the last good rate for a currency that fails later", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let usdUp = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("base=USD") && !usdUp ? new Response("", { status: 502 }) : rateResponse(url.includes("USD") ? 1.5 : 1.7),
      ),
    );
    await getRates();
    usdUp = false;
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    const later = await getRates();
    expect(later.usdAud).toBe(1.5);
  });

  it("shares one upstream call between concurrent requests", async () => {
    const fetchMock = vi.fn(async (url: string) => rateResponse(url.includes("USD") ? 1.5 : 1.7));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([getRates(), getRates(), getRates()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
