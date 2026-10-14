import sharp from "sharp";

export async function dhash(image: Buffer): Promise<string> {
  const { data, info } = await sharp(image, { failOn: "none", limitInputPixels: 40_000_000 })
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[y * info.width + x] ?? 0;
      const right = data[y * info.width + x + 1] ?? 0;
      bits += left > right ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

function popcount(value: number): number {
  let n = value;
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length || a.length === 0) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const left = parseInt(a[i] ?? "0", 16);
    const right = parseInt(b[i] ?? "0", 16);
    distance += popcount(left ^ right);
  }
  return distance;
}
