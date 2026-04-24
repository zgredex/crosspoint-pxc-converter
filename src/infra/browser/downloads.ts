export function triggerDownload(bytes: Uint8Array, filename: string, mime: string): void {
  const payload = new Uint8Array(bytes);
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
