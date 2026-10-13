import { CardPriceError } from "@/lib/errors";
import { getRates } from "@/lib/fx";
import { searchCards } from "@/lib/pokemon";
import { toPricedCard } from "@/lib/prices";
import { buildSearchQuery } from "@/lib/search-query";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const lucene = buildSearchQuery(query);
    const [cards, rates] = await Promise.all([searchCards(lucene, 20), getRates()]);
    return Response.json({ cards: cards.map((card) => toPricedCard(card, rates)) });
  } catch (error) {
    if (error instanceof CardPriceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "The card list didn't load. Try again in a moment." }, { status: 502 });
  }
}
