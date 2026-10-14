import { afterEach, describe, expect, it, vi } from "vitest";
import { hashCacheSize, rememberHash } from "@/lib/identify";
import { fetchImage, isAllowedImageUrl, MAX_IMAGE_BYTES } from "@/lib/pokemon";
import { guideCropRect } from "@/lib/guide-crop";

afterEach(() => vi.unstubAllGlobals());

describe("card art fetch (F-03)", () => {
  it("only allows official card art over HTTPS", () => {
    expect(isAllowedImageUrl("https://images.pokemontcg.io/base1/4.png")).toBe(true);
    expect(isAllowedImageUrl("http://images.pokemontcg.io/base1/4.png")).toBe(false);
    expect(isAllowedImageUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedImageUrl("https://images.pokemontcg.io.evil.test/x.png")).toBe(false);
    expect(isAllowedImageUrl("not a url")).toBe(false);
  });

  it("does not fetch other hosts and refuses redirects", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(new Uint8Array(10)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchImage("http://127.0.0.1:38471/")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await fetchImage("https://images.pokemontcg.io/base1/4.png");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("stops reading an oversized image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(MAX_IMAGE_BYTES + 10))));
    await expect(fetchImage("https://images.pokemontcg.io/base1/4.png")).rejects.toThrow("too large");
  });

  it("caps the art hash cache", () => {
    for (let index = 0; index < 1500; index += 1) rememberHash(`https://images.pokemontcg.io/x/${index}.png`, "0");
    expect(hashCacheSize()).toBe(1000);
  });
});

describe("camera guide crop (F-10)", () => {
  it("maps the on-screen guide to video pixels with object-fit contain", () => {
    // 1920x1080 video shown in a 390x844 portrait screen: drawn 390x219 at y=312.5.
    const scale = 390 / 1920;
    const guideH = 200;
    const guideW = guideH * (63 / 88);
    const guide = { left: (390 - guideW) / 2, top: 422 - guideH / 2, width: guideW, height: guideH };
    const crop = guideCropRect({ width: 1920, height: 1080 }, { left: 0, top: 0, width: 390, height: 844 }, guide, 0);
    expect(crop).not.toBeNull();
    expect(crop!.width).toBeCloseTo(guideW / scale, -1);
    expect(crop!.left + crop!.width / 2).toBeCloseTo(960, -1);
  });

  it("returns null when there is no frame", () => {
    expect(guideCropRect({ width: 0, height: 0 }, { left: 0, top: 0, width: 1, height: 1 }, { left: 0, top: 0, width: 1, height: 1 })).toBeNull();
  });
});
