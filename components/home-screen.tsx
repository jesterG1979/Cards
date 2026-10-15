"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/card-image";
import { CardMatch } from "@/components/card-match";
import { TopBar } from "@/components/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { totalValue, useCollection, useIsClient } from "@/lib/collection";
import { collectorLabel, displayNumber, formatAud, formatSourceDate } from "@/lib/format";
import { priceBoard } from "@/lib/prices";
import { useRecent, type RecentScan } from "@/lib/recent";
import type { PricedCard } from "@/lib/types";
import { cn } from "cn";

function searchErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text === "Failed to fetch") {
    return "Couldn't reach the card list. Check your connection and try again.";
  }
  return text || "The card list didn't load. Try again in a moment.";
}

function rowPrice(card: PricedCard): string {
  const board = priceBoard(card.quotes, card.releaseDate);
  if (board.askEdition) return "Pick edition";
  const face = board.faces.find((item) => item.variantKey === board.defaultKey) ?? board.faces[0];
  return formatAud(face?.headline?.amountAud ?? null);
}

export function HomeScreen({ initialQuery }: { initialQuery: string }) {
  const items = useCollection();
  const recent = useRecent();
  const ready = useIsClient();
  const value = totalValue(items);
  const copies = items.reduce((sum, item) => sum + item.quantity, 0);
  const newest = items
    .map((item) => item.priceDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

  const [query, setQuery] = useState(initialQuery);
  const [cards, setCards] = useState<PricedCard[]>([]);
  const [selected, setSelected] = useState<PricedCard | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    initialQuery.trim() ? "loading" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const requestGen = useRef(0);

  async function applySearch(trimmed: string, generation: number) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
    const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
    if (generation !== requestGen.current) return;
    if (!response.ok) throw new Error(payload.error || "The card list didn't load.");
    const found = payload.cards ?? [];
    setCards(found);
    setStatus("done");
    if (found.length === 0) setMessage("Nothing came up for that. Check the spelling.");
  }

  async function runSearch(valueText: string) {
    const generation = ++requestGen.current;
    const trimmed = valueText.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Type a card name or a number like 25/165.");
      setCards([]);
      return;
    }
    setStatus("loading");
    setMessage(null);
    setSelected(null);
    try {
      await applySearch(trimmed, generation);
    } catch (error) {
      if (generation !== requestGen.current) return;
      setStatus("error");
      setCards([]);
      setMessage(searchErrorMessage(error));
    }
  }

  useEffect(() => {
    const trimmed = initialQuery.trim();
    if (!trimmed) return;
    const generation = ++requestGen.current;
    void (async () => {
      try {
        await applySearch(trimmed, generation);
      } catch (error) {
        if (generation !== requestGen.current) return;
        setStatus("error");
        setCards([]);
        setMessage(searchErrorMessage(error));
      }
    })();
    return () => {
      requestGen.current += 1;
    };
  }, [initialQuery]);

  async function openRecent(scan: RecentScan) {
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/cards?ids=${encodeURIComponent(scan.cardId)}`);
      const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "The card list didn't load.");
      const card = payload.cards?.[0];
      if (!card) {
        setStatus("error");
        setMessage("That card isn't in the list anymore.");
        return;
      }
      setSelected(card);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(searchErrorMessage(error));
    }
  }

  if (selected) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Card" />
        <CardMatch
          candidates={[{ card: selected, score: 100 }]}
          againLabel="Back"
          onAgain={() => setSelected(null)}
        />
      </div>
    );
  }

  const empty = ready && items.length === 0;
  const hero = !ready ? "…" : empty ? "" : value.pricedCopies === 0 ? "No prices yet" : formatAud(value.aud);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div>
        <p className="text-sm font-bold text-muted-foreground">
          My cards{ready && copies > 0 ? ` · ${copies} ${copies === 1 ? "card" : "cards"}` : ""}
        </p>
        {empty ? (
          <p className="text-lg font-bold" data-testid="home-total">
            Scan your first card
          </p>
        ) : (
          <p className="text-5xl font-extrabold tracking-tight" data-testid="home-total">
            {hero}
          </p>
        )}
        {newest ? <p className="text-sm text-muted-foreground">Prices from {formatSourceDate(newest)}</p> : null}
        {ready && items.length > 0 ? (
          <Link href="/collection" className="mt-1 inline-flex text-base font-extrabold text-sea">
            All cards
          </Link>
        ) : null}
      </div>

      <Link href="/scan" className={cn(buttonVariants({ size: "xl" }), "w-full")} data-testid="home-scan">
        Scan a card
      </Link>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <label className="sr-only" htmlFor="card-query">
          Search by name or number
        </label>
        <Input
          id="card-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or number"
          autoCapitalize="words"
          enterKeyHint="search"
          className="h-14 rounded-full px-4 text-lg"
          data-testid="home-search"
        />
      </form>

      <div className="flex flex-col gap-3" aria-live="polite">
        {status === "loading" ? <p className="text-lg font-bold">Looking up cards…</p> : null}
        {message ? <p className="text-base">{message}</p> : null}
        {cards.map((card) => {
          const label = `${card.name}, ${card.setName}`;
          return (
            <button
              key={card.id}
              type="button"
              data-testid="search-result"
              onClick={() => setSelected(card)}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm ring-1 ring-border"
            >
              <CardImage src={card.imageSmall} alt={label} className="h-24 w-[68px] rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">{card.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {card.setName} · {collectorLabel(card.number, card.printedTotal)}
                </span>
              </span>
              <span className="text-base font-extrabold">{rowPrice(card)}</span>
            </button>
          );
        })}
      </div>

      {status !== "done" && recent.length > 0 ? (
        <section>
          <h2 className="text-lg font-extrabold">Recent</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {recent.map((scan) => (
              <li key={scan.cardId}>
                <button
                  type="button"
                  onClick={() => void openRecent(scan)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <CardImage
                    src={scan.image}
                    alt={`${scan.name}, ${scan.setName}`}
                    className="h-14 w-10 rounded-md"
                  />
                  <span className="min-w-0 flex-1 text-base">
                    {scan.name} · {scan.setName} {displayNumber(scan.number)}
                  </span>
                  <span className="font-extrabold">{formatAud(scan.amountAud)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto text-sm leading-relaxed text-muted-foreground">
        <p>Prices from TCGplayer and Cardmarket, in Australian dollars.</p>
        <details className="mt-1">
          <summary className="cursor-pointer font-extrabold text-sea">How this works</summary>
          <p className="mt-2">
            Point the camera at one Pokémon card, or search by name or set number. If a price is missing, the
            app says no price. My cards stays on this phone. Export a CSV from All cards if you want a copy.
          </p>
        </details>
      </div>
    </main>
  );
}
