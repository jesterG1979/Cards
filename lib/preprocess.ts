import sharp from "sharp";
import { CardPriceError } from "@/lib/errors";

/** Largest decoded image we accept (a 12 MP phone photo is well under this). */
export const MAX_INPUT_PIXELS = 40_000_000;
const CARD_ASPECT = 63 / 88;

/**
 * Grow a detected bright box to a playing-card shape. A dark-bordered card only
 * lights up its art or text box, so the raw box would cut off the name at the top
 * and the collector number at the bottom.
 */
export function expandToCardAspect(
  box: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  let { width, height } = box;
  if (width / height > CARD_ASPECT) height = Math.round(width / CARD_ASPECT);
  else width = Math.round(height * CARD_ASPECT);
  width = Math.min(frame.width, width);
  height = Math.min(frame.height, height);
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const left = Math.min(frame.width - width, Math.max(0, Math.round(centerX - width / 2)));
  const top = Math.min(frame.height - height, Math.max(0, Math.round(centerY - height / 2)));
  return { left, top, width, height };
}

export async function preprocessCard(input: Buffer): Promise<Buffer> {
  const options = { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS } as const;
  let pixels = 0;
  try {
    // Header only; nothing is decoded yet.
    const header = await sharp(input, { failOn: "none", limitInputPixels: false }).metadata();
    pixels = (header.width ?? 0) * (header.height ?? 0);
  } catch {
    pixels = -1;
  }
  if (pixels > MAX_INPUT_PIXELS) {
    throw new CardPriceError("That photo is too big. Try another one.");
  }

  let oriented: Buffer;
  try {
    if (pixels < 0) throw new Error("unreadable");
    oriented = await sharp(input, options).rotate().toBuffer();
  } catch {
    throw new CardPriceError(
      "That photo is in a format I can't read. Take the picture in the app, or use a JPEG.",
    );
  }

  const meta = await sharp(oriented).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 40 || height < 40) {
    throw new CardPriceError("That picture is too small. Get closer to the card.");
  }

  const sampleWidth = Math.min(400, width);
  const { data, info } = await sharp(oriented)
    .resize({ width: sampleWidth })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[y * info.width + x] ?? 0) > 175) {
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  let left = 0;
  let top = 0;
  let cropWidth = width;
  let cropHeight = height;
  if (count > 0) {
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const fraction = (boxWidth * boxHeight) / (info.width * info.height);
    if (fraction >= 0.28 && fraction <= 0.92) {
      const scaleX = width / info.width;
      const scaleY = height / info.height;
      const padX = Math.round(boxWidth * 0.03);
      const padY = Math.round(boxHeight * 0.03);
      left = Math.max(0, Math.floor((minX - padX) * scaleX));
      top = Math.max(0, Math.floor((minY - padY) * scaleY));
      const right = Math.min(width, Math.ceil((maxX + 1 + padX) * scaleX));
      const bottom = Math.min(height, Math.ceil((maxY + 1 + padY) * scaleY));
      const card = expandToCardAspect(
        { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
        { width, height },
      );
      left = card.left;
      top = card.top;
      cropWidth = card.width;
      cropHeight = card.height;
    }
  }

  let pipeline = sharp(oriented).extract({ left, top, width: cropWidth, height: cropHeight });
  const longest = Math.max(cropWidth, cropHeight);
  if (longest < 700) {
    pipeline = pipeline.resize({
      width: cropWidth >= cropHeight ? 1200 : undefined,
      height: cropHeight > cropWidth ? 1200 : undefined,
      fit: "inside",
    });
  } else if (longest > 1400) {
    pipeline = pipeline.resize({
      width: cropWidth >= cropHeight ? 1400 : undefined,
      height: cropHeight > cropWidth ? 1400 : undefined,
      fit: "inside",
    });
  }

  return pipeline.png().toBuffer();
}

export async function bottomBand(image: Buffer): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const top = Math.min(height - 1, Math.floor(height * 0.68));
  return sharp(image)
    .extract({ left: 0, top, width, height: Math.max(1, height - top) })
    .resize({ width: Math.min(1600, width * 2) })
    .png()
    .toBuffer();
}
