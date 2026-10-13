"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardImage } from "@/components/card-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { TopBar } from "@/components/top-bar";
import {
  applyFreshPrices,
  readCollection,
  setQuantity,
  totalValue,
  unpricedMessage,
  useCollection,
  useIsClient,
  writeCollection,
} from "@/lib/collection";
import { formatAud, formatSourceDate } from "@/lib/format";
import type { CollectionItem, PricedCard } from "@/lib/types";
import { cn } from "cn";

export function CollectionScreen() {
  const items = useCollection();
  const ready = useIsClient();
  const [note, setNote] = useState<string | null>(null);
  const idList = [...new Set(items.map((item) => item.cardId))].join(",");

  useEffect(() => {
    if (!ready || !idList) return;
    const saved = readCollection();
    let cancel = false;

    async function refresh() {
      try {
        const response = await fetch(`/api/cards?ids=${encodeURIComponent(idList)}`);
        const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "refresh failed");
        if (cancel) return;
        writeCollection(applyFreshPrices(saved, payload.cards ?? []));
      } catch {
        if (!cancel) setNote("Couldn't refresh prices. Showing the prices you last saved.");
      }
    }

    void refresh();
    return () => {
      cancel = true;
    };
  }, [ready, idList]);

  function update(next: CollectionItem[]) {
    writeCollection(next);
  }

  const value = totalValue(items);
  const missing = unpricedMessage(value.unpricedCopies);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="My cards" />
      <div className="px-5 py-5">
        <p className="text-base font-bold text-muted-foreground">Together they&apos;re worth</p>
        <p className="text-5xl font-extrabold tracking-tight" data-testid="collection-total">
          {!ready ? "…" : value.pricedCopies === 0 ? "No prices yet" : formatAud(value.aud)}
        </p>
        {missing ? <p className="mt-2 text-base">{missing}</p> : null}
        {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
        <p className="mt-3 text-sm text-muted-foreground">Your list stays on this phone.</p>
      </div>

      {ready && items.length === 0 ? (
        <div className="flex flex-col gap-4 px-5">
          <p className="text-lg">No cards yet. Scan one, then tap Add to my cards.</p>
          <Link href="/scan" className={cn(buttonVariants({ size: "xl" }), "w-full")}>
            Scan a card
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-10">
          {items.map((item) => (
            <li key={`${item.cardId}:${item.variantKey}`} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
              <div className="flex gap-3">
                <CardImage src={item.image} alt="" className="h-28 w-20 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold leading-tight">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.setName} · {item.number}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.variantLabel}</p>
                  <p className="mt-1 text-2xl font-extrabold">{formatAud(item.amountAud)}</p>
                  {item.amountAud != null ? (
                    <p className="text-xs text-muted-foreground">
                      {item.priceSource} · {formatSourceDate(item.priceDate)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not counted in the total</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {item.quantity === 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-4 font-extrabold"
                    onClick={() => update(setQuantity(items, item.cardId, item.variantKey, 0))}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12 text-2xl font-extrabold"
                    onClick={() => update(setQuantity(items, item.cardId, item.variantKey, item.quantity - 1))}
                    aria-label={`Fewer ${item.name}`}
                  >
                    −
                  </Button>
                )}
                <span className="min-w-10 text-center text-xl font-extrabold">{item.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 text-2xl font-extrabold"
                  onClick={() => update(setQuantity(items, item.cardId, item.variantKey, item.quantity + 1))}
                  aria-label={`More ${item.name}`}
                >
                  +
                </Button>
                {item.quantity > 1 && item.amountAud != null ? (
                  <span className="ml-auto text-sm font-bold">
                    {formatAud(Math.round(item.amountAud * item.quantity * 100) / 100)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
