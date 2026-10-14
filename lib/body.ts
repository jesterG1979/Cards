import { CardPriceError } from "@/lib/errors";

const TOO_BIG = "That photo is too big. Try another one.";

/**
 * Read a request body but stop as soon as it passes `maxBytes`, whether or not
 * the client sent a Content-Length. `request.formData()` alone would buffer a
 * chunked upload of any size before we could check it.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new CardPriceError(TOO_BIG, 413);
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CardPriceError(TOO_BIG, 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/** Parse multipart form data from a body that has already been size-checked. */
export async function parseLimitedForm(request: Request, maxBytes: number): Promise<FormData> {
  const body = await readLimitedBody(request, maxBytes);
  const type = request.headers.get("content-type") ?? "";
  try {
    return await new Response(new Uint8Array(body), { headers: { "content-type": type } }).formData();
  } catch {
    throw new CardPriceError("Choose a photo of one card.");
  }
}
