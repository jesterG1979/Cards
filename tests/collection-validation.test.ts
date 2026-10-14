import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCollection } from "@/lib/collection";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
});

const good = { cardId: "sv3pt5-25", name: "Pikachu", variantKey: "normal", quantity: 1, amountAud: 0.39 };

describe("stored collection validation (F-16)", () => {
  it("drops items with bad quantities or prices", () => {
    store.set(
      "cardprice.collection.v1",
      `[${JSON.stringify(good)},
        {"cardId":"a","name":"A","variantKey":"normal","quantity":1e999,"amountAud":1},
        {"cardId":"b","name":"B","variantKey":"normal","quantity":1.5,"amountAud":1},
        {"cardId":"c","name":"C","variantKey":"normal","quantity":1,"amountAud":"1.23"},
        {"cardId":"d","name":"D","variantKey":"normal","quantity":1,"amountAud":-5},
        {"cardId":"e","name":"E","variantKey":"normal","quantity":1,"amountAud":null,"setName":7}]`,
    );
    expect(readCollection().map((item) => item.cardId)).toEqual(["sv3pt5-25"]);
  });
});
