import { connection } from "next/server";
import { CardPriceError } from "@/lib/errors";
import { getRates } from "@/lib/fx";
import { fetchCardsByIds } from "@/lib/pokemon";
import { toPricedCard } from "@/lib/prices";

const MAX_IDS = 100;
const CARD_ID_RE = /^[a-z0-9][a-z0-9_!?-]{0,31}$/i;

export async function GET(request: Request) {
  // Per-request data: tell Next not to try prerendering this handler at build time.
  await connection();
  try {
    const raw = new URL(request.url).searchParams.get("ids") ?? "";
    const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
    if (ids.length > MAX_IDS) {
      throw new CardPriceError("That card list is too long to refresh at once.");
    }
    if (ids.length === 0) throw new CardPriceError("No cards to look up.");
    // Real ids include cel25c-15_A1, ex10-! and ex10-?.
    if (ids.some((id) => !CARD_ID_RE.test(id))) {
      throw new CardPriceError("That card list doesn't look right.");
    }
    const [cards, rates] = await Promise.all([fetchCardsByIds(ids), getRates()]);
    return Response.json({ cards: cards.map((card) => toPricedCard(card, rates)) });
  } catch (error) {
    if (error instanceof CardPriceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "The card list didn't load. Try again in a moment." }, { status: 502 });
  }
}
