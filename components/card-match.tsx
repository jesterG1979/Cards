"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardImage } from "@/components/card-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { readCollection, upsertItem, writeCollection } from "@/lib/collection";
import { collectorLabel, formatAud, formatOriginal, formatSourceDate } from "@/lib/format";
import { collectionQuote, priceBoard } from "@/lib/prices";
import { readRecent, rememberScan, writeRecent } from "@/lib/recent";
import type { CollectionItem, PricedCard, PriceQuote } from "@/lib/types";
import { cn } from "cn";

type Candidate = {
  card: PricedCard;
  score: number;
};

function sourceLine(quote: PriceQuote): string {
  const kind = quote.kind === "market" ? "market" : "average sell";
  const original =
    quote.amountOriginal != null && quote.amountAud != null
      ? ` · from ${formatOriginal(quote.amountOriginal, quote.currencyOriginal)}`
      : "";
  return `${quote.source} · ${kind} · ${formatSourceDate(quote.sourceDate)}${original}`;
}

export function CardMatch({
  candidates,
  names,
  numbers,
  againLabel,
  onAgain,
  onAdded,
}: {
  candidates: Candidate[];
  names?: string[];
  numbers?: { num: string; denom: string }[];
  againLabel: string;
  onAgain: () => void;
  onAdded?: (item: CollectionItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const [showOthers, setShowOthers] = useState(false);
  const selected = candidates[index]?.card;
  const selectedId = selected?.id ?? "";
  const board = useMemo(
    () => (selected ? priceBoard(selected.quotes, selected.releaseDate) : null),
    [selected],
  );
  const [trackedId, setTrackedId] = useState(selectedId);
  const [variantKey, setVariantKey] = useState<string | null>(board?.defaultKey ?? null);
  const [added, setAdded] = useState(false);
  const adding = useRef(false);

  if (selectedId !== trackedId) {
    setTrackedId(selectedId);
    setAdded(false);
    setVariantKey(board?.defaultKey ?? null);
    setShowOthers(false);
  }

  useEffect(() => {
    adding.current = false;
  }, [selectedId]);

  useEffect(() => {
    if (!selected || !board) return;
    const face = board.faces.find((item) => item.variantKey === variantKey) ?? null;
    writeRecent(
      rememberScan(readRecent(), {
        cardId: selected.id,
        name: selected.name,
        setName: selected.setName,
        number: collectorLabel(selected.number, selected.printedTotal),
        image: selected.imageSmall,
        amountAud: face?.headline?.amountAud ?? null,
        seenAt: new Date().toISOString(),
      }),
    );
  }, [selected, board, variantKey]);

  if (!selected || !board) {
    const sawNumber = numbers?.[0];
    const sawName = names?.[0];
    return (
      <div className="flex flex-col gap-4 px-5 py-6">
        <h2 className="text-3xl font-extrabold tracking-tight">No match for that photo.</h2>
        <p className="text-lg leading-snug">
          Fit the whole card in the picture, including the number at the bottom, then try again.
        </p>
        {sawNumber ? (
          <p className="text-base text-muted-foreground">
            The number looked like {sawNumber.num}/{sawNumber.denom}.
          </p>
        ) : null}
        {sawName ? <p className="text-base text-muted-foreground">The name looked like {sawName}.</p> : null}
        <Button type="button" size="xl" onClick={onAgain}>
          {againLabel}
        </Button>
        <Link
          href={sawName ? `/?q=${encodeURIComponent(sawName)}` : "/"}
          className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "w-full")}
        >
          Search by name
        </Link>
      </div>
    );
  }

  const unsure = (candidates[0]?.score ?? 0) < 70;
  const face = board.faces.find((item) => item.variantKey === variantKey) ?? null;
  const activeKey = face?.variantKey ?? null;
  const others = candidates.length - 1;
  const tags = [selected.rarity, ...selected.subtypes].filter(Boolean).join(" · ");
  const cardAlt = `${selected.name}, ${selected.setName}`;

  function addCard() {
    if (!face || !activeKey || adding.current) return;
    adding.current = true;
    const quote = collectionQuote(selected.quotes, activeKey);
    const saved: CollectionItem = {
      cardId: selected.id,
      name: selected.name,
      setName: selected.setName,
      number: collectorLabel(selected.number, selected.printedTotal),
      printedTotal: selected.printedTotal,
      rarity: selected.rarity,
      image: selected.imageSmall,
      variantKey: activeKey,
      variantLabel: face.variantLabel,
      quantity: 1,
      amountAud: quote?.amountAud ?? null,
      priceSource: quote?.source ?? null,
      priceDate: quote?.sourceDate ?? null,
      savedAt: new Date().toISOString(),
    };
    writeCollection(upsertItem(readCollection(), saved));
    if (onAdded) {
      onAdded(saved);
      return;
    }
    setAdded(true);
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <h2 className="text-3xl font-extrabold tracking-tight">
        {unsure ? "Check this is the right card." : "Is this the one?"}
      </h2>

      <div className="flex gap-3">
        <CardImage src={selected.imageSmall} alt={cardAlt} className="h-32 w-[92px] shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h3 className="text-2xl font-extrabold leading-tight" data-testid="card-name">
            {selected.name}
          </h3>
          <p className="text-base" data-testid="card-meta">
            {selected.setName} · {collectorLabel(selected.number, selected.printedTotal)}
          </p>
          <p className="text-sm text-muted-foreground">{tags}</p>
          {others > 0 ? (
            <button
              type="button"
              className="mt-2 text-sm font-extrabold text-sea"
              aria-expanded={showOthers}
              onClick={() => setShowOthers((open) => !open)}
            >
              {showOthers ? "Hide other cards" : `Not it? See ${others} ${others === 1 ? "other" : "others"}`}
            </button>
          ) : null}
        </div>
      </div>

      {showOthers ? (
        <ul className="flex flex-col gap-2">
          {candidates.map((candidate, candidateIndex) => {
            const label = `${candidate.card.name}, ${candidate.card.setName}`;
            return (
              <li key={candidate.card.id}>
                <button
                  type="button"
                  data-testid="candidate"
                  aria-label={label}
                  aria-pressed={candidateIndex === index}
                  onClick={() => {
                    setIndex(candidateIndex);
                    setShowOthers(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl bg-card p-2 text-left",
                    candidateIndex === index ? "ring-4 ring-ink" : "ring-1 ring-border",
                  )}
                >
                  <CardImage
                    src={candidate.card.imageSmall}
                    alt={label}
                    className="h-16 w-12 rounded-lg"
                  />
                  <span className="text-base font-extrabold">{candidate.card.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <p className="text-sm font-bold text-muted-foreground">Worth about</p>
        {face ? (
          <>
            <p className="text-5xl font-extrabold tracking-tight" data-testid="price-aud">
              {formatAud(face.headline?.amountAud ?? null)}
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              {face.headline
                ? `${sourceLine(face.headline)} · near-mint, ungraded`
                : "TCGplayer · no price · near-mint, ungraded"}
            </p>
            {face.headline?.amountOriginal != null && face.headline.amountAud == null ? (
              <p className="text-sm text-muted-foreground">
                {formatOriginal(face.headline.amountOriginal, face.headline.currencyOriginal)} couldn&apos;t
                be turned into Australian dollars
              </p>
            ) : null}
            {face.secondary ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="price-cardmarket">
                {face.secondary.variantKey === face.variantKey
                  ? sourceLine(face.secondary)
                  : `Cardmarket average · ${formatAud(face.secondary.amountAud)} · ${formatSourceDate(face.secondary.sourceDate)}`}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-3xl font-extrabold" data-testid="price-aud">
            Pick the edition
          </p>
        )}
        {board.editionNote ? <p className="mt-2 text-sm font-bold">{board.editionNote}</p> : null}
      </div>

      {board.faces.length > 1 ? (
        <div role="radiogroup" aria-label="Edition" className="flex flex-wrap gap-2">
          {board.faces.map((item) => {
            const pressed = item.variantKey === activeKey;
            return (
              <button
                key={item.variantKey}
                type="button"
                role="radio"
                aria-checked={pressed}
                data-testid="edition"
                onClick={() => setVariantKey(item.variantKey)}
                className={cn(
                  "min-h-12 flex-1 rounded-xl px-3 py-2 text-base font-extrabold",
                  pressed ? "bg-ink text-white" : "bg-card text-foreground ring-1 ring-border",
                )}
              >
                {item.variantLabel}
              </button>
            );
          })}
        </div>
      ) : null}

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
          <Button type="button" size="xl" onClick={addCard} data-testid="add-card" disabled={!face}>
            Add to My cards
          </Button>
          <Button type="button" size="xl" variant="secondary" onClick={onAgain}>
            {againLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
