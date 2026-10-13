import sharp from "sharp";
import { CardPriceError } from "@/lib/errors";

export async function preprocessCard(input: Buffer): Promise<Buffer> {
  let oriented: Buffer;
  try {
    oriented = await sharp(input, { failOn: "none" }).rotate().toBuffer();
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
      cropWidth = Math.max(1, right - left);
      cropHeight = Math.max(1, bottom - top);
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
