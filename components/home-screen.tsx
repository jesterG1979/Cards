"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { totalValue, useCollection, useIsClient } from "@/lib/collection";
import { formatAud } from "@/lib/format";
import { cn } from "cn";

export function HomeScreen() {
  const items = useCollection();
  const ready = useIsClient();
  const value = totalValue(items);
  const summary = !ready
    ? ""
    : items.length === 0
      ? "No cards saved yet"
      : value.pricedCopies === 0
        ? "No prices yet"
        : `Together they're worth ${formatAud(value.aud)}`;

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="pt-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Card Price</h1>
        <p className="mt-2 text-lg leading-snug text-muted-foreground">
          Pokémon cards, in Australian dollars.
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-3">
        <Link href="/scan" className={cn(buttonVariants({ size: "xl" }), "w-full")} data-testid="home-scan">
          Scan a card
        </Link>
        <Link href="/search" className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "w-full")}>
          Search by name
        </Link>
        <Link
          href="/collection"
          className={cn(buttonVariants({ size: "xl", variant: "outline" }), "h-auto w-full flex-col gap-1 py-4")}
        >
          <span>My cards</span>
          {summary ? <span className="text-sm font-bold text-muted-foreground">{summary}</span> : null}
        </Link>
      </div>

      <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
        Prices come from TCGplayer and Cardmarket, changed into Australian dollars. If a price is
        missing, the app says no price. Your card list stays on this phone.
      </p>
    </main>
  );
}
