export function getPastedImageFile(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }

  return null;
}

export function getPastedText(event: ClipboardEvent): string | null {
  const text = event.clipboardData?.getData('text/plain') ?? '';
  return text.trim() ? text : null;
}
