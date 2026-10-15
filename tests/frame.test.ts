import { describe, expect, it } from "vitest";
import { autoSnapReady, frameSteady, holdProgress, meanAbsDiff, SNAP_COOLDOWN_MS } from "@/lib/frame";

describe("frame steadiness", () => {
  it("fires after a move and then a hold", () => {
    expect(frameSteady([12, 0.4, 0.3, 0.2])).toBe(true);
  });

  it("stays quiet when the camera has not moved", () => {
    expect(frameSteady([0.1, 0.1, 0.1, 0.1])).toBe(false);
    expect(frameSteady([12, 9, 0.2, 0.2])).toBe(false);
    expect(frameSteady([0.2, 0.2])).toBe(false);
  });

  it("fills the hold as the card settles", () => {
    expect(holdProgress([0.1, 0.1, 0.1])).toBe(0);
    expect(holdProgress([12, 0.4])).toBeCloseTo(1 / 3);
    expect(holdProgress([12, 0.4, 0.3])).toBeCloseTo(2 / 3);
    expect(holdProgress([12, 0.4, 0.3, 0.2])).toBe(1);
  });

  it("waits a second and a half after a no-match", () => {
    expect(SNAP_COOLDOWN_MS).toBe(1500);
    expect(autoSnapReady(1000, 2500)).toBe(false);
    expect(autoSnapReady(2500, 2500)).toBe(true);
  });

  it("measures how much the sampled pixels changed", () => {
    const previous = new Uint8ClampedArray([0, 0, 0, 255, 10, 0, 0, 255]);
    const next = new Uint8ClampedArray([10, 0, 0, 255, 10, 0, 0, 255]);
    expect(meanAbsDiff(previous, next)).toBe(5);
  });
});
