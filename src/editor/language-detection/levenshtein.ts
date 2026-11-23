import { commonAffixLens } from "../../util";

export function levenshtein_distance(a: string, b: string): number {
  if (a === b) return 0;
  // the common start and end don't change the distance
  const { prefix: start, suffix } = commonAffixLens(a, b);
  let endA = a.length - suffix;
  let endB = b.length - suffix;
  if (endA - start > endB - start) {
    [a, b] = [b, a];
    [endA, endB] = [endB, endA];
  }

  const width = endA - start;
  if (width === 0) return endB - start;
  const row = new Uint32Array(width + 1);
  for (let col = 0; col <= width; col++) row[col] = col;

  for (let i = start; i < endB; i++) {
    let diagonal = row[0];
    row[0] = i - start + 1;
    const current = b.charCodeAt(i);
    for (let col = 1; col <= width; col++) {
      const previous = row[col];
      row[col] = Math.min(previous + 1, row[col - 1] + 1, diagonal + Number(a.charCodeAt(start + col - 1) !== current));
      diagonal = previous;
    }
  }
  return row[width];
}
