import { describe, expect, it } from "vitest";
import { clientToMap, defaultViewport, panViewport, viewBox, zoomViewport } from "./viewport";

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

  it("pans in map units", () => {
    const vp = panViewport(defaultViewport(), 40, -10);
    expect(vp.x).toBe(40);
    expect(vp.y).toBe(-10);
  });
});
