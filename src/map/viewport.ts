export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1200;

export function clampPointToSheet(point: [number, number]): [number, number] {
  return [Math.max(0, Math.min(MAP_WIDTH, point[0])), Math.max(0, Math.min(MAP_HEIGHT, point[1]))];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export function defaultViewport(): Viewport {
  return { x: 0, y: 0, zoom: 1 };
}

export function viewSize(vp: Viewport): { width: number; height: number } {
  return { width: MAP_WIDTH / vp.zoom, height: MAP_HEIGHT / vp.zoom };
}

export function viewBox(vp: Viewport): string {
  const size = viewSize(vp);
  return `${vp.x} ${vp.y} ${size.width} ${size.height}`;
}

export function clampViewport(vp: Viewport): Viewport {
  const zoom = Math.min(8, Math.max(0.4, vp.zoom));
  const size = { width: MAP_WIDTH / zoom, height: MAP_HEIGHT / zoom };
  const x = Math.min(Math.max(vp.x, -size.width * 0.25), MAP_WIDTH - size.width * 0.75);
  const y = Math.min(Math.max(vp.y, -size.height * 0.25), MAP_HEIGHT - size.height * 0.75);
  return { x, y, zoom };
}

export function panViewport(vp: Viewport, dx: number, dy: number): Viewport {
  return clampViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
}

/** Zoom keeping `anchor` (map coords) under the same screen point. */
export function zoomViewport(vp: Viewport, factor: number, anchor: [number, number]): Viewport {
  const nextZoom = Math.min(8, Math.max(0.4, vp.zoom * factor));
  if (nextZoom === vp.zoom) return vp;
  const size = viewSize(vp);
  const rx = (anchor[0] - vp.x) / size.width;
  const ry = (anchor[1] - vp.y) / size.height;
  const nextSize = { width: MAP_WIDTH / nextZoom, height: MAP_HEIGHT / nextZoom };
  return clampViewport({
    zoom: nextZoom,
    x: anchor[0] - rx * nextSize.width,
    y: anchor[1] - ry * nextSize.height,
  });
}

/** Screen pixels per map unit for `preserveAspectRatio="xMidYMid meet"`. */
export function contentScale(rect: { width: number; height: number }, vp: Viewport): number {
  const size = viewSize(vp);
  return Math.min(rect.width / size.width, rect.height / size.height);
}

/**
 * Client → map, matching SVG `xMidYMid meet` (letterboxed if the canvas is not 4:3).
 * Stretching the viewBox to the element box misses symbols and breaks the inspector.
 */
export function clientToMap(
  client: { clientX: number; clientY: number },
  rect: DOMRect,
  vp: Viewport,
): [number, number] {
  const scale = contentScale(rect, vp);
  const size = viewSize(vp);
  const ox = rect.left + (rect.width - size.width * scale) / 2;
  const oy = rect.top + (rect.height - size.height * scale) / 2;
  return [vp.x + (client.clientX - ox) / scale, vp.y + (client.clientY - oy) / scale];
}

/** Inverse of the SVG screen CTM when the element is mounted (borders, meet, zoom). */
export function clientToMapFromSvg(
  svg: SVGSVGElement,
  client: { clientX: number; clientY: number },
  vp: Viewport,
): [number, number] {
  const ctm = svg.getScreenCTM();
  if (ctm) {
    const mapped = new DOMPoint(client.clientX, client.clientY).matrixTransform(ctm.inverse());
    return [mapped.x, mapped.y];
  }
  return clientToMap(client, svg.getBoundingClientRect(), vp);
}

export function viewportCenter(vp: Viewport): [number, number] {
  const size = viewSize(vp);
  return [vp.x + size.width / 2, vp.y + size.height / 2];
}

/** Convert a screen-pixel length to map units at the current camera. */
export function screenToMapDistance(screenPx: number, rect: { width: number; height: number }, vp: Viewport): number {
  return screenPx / Math.max(contentScale(rect, vp), 1e-6);
}

export function fitViewport(): Viewport {
  return defaultViewport();
}
