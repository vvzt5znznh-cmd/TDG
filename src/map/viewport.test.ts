import { describe, expect, it } from "vitest";
import { clientToMap, defaultViewport, panViewport, screenToMapDistance, viewBox, viewportCenter, zoomViewport } from "./viewport";

describe("viewport", () => {
  it("writes a viewBox from camera", () => {
    expect(viewBox(defaultViewport())).toBe("0 0 1600 1200");
    expect(viewBox({ x: 100, y: 50, zoom: 2 })).toBe("100 50 800 600");
  });

  it("zooms around an anchor point", () => {
    const vp = zoomViewport(defaultViewport(), 2, [800, 600]);
    expect(vp.zoom).toBe(2);
    expect(vp.x + 800 / 2).toBeCloseTo(800);
    expect(vp.y + 600 / 2).toBeCloseTo(600);
  });

  it("converts client coordinates through the camera", () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
    const [x, y] = clientToMap({ clientX: 400, clientY: 300 }, rect, defaultViewport());
    expect(x).toBeCloseTo(800);
    expect(y).toBeCloseTo(600);
  });

  it("letterboxes a non-4:3 canvas so a click on a unit maps to the unit", () => {
    const scale = Math.min(900 / 1600, 840 / 1200);
    const ox = (900 - 1600 * scale) / 2;
    const oy = (840 - 1200 * scale) / 2;
    const rect = { left: 0, top: 0, width: 900, height: 840 } as DOMRect;
    const [x, y] = clientToMap({ clientX: ox + 390 * scale, clientY: oy + 300 * scale }, rect, defaultViewport());
    expect(x).toBeCloseTo(390);
    expect(y).toBeCloseTo(300);
  });

  it("scales hit slop with zoom so handles stay clickable", () => {
    const frame = { width: 800, height: 600 };
    expect(screenToMapDistance(8, frame, defaultViewport())).toBeCloseTo(16);
    const zoomed = zoomViewport(defaultViewport(), 2, [800, 600]);
    expect(screenToMapDistance(8, frame, zoomed)).toBeCloseTo(8);
    const out = zoomViewport(defaultViewport(), 0.5, viewportCenter(defaultViewport()));
    expect(out.zoom).toBe(0.5);
    expect(viewportCenter(out)[0]).toBeCloseTo(800);
  });

  it("pans in map units", () => {
    const vp = panViewport(defaultViewport(), 40, -10);
    expect(vp.x).toBe(40);
    expect(vp.y).toBe(-10);
  });
});
