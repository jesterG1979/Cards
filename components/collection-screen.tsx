"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardImage } from "@/components/card-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { TopBar } from "@/components/top-bar";
import {
  applyFreshPrices,
  collectionToCsv,
  readCollection,
  removeItem,
  setQuantity,
  totalValue,
  unpricedMessage,
  useCollection,
  useIsClient,
  writeCollection,
} from "@/lib/collection";
import { deliverCollectionCsv } from "@/lib/csv-share";
import { displayNumber, formatAud, formatSourceDate } from "@/lib/format";
import type { CollectionItem, PricedCard } from "@/lib/types";
import { cn } from "cn";

export function CollectionScreen() {
  const items = useCollection();
  const ready = useIsClient();
  const [note, setNote] = useState<string | null>(null);
  const [undo, setUndo] = useState<CollectionItem | null>(null);
  const idList = [...new Set(items.map((item) => item.cardId))].join(",");

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!ready || !idList) return;
    let cancel = false;
    const ids = idList.split(",");

    async function refresh() {
      try {
        const cards: PricedCard[] = [];
        for (let index = 0; index < ids.length; index += 20) {
          const chunk = ids.slice(index, index + 20).join(",");
          const response = await fetch(`/api/cards?ids=${encodeURIComponent(chunk)}`);
          const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
          if (!response.ok) throw new Error(payload.error || "refresh failed");
          if (cancel) return;
          cards.push(...(payload.cards ?? []));
        }
        if (cancel) return;
        writeCollection(applyFreshPrices(readCollection(), cards));
        setNote(null);
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

  function remove(item: CollectionItem) {
    const result = removeItem(items, item.cardId, item.variantKey);
    update(result.items);
    setUndo(result.removed);
    if (result.items.length === 0) setNote(null);
  }

  function restore() {
    if (!undo) return;
    update([...readCollection().filter((item) => !(item.cardId === undo.cardId && item.variantKey === undo.variantKey)), undo]);
    setUndo(null);
  }

  function exportCsv() {
    const csv = collectionToCsv(readCollection());
    void deliverCollectionCsv(csv, "my-cards.csv", {
      canShareFiles: (file) => navigator.canShare?.({ files: [file] }) ?? false,
      shareFiles: (file) => navigator.share({ files: [file] }),
      createObjectURL: (blob) => URL.createObjectURL(blob),
      revokeObjectURL: (url) => URL.revokeObjectURL(url),
      download: (url, fileName) => {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
      },
      later: (callback, delayMs) => {
        window.setTimeout(callback, delayMs);
      },
    }).catch(() => {
      // The share sheet was dismissed. The list stays on this phone.
    });
  }

  const value = totalValue(items);
  const missing = unpricedMessage(value.unpricedCopies);
  const rows = [...items].sort((a, b) => {
    const left = a.amountAud == null ? -1 : a.amountAud * a.quantity;
    const right = b.amountAud == null ? -1 : b.amountAud * b.quantity;
    return right - left;
  });

  const empty = ready && items.length === 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="My cards" />
      {empty ? (
        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-lg">No cards yet. Scan one, then tap Add to My cards.</p>
          <Link href="/scan" className={cn(buttonVariants({ size: "xl" }), "w-full")}>
            Scan a card
          </Link>
        </div>
      ) : (
        <>
      <div className="px-5 py-5">
        <p className="text-base font-bold text-muted-foreground">Together they&apos;re worth</p>
        <p className="text-5xl font-extrabold tracking-tight" data-testid="collection-total">
          {!ready ? "…" : value.pricedCopies === 0 ? "No prices yet" : formatAud(value.aud)}
        </p>
        {missing ? <p className="mt-2 text-base">{missing}</p> : null}
        {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Your list stays on this phone.</p>
          {ready && items.length > 0 ? (
            <Button type="button" variant="outline" className="h-11 px-4 font-extrabold" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>
        <ul className="flex flex-col gap-3 px-5 pb-28">
          {rows.map((item) => (
            <li key={`${item.cardId}:${item.variantKey}`} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
              <div className="flex gap-3">
                <CardImage
                  src={item.image}
                  alt={`${item.name}, ${item.setName}`}
                  className="h-28 w-20 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold leading-tight">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.setName} · {displayNumber(item.number, item.printedTotal)}
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
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove(item)}
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
        </>
      )}

      {undo ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[480px] items-center justify-between gap-3 bg-ink px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
          <p className="font-extrabold">Removed {undo.name}</p>
          <Button type="button" size="xl" className="h-12" onClick={restore} data-testid="undo-remove">
            Undo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
