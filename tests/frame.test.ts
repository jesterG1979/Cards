import { describe, expect, it } from "vitest";
import { frameSteady, meanAbsDiff } from "@/lib/frame";

describe("frame steadiness", () => {
  it("fires after a move and then a hold", () => {
    expect(frameSteady([12, 0.4, 0.3, 0.2])).toBe(true);
  });

  it("stays quiet when the camera has not moved", () => {
    expect(frameSteady([0.1, 0.1, 0.1, 0.1])).toBe(false);
    expect(frameSteady([12, 9, 0.2, 0.2])).toBe(false);
    expect(frameSteady([0.2, 0.2])).toBe(false);
  });

  it("measures how much the sampled pixels changed", () => {
    const previous = new Uint8ClampedArray([0, 0, 0, 255, 10, 0, 0, 255]);
    const next = new Uint8ClampedArray([10, 0, 0, 255, 10, 0, 0, 255]);
    expect(meanAbsDiff(previous, next)).toBe(5);
  });
});
