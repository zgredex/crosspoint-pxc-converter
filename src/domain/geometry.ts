export type FitAlign = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export function fitOffset(fw: number, fh: number, targetW: number, targetH: number, pos: FitAlign): { x: number; y: number } {
  const x = pos[1] === 'l' ? 0 : pos[1] === 'c' ? (targetW - fw) / 2 : targetW - fw;
  const y = pos[0] === 't' ? 0 : pos[0] === 'm' ? (targetH - fh) / 2 : targetH - fh;
  return { x, y };
}
