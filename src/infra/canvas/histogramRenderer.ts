import { buildBinnedHistogram, computeHistogramZones } from '../../domain/histogram';

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

export function resizeHistogramCanvas(canvas: HTMLCanvasElement): void {
  const width = canvas.offsetWidth;
  if (!width) return;

  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(80 * dpr);
  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  canvas.width = nextWidth;
  canvas.height = nextHeight;
}

export function renderHistogram(
  canvas: HTMLCanvasElement,
  histogram: Float32Array | null,
  totalPixels: number,
): void {
  if (!histogram) return;

  resizeHistogramCanvas(canvas);
  if (!canvas.width) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const labelH = Math.round(16 * dpr);
  const pctH = Math.round(18 * dpr);
  const stripH = Math.round(4 * dpr);
  const barH = ch - labelH - pctH - stripH;

  const context = getContext2d(canvas);
  context.clearRect(0, 0, cw, ch);

  const zones = computeHistogramZones(histogram, totalPixels);
  for (const zone of zones) {
    const x1 = (zone.xLo / 255) * cw;
    const x2 = (zone.xHi / 255) * cw;
    context.fillStyle = zone.fill;
    context.fillRect(x1, 0, x2 - x1, barH + stripH + pctH);
  }

  const binWidth = 8;
  const { binned, binnedMax } = buildBinnedHistogram(histogram, binWidth);
  if (binnedMax > 0) {
    const barWidth = cw / binned.length;
    for (let b = 0; b < binned.length; b++) {
      if (!binned[b]) continue;
      const currentBarH = (binned[b] / binnedMax) * barH;
      const gray = Math.round(50 + (b * binWidth + binWidth / 2) / 255 * 160);
      context.fillStyle = `rgb(${gray},${gray},${gray})`;
      context.fillRect(b * barWidth, barH - currentBarH, Math.max(1, barWidth - 0.5), currentBarH);
    }
  }

  for (const zone of zones) {
    const x1 = (zone.xLo / 255) * cw;
    const x2 = (zone.xHi / 255) * cw;
    context.fillStyle = zone.palette;
    context.fillRect(x1, barH, x2 - x1, stripH);
  }

  context.strokeStyle = 'rgba(232,232,234,0.25)';
  context.lineWidth = 1;
  for (const threshold of [42, 127, 212]) {
    const x = (threshold / 255) * cw;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, barH + stripH + pctH);
    context.stroke();
  }

  context.font = `${Math.round(9 * dpr)}px monospace`;
  context.textBaseline = 'top';
  context.textAlign = 'left';
  context.fillStyle = 'rgba(185,185,195,0.9)';
  context.fillText(`peak bin ${Math.round(100 * binnedMax / totalPixels)} %`, 4, 4);

  context.font = `${Math.round(9 * dpr)}px monospace`;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  const pctY = barH + stripH + pctH / 2;
  for (const zone of zones) {
    const x1 = (zone.xLo / 255) * cw;
    const x2 = (zone.xHi / 255) * cw;
    context.fillStyle = zone.pctColor;
    context.fillText(`${zone.pct}%`, (x1 + x2) / 2, pctY);
  }

  context.fillStyle = 'rgba(90,90,104,0.9)';
  context.font = `${Math.round(9 * dpr)}px monospace`;
  context.textBaseline = 'bottom';
  context.textAlign = 'center';
  for (const threshold of [42, 127, 212]) {
    context.fillText(String(threshold), (threshold / 255) * cw, ch - 1);
  }
}
