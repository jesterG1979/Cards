import { CardPriceError } from "@/lib/errors";
import { identifyCard } from "@/lib/identify";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_BYTES + 64 * 1024;
const MAX_CONCURRENT = 2;

let activeScans = 0;

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ error: "That photo is too big. Try another one." }, { status: 400 });
  }
  if (activeScans >= MAX_CONCURRENT) {
    return Response.json({ error: "The scanner is busy. Try again in a moment." }, { status: 429 });
  }

  activeScans += 1;
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
  } finally {
    activeScans -= 1;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof CardPriceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Couldn't read that card." }, { status: 500 });
}
