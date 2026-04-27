import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 64;

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = SIZE * SIZE;

function idx(x: number, y: number): number {
  return ((y % SIZE) + SIZE) % SIZE * SIZE + ((x % SIZE) + SIZE) % SIZE;
}

function neighbors8(x: number, y: number): [number, number][] {
  return [
    [x - 1, y - 1], [x, y - 1], [x + 1, y - 1],
    [x - 1, y],                 [x + 1, y],
    [x - 1, y + 1], [x, y + 1], [x + 1, y + 1],
  ];
}

function findLargestVoid(mask: boolean[]): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < N; i++) {
    if (mask[i]) continue;
    const x = i % SIZE;
    const y = (i / SIZE) | 0;
    let score = 0;
    for (const [nx, ny] of neighbors8(x, y)) {
      if (mask[idx(nx, ny)]) score++;
    }
    if (score > bestScore || (score === bestScore && i < best)) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function findTightestCluster(mask: boolean[]): number {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const x = i % SIZE;
    const y = (i / SIZE) | 0;
    let score = 0;
    for (const [nx, ny] of neighbors8(x, y)) {
      if (mask[idx(nx, ny)]) score++;
    }
    if (score < bestScore || (score === bestScore && i < best)) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function generateBlueNoise(): Uint8Array {
  const rng = mulberry32(42);
  const mask = new Array<boolean>(N).fill(false);

  const initialCount = Math.round(N * 0.1);
  while (mask.filter(Boolean).length < initialCount) {
    const i = (rng() * N) | 0;
    mask[i] = true;
  }

  for (let iter = 0; iter < N * 2; iter++) {
    const voidPixel = findLargestVoid(mask);
    const clusterPixel = findTightestCluster(mask);
    if (voidPixel < 0 || clusterPixel < 0) break;
    mask[clusterPixel] = false;
    mask[voidPixel] = true;
  }

  const ranks = new Uint8Array(N);

  const removalOrder: number[] = [];
  const remaining = new Array<boolean>(N);
  for (let i = 0; i < N; i++) remaining[i] = mask[i];

  while (true) {
    const pixel = findTightestCluster(remaining);
    if (pixel < 0) break;
    remaining[pixel] = false;
    removalOrder.push(pixel);
  }

  for (let rank = 0; rank < removalOrder.length; rank++) {
    ranks[removalOrder[rank]] = rank;
  }

  const unranked: number[] = [];
  for (let i = 0; i < N; i++) {
    if (ranks[i] === 0 && !mask[i]) unranked.push(i);
  }

  let currentRank = removalOrder.length;
  for (const i of unranked) {
    ranks[i] = currentRank;
    currentRank++;
  }

  return ranks;
}

const matrix = generateBlueNoise();

const values: string[] = [];
for (let i = 0; i < N; i++) {
  values.push(String(matrix[i]));
}

const lines: string[] = [];
for (let i = 0; i < values.length; i += 16) {
  lines.push(`  ${values.slice(i, i + 16).join(', ')}`);
}

const output = `export const BLUE_NOISE_64: Uint8Array = new Uint8Array([\n${lines.join(',\n')},\n]);\n`;

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'domain', 'blueNoise.ts');
writeFileSync(outPath, output, 'utf-8');
console.log(`Wrote ${outPath} (${N} bytes)`);
