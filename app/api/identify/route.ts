import { CardPriceError } from "@/lib/errors";
import { identifyCard } from "@/lib/identify";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      throw new CardPriceError("Choose a photo of one card.");
    }
    if (file.size <= 0) throw new CardPriceError("That photo was empty.");
    if (file.size > MAX_BYTES) throw new CardPriceError("That photo is too big. Try another one.");
    const image = Buffer.from(await file.arrayBuffer());
    const result = await identifyCard(image);
    return Response.json({
      names: result.names,
      numbers: result.numbers,
      candidates: result.candidates.map((candidate) => ({
        card: candidate.card,
        score: candidate.score,
        hashDistance: candidate.hashDistance,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof CardPriceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Couldn't read that card." }, { status: 500 });
}
