"use client";

import { useEffect, useState } from "react";
import { CardImage } from "@/components/card-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardMatch } from "@/components/card-match";
import { TopBar } from "@/components/top-bar";
import { collectorLabel } from "@/lib/format";
import type { PricedCard } from "@/lib/types";

export function SearchScreen({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [cards, setCards] = useState<PricedCard[]>([]);
  const [selected, setSelected] = useState<PricedCard | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    initialQuery.trim() ? "loading" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Type a card name first.");
      setCards([]);
      return;
    }
    setStatus("loading");
    setMessage(null);
    setSelected(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "The card list didn't load.");
      setCards(payload.cards ?? []);
      setStatus("done");
      if ((payload.cards ?? []).length === 0) {
        setMessage("Nothing came up for that. Check the spelling.");
      }
    } catch (error) {
      setStatus("error");
      setCards([]);
      const text = error instanceof Error ? error.message : "";
      setMessage(
        text === "Failed to fetch"
          ? "Couldn't reach the card list. Check your connection and try again."
          : text || "The card list didn't load. Try again in a moment.",
      );
    }
  }

  useEffect(() => {
    const trimmed = initialQuery.trim();
    if (!trimmed) return;
    let cancel = false;

    async function load() {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const payload = (await response.json()) as { cards?: PricedCard[]; error?: string };
        if (cancel) return;
        if (!response.ok) throw new Error(payload.error || "The card list didn't load.");
        const found = payload.cards ?? [];
        setCards(found);
        setStatus("done");
        if (found.length === 0) setMessage("Nothing came up for that. Check the spelling.");
      } catch (error) {
        if (cancel) return;
        setStatus("error");
        setCards([]);
        const text = error instanceof Error ? error.message : "";
        setMessage(
          text === "Failed to fetch"
            ? "Couldn't reach the card list. Check your connection and try again."
            : text || "The card list didn't load. Try again in a moment.",
        );
      }
    }

    void load();
    return () => {
      cancel = true;
    };
  }, [initialQuery]);

  if (selected) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Search" />
        <CardMatch
          candidates={[{ card: selected, score: 100 }]}
          againLabel="Back to results"
          onAgain={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Search" />
      <form
        className="flex flex-col gap-3 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <label className="text-lg font-extrabold" htmlFor="card-query">
          Card name
        </label>
        <Input
          id="card-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pikachu"
          autoCapitalize="words"
          className="h-14 rounded-2xl px-4 text-lg"
        />
        <Button type="submit" size="xl">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-3 px-5 pb-8" aria-live="polite">
        {status === "loading" ? <p className="text-lg font-bold">Looking up cards…</p> : null}
        {message ? <p className="text-base">{message}</p> : null}
        {status === "idle" ? <p className="text-base text-muted-foreground">Type a name, like Pikachu.</p> : null}
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelected(card)}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm ring-1 ring-border"
          >
            <CardImage src={card.imageSmall} alt="" className="h-24 w-[68px] rounded-lg object-cover" />
            <span>
              <span className="block text-lg font-extrabold">{card.name}</span>
              <span className="block text-sm text-muted-foreground">
                {card.setName} · {collectorLabel(card.number, card.printedTotal)} · {card.rarity}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
