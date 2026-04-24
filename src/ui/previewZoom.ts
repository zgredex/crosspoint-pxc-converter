type PreviewZoomDeps = {
  previewCanvas: HTMLCanvasElement;
  zoomBox: HTMLDivElement;
  zoomCanvas: HTMLCanvasElement;
  zoomBoxSize: number;
  zoomSourceSize: number;
  canShow: () => boolean;
  getTargetSize: () => { width: number; height: number };
};

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

export function setupPreviewZoom(deps: PreviewZoomDeps): void {
  deps.previewCanvas.addEventListener('mouseenter', () => {
    if (deps.canShow()) deps.zoomBox.style.display = 'block';
  });

  deps.previewCanvas.addEventListener('mouseleave', () => {
    deps.zoomBox.style.display = 'none';
  });

  deps.previewCanvas.addEventListener('mousemove', event => {
    if (!deps.canShow()) return;

    const { width, height } = deps.getTargetSize();
    const rect = deps.previewCanvas.getBoundingClientRect();
    const centerX = Math.round((event.clientX - rect.left) / rect.width * width);
    const centerY = Math.round((event.clientY - rect.top) / rect.height * height);

    const half = deps.zoomSourceSize / 2;
    const sourceX = Math.max(0, Math.min(width - deps.zoomSourceSize, centerX - half));
    const sourceY = Math.max(0, Math.min(height - deps.zoomSourceSize, centerY - half));

    const context = getContext2d(deps.zoomCanvas);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      deps.previewCanvas,
      sourceX,
      sourceY,
      deps.zoomSourceSize,
      deps.zoomSourceSize,
      0,
      0,
      deps.zoomBoxSize,
      deps.zoomBoxSize,
    );

    let boxX = event.clientX - deps.zoomBoxSize - 20;
    let boxY = event.clientY - deps.zoomBoxSize / 2;
    if (boxX < 8) boxX = event.clientX + 20;
    boxY = Math.max(8, Math.min(window.innerHeight - deps.zoomBoxSize - 8, boxY));

    deps.zoomBox.style.left = `${boxX}px`;
    deps.zoomBox.style.top = `${boxY}px`;
  });
}
