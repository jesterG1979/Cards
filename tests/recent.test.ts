import { describe, expect, it } from "vitest";
import { rememberScan, type RecentScan } from "@/lib/recent";

function scan(cardId: string, seenAt: string): RecentScan {
  return {
    cardId,
    name: cardId,
    setName: "151",
    number: "25/165",
    image: null,
    amountAud: 0.39,
    seenAt,
  };
}

describe("recent scans", () => {
  it("puts the newest card first and drops duplicates", () => {
    const first = rememberScan([], scan("a", "2026-10-15T00:00:00.000Z"), 8);
    const second = rememberScan(first, scan("b", "2026-10-15T00:01:00.000Z"), 8);
    const again = rememberScan(second, scan("a", "2026-10-15T00:02:00.000Z"), 8);
    expect(again.map((item) => item.cardId)).toEqual(["a", "b"]);
    expect(again[0]?.seenAt).toBe("2026-10-15T00:02:00.000Z");
  });

  it("keeps only the newest eight", () => {
    let items: RecentScan[] = [];
    for (let index = 0; index < 10; index += 1) {
      items = rememberScan(items, scan(`c${index}`, `2026-10-15T00:0${index}:00.000Z`), 8);
    }
    expect(items).toHaveLength(8);
    expect(items[0]?.cardId).toBe("c9");
    expect(items.some((item) => item.cardId === "c0")).toBe(false);
  });
});
