const MOTION = 8;
const HOLD = 2.5;

export function frameSteady(diffs: number[]): boolean {
  if (diffs.length < 4) return false;
  const recent = diffs.slice(-4);
  const moved = (recent[0] ?? 0) >= MOTION;
  const held = recent.slice(1).every((value) => value < HOLD);
  return moved && held;
}

export function meanAbsDiff(previous: Uint8ClampedArray, next: Uint8ClampedArray): number {
  const samples = Math.floor(Math.min(previous.length, next.length) / 4);
  if (samples === 0) return 0;
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    total += Math.abs((previous[index * 4] ?? 0) - (next[index * 4] ?? 0));
  }
  return total / samples;
}
