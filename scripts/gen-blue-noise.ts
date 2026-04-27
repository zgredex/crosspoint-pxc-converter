import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 64;
const N = SIZE * SIZE;

const SIGMA = 1.5;
const KERNEL_RADIUS = 7;
const KERNEL_DIAM = KERNEL_RADIUS * 2 + 1;

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kernel = new Float64Array(KERNEL_DIAM * KERNEL_DIAM);
for (let dy = -KERNEL_RADIUS; dy <= KERNEL_RADIUS; dy++) {
  for (let dx = -KERNEL_RADIUS; dx <= KERNEL_RADIUS; dx++) {
    const r2 = dx * dx + dy * dy;
    kernel[(dy + KERNEL_RADIUS) * KERNEL_DIAM + (dx + KERNEL_RADIUS)] =
      Math.exp(-r2 / (2 * SIGMA * SIGMA));
  }
}

function computeScores(pattern: boolean[]): Float64Array {
  const score = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (!pattern[i]) continue;
    updateScore(score, i, 1);
  }
  return score;
}

function updateScore(score: Float64Array, p: number, delta: number): void {
  const px = p & (SIZE - 1);
  const py = p >> 6;
  for (let dy = -KERNEL_RADIUS; dy <= KERNEL_RADIUS; dy++) {
    const ny = (py + dy + SIZE) & (SIZE - 1);
    for (let dx = -KERNEL_RADIUS; dx <= KERNEL_RADIUS; dx++) {
      const nx = (px + dx + SIZE) & (SIZE - 1);
      score[(ny << 6) | nx] +=
        delta * kernel[(dy + KERNEL_RADIUS) * KERNEL_DIAM + (dx + KERNEL_RADIUS)];
    }
  }
}

function findTightestCluster(pattern: boolean[], score: Float64Array): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < N; i++) {
    if (!pattern[i]) continue;
    if (score[i] > bestScore) {
      bestScore = score[i];
      best = i;
    }
  }
  return best;
}

function findLargestVoid(pattern: boolean[], score: Float64Array): number {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < N; i++) {
    if (pattern[i]) continue;
    if (score[i] < bestScore) {
      bestScore = score[i];
      best = i;
    }
  }
  return best;
}

function generateBlueNoise(): Uint8Array {
  const rng = mulberry32(42);
  const mask = new Array<boolean>(N).fill(false);

  const initialCount = Math.round(N * 0.1);
  let placed = 0;
  while (placed < initialCount) {
    const i = (rng() * N) | 0;
    if (!mask[i]) {
      mask[i] = true;
      placed++;
    }
  }

  // Phase 0: stabilize the initial binary pattern via swap.
  // Move tightest cluster to largest void until a swap would reverse itself.
  const score0 = computeScores(mask);
  for (let iter = 0; iter < N * 4; iter++) {
    const cluster = findTightestCluster(mask, score0);
    if (cluster < 0) break;
    mask[cluster] = false;
    updateScore(score0, cluster, -1);
    const voidPixel = findLargestVoid(mask, score0);
    if (voidPixel < 0 || voidPixel === cluster) {
      mask[cluster] = true;
      updateScore(score0, cluster, 1);
      break;
    }
    mask[voidPixel] = true;
    updateScore(score0, voidPixel, 1);
  }

  const ranks = new Int32Array(N);

  // Phase 1: assign ranks 0..K-1 by removing tightest clusters from BIP.
  // Tightest cluster removed first → rank K-1; most isolated removed last → rank 0.
  const working1 = mask.slice();
  const score1 = computeScores(working1);
  for (let i = 0; i < initialCount; i++) {
    const p = findTightestCluster(working1, score1);
    if (p < 0) break;
    ranks[p] = initialCount - 1 - i;
    working1[p] = false;
    updateScore(score1, p, -1);
  }

  // Phase 2: assign ranks K..N-1 by filling largest voids in BIP.
  const working2 = mask.slice();
  const score2 = computeScores(working2);
  for (let i = 0; i < N - initialCount; i++) {
    const p = findLargestVoid(working2, score2);
    if (p < 0) break;
    ranks[p] = initialCount + i;
    working2[p] = true;
    updateScore(score2, p, 1);
  }

  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = Math.floor((ranks[i] * 256) / N);
  }
  return out;
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
