"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CardImage } from "@/components/card-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { readCollection, upsertItem, writeCollection } from "@/lib/collection";
import { collectorLabel, formatAud, formatOriginal, formatSourceDate } from "@/lib/format";
import { collectionQuote, groupQuotes, preferredVariant } from "@/lib/prices";
import type { PricedCard, PriceQuote } from "@/lib/types";
import { cn } from "cn";

type Candidate = {
  card: PricedCard;
  score: number;
};

function PriceLine({ quote }: { quote: PriceQuote }) {
  const kind = quote.kind === "market" ? "market price" : "average selling price";
  return (
    <div className="mt-2">
      <p className="text-3xl font-extrabold tracking-tight" data-testid="price-aud">
        {formatAud(quote.amountAud)}
      </p>
      <p className="text-sm leading-snug text-muted-foreground">
        {quote.source} · {kind} · {formatSourceDate(quote.sourceDate)}
      </p>
      {quote.amountOriginal != null && quote.amountAud != null ? (
        <p className="text-sm text-muted-foreground">From {formatOriginal(quote.amountOriginal, quote.currencyOriginal)}</p>
      ) : null}
      {quote.amountOriginal != null && quote.amountAud == null ? (
        <p className="text-sm text-muted-foreground">
          {formatOriginal(quote.amountOriginal, quote.currencyOriginal)} couldn&apos;t be turned into
          Australian dollars
        </p>
      ) : null}
    </div>
  );
}

export function CardMatch({
  candidates,
  names,
  numbers,
  againLabel,
  onAgain,
}: {
  candidates: Candidate[];
  names?: string[];
  numbers?: { num: string; denom: string }[];
  againLabel: string;
  onAgain: () => void;
}) {
  const [index, setIndex] = useState(0);
  const selected = candidates[index]?.card;
  const selectedId = selected?.id ?? "";
  const groups = useMemo(() => (selected ? groupQuotes(selected.quotes) : []), [selected]);
  const [trackedId, setTrackedId] = useState(selectedId);
  const [variantKey, setVariantKey] = useState(selected ? preferredVariant(selected.quotes) : "normal");
  const [added, setAdded] = useState(false);

  if (selectedId !== trackedId) {
    setTrackedId(selectedId);
    setAdded(false);
    setVariantKey(selected ? preferredVariant(selected.quotes) : "normal");
  }

  if (!selected) {
    const sawNumber = numbers?.[0];
    const sawName = names?.[0];
    return (
      <div className="flex flex-col gap-4 px-5 py-6">
        <h2 className="text-3xl font-extrabold tracking-tight">I couldn&apos;t match that photo.</h2>
        <p className="text-lg leading-snug">
          Fit the whole card in the picture, including the number at the bottom, then try again.
        </p>
        {sawNumber ? (
          <p className="text-base text-muted-foreground">
            I saw a number like {sawNumber.num}/{sawNumber.denom}.
          </p>
        ) : null}
        {sawName ? <p className="text-base text-muted-foreground">I saw the word {sawName}.</p> : null}
        <Button type="button" size="xl" onClick={onAgain}>
          {againLabel}
        </Button>
        <Link
          href={sawName ? `/search?q=${encodeURIComponent(sawName)}` : "/search"}
          className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "w-full")}
        >
          Search by name
        </Link>
      </div>
    );
  }

  const unsure = (candidates[0]?.score ?? 0) < 70;
  const group = groups.find((item) => item.variantKey === variantKey) ?? groups[0];
  const activeKey = group?.variantKey ?? variantKey;

  function addCard() {
    if (!selected || !group) return;
    const quote = collectionQuote(selected.quotes, activeKey);
    const next = upsertItem(readCollection(), {
      cardId: selected.id,
      name: selected.name,
      setName: selected.setName,
      number: collectorLabel(selected.number, selected.printedTotal),
      rarity: selected.rarity,
      image: selected.imageSmall,
      variantKey: activeKey,
      variantLabel: group.variantLabel,
      quantity: 1,
      amountAud: quote?.amountAud ?? null,
      priceSource: quote?.source ?? null,
      priceDate: quote?.sourceDate ?? null,
      savedAt: new Date().toISOString(),
    });
    writeCollection(next);
    setAdded(true);
  }

  const image = selected.imageLarge ?? selected.imageSmall;
  const tags = [selected.rarity, ...selected.subtypes].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <h2 className="text-3xl font-extrabold tracking-tight">
        {unsure ? "I'm not sure. Pick the right card." : "Is this the one?"}
      </h2>

      {candidates.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {candidates.map((candidate, candidateIndex) => (
            <button
              key={candidate.card.id}
              type="button"
              data-testid="candidate"
              onClick={() => setIndex(candidateIndex)}
              className={cn(
                "w-24 shrink-0 rounded-2xl border-4 bg-card p-1 text-left",
                candidateIndex === index ? "border-ink" : "border-transparent",
              )}
            >
              <CardImage
                src={candidate.card.imageSmall}
                alt=""
                className="aspect-[63/88] h-auto w-full rounded-xl object-cover"
              />
              <span className="mt-1 block text-xs font-extrabold leading-tight">{candidate.card.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <CardImage
        src={image}
        alt={selected.name}
        className="mx-auto h-auto w-full max-w-[280px] rounded-2xl bg-card shadow-lg"
      />

      <div>
        <h3 className="text-2xl font-extrabold" data-testid="card-name">
          {selected.name}
        </h3>
        <p className="text-base" data-testid="card-meta">
          {selected.setName} · {collectorLabel(selected.number, selected.printedTotal)}
        </p>
        <p className="text-sm text-muted-foreground">{tags}</p>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((item) => {
          const pressed = item.variantKey === activeKey;
          return (
            <button
              key={item.variantKey}
              type="button"
              aria-pressed={pressed}
              onClick={() => setVariantKey(item.variantKey)}
              className={cn(
                "rounded-2xl bg-card p-4 text-left shadow-sm",
                pressed ? "ring-4 ring-ink" : "ring-1 ring-border",
              )}
            >
              <p className="text-lg font-extrabold">{item.variantLabel}</p>
              {item.quotes.map((quote) => (
                <PriceLine key={`${quote.source}-${quote.kind}`} quote={quote} />
              ))}
            </button>
          );
        })}
      </div>

      {added ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg font-extrabold" data-testid="added">
            Added. It&apos;s in My cards.
          </p>
          <Link href="/collection" className={cn(buttonVariants({ size: "xl" }), "w-full")}>
            My cards
          </Link>
          <Button type="button" size="xl" variant="secondary" onClick={onAgain}>
            {againLabel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button type="button" size="xl" onClick={addCard} data-testid="add-card">
            Add {group?.variantLabel ?? "this card"} to my cards
          </Button>
          <Button type="button" size="xl" variant="secondary" onClick={onAgain}>
            {againLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
