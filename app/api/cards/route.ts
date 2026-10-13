import { CardPriceError } from "@/lib/errors";
import { getRates } from "@/lib/fx";
import { fetchCardsByIds } from "@/lib/pokemon";
import { toPricedCard } from "@/lib/prices";

const MAX_IDS = 100;

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("ids") ?? "";
    const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
    if (ids.length > MAX_IDS) {
      throw new CardPriceError("That card list is too long to refresh at once.");
    }
    if (ids.length === 0) throw new CardPriceError("No cards to look up.");
    if (ids.some((id) => !/^[a-z0-9-]+$/i.test(id))) {
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
