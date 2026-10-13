import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dhash, hamming } from "@/lib/dhash";

async function solidSplit(left: number, right: number): Promise<Buffer> {
  const width = 32;
  const height = 24;
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      raw[y * width + x] = x < width / 2 ? left : right;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

describe("dhash", () => {
  it("matches an image with itself and separates a flipped pattern", async () => {
    const darkLeft = await solidSplit(0, 255);
    const darkRight = await solidSplit(255, 0);
    const again = await solidSplit(0, 255);
    const a = await dhash(darkLeft);
    const b = await dhash(darkRight);
    const c = await dhash(again);
    expect(a).toHaveLength(16);
    expect(hamming(a, c)).toBe(0);
    expect(hamming(a, b)).toBeGreaterThan(8);
  });
});
