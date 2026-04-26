export function parsePrinterTxt(text: string): { bytes: Uint8Array; paletteShades: number[] | null } {
  const lines = text.split('\n');
  const allBytes: number[] = [];
  let paletteShades: number[] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('{')) {
      try {
        const cmd = JSON.parse(line) as { command?: string; pallet?: number };
        if (cmd.command === 'PRNT' && cmd.pallet !== undefined) {
          const reg = cmd.pallet & 0xff;
          paletteShades = [
            (reg >> 0) & 3,
            (reg >> 2) & 3,
            (reg >> 4) & 3,
            (reg >> 6) & 3,
          ];
        }
      } catch {
        // Preserve permissive parsing because printer logs can mix binary dumps with malformed command lines.
      }
      continue;
    }

    for (const tok of line.split(/\s+/)) {
      if (/^[0-9A-Fa-f]{2}$/.test(tok)) allBytes.push(parseInt(tok, 16));
    }
  }

  return { bytes: new Uint8Array(allBytes), paletteShades };
}
