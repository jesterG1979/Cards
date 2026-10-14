import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

const { identifyCard } = vi.hoisted(() => ({ identifyCard: vi.fn() }));
vi.mock("@/lib/identify", () => ({ identifyCard: (...args: unknown[]) => identifyCard(...args) }));

import { POST } from "@/app/api/identify/route";
import { readLimitedBody } from "@/lib/body";
import { expandToCardAspect, MAX_INPUT_PIXELS, preprocessCard } from "@/lib/preprocess";

function chunkedRequest(totalBytes: number, chunk = 64 * 1024): { request: Request; sent: () => number } {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunk, totalBytes - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
  const request = new Request("http://local/api/identify", {
    method: "POST",
    body,
    headers: { "content-type": "multipart/form-data; boundary=x" },
    // @ts-expect-error Node needs duplex for a streamed body.
    duplex: "half",
  });
  return { request, sent: () => sent };
}

describe("upload size (F-01)", () => {
  it("stops reading a body with no Content-Length once it passes the limit", async () => {
    const { request, sent } = chunkedRequest(64 * 1024 * 1024);
    expect(request.headers.get("content-length")).toBeNull();
    await expect(readLimitedBody(request, 1024 * 1024)).rejects.toMatchObject({ status: 413 });
    expect(sent()).toBeLessThan(4 * 1024 * 1024);
  });

  it("rejects a chunked oversized upload at the route without calling the scanner", async () => {
    const { request } = chunkedRequest(20 * 1024 * 1024);
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(identifyCard).not.toHaveBeenCalled();
  });

  it("still accepts a normal photo upload", async () => {
    identifyCard.mockResolvedValue({ names: [], numbers: [], candidates: [], ocrText: "" });
    const form = new FormData();
    form.set("image", new File([new Uint8Array(1000)], "card.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://local/api/identify", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    expect(identifyCard).toHaveBeenCalledOnce();
  });

  it("refuses a tiny file that decodes to a huge image before decoding it", async () => {
    const side = Math.ceil(Math.sqrt(MAX_INPUT_PIXELS)) + 500;
    const bomb = await sharp({ create: { width: side, height: side, channels: 3, background: "#fff" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(1024 * 1024);
    await expect(preprocessCard(bomb)).rejects.toThrow("too big");
  });
});

describe("auto-crop keeps the whole card (F-10)", () => {
  it("grows a bright art box on a dark card to the card's shape", () => {
    // Bright art in the middle of a dark card: wider than a card, so height must grow.
    const crop = expandToCardAspect({ left: 100, top: 300, width: 600, height: 400 }, { width: 800, height: 1200 });
    expect(crop.width / crop.height).toBeCloseTo(63 / 88, 1);
    expect(crop.top).toBeLessThan(300);
    expect(crop.top + crop.height).toBeGreaterThan(700);
  });

  it("finds the full card when only the art is bright", async () => {
    // 630x880 dark card with a bright art window, on a slightly lighter grey table.
    const card = await sharp({ create: { width: 630, height: 880, channels: 3, background: "#202020" } })
      .composite([
        {
          input: await sharp({ create: { width: 580, height: 500, channels: 3, background: "#f0f0f0" } }).png().toBuffer(),
          left: 25,
          top: 100,
        },
      ])
      .png()
      .toBuffer();
    const photo = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#505050" } })
      .composite([{ input: card, left: 85, top: 60 }])
      .jpeg()
      .toBuffer();
    const out = await sharp(await preprocessCard(photo)).metadata();
    // Before the fix this was the art box (580x500, wider than tall), which cuts off name and number.
    expect((out.width ?? 0) / (out.height ?? 1)).toBeCloseTo(63 / 88, 1);
  });
});
