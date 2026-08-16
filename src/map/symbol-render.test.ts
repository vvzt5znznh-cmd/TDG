import { describe, expect, it } from "vitest";
import { inlineSvgMarkup, symbolDataUrl } from "./symbolRender";
import type { MilSymbol } from "../schema/types";

function sample(overrides: Partial<MilSymbol> = {}): MilSymbol {
  return {
    featureType: "symbol",
    id: "sym1",
    sidc: "SHGAUCI----D",
    affiliation: "hostile",
    frame: "diamond",
    confidence: "suspected",
    position: { type: "Point", coordinates: [390, 300] },
    designation: "enemy plt",
    ...overrides,
  };
}

describe("milsymbol rendering", () => {
  it("renders a shipped-example-style symbol (no undefined text fields)", () => {
    const rendered = symbolDataUrl(sample());
    expect(rendered.href.startsWith("data:image/svg+xml")).toBe(true);
    expect(rendered.width).toBeGreaterThan(10);
    expect(rendered.anchor.x).toBeGreaterThan(0);
  });

  it("renders amplifiers without throwing", () => {
    const rendered = symbolDataUrl(
      sample({
        designation: "2. plut",
        higherFormation: "2. coy",
        staffComments: "DS",
        headquarters: true,
        directionDeg: 45,
        sizePx: 48,
      }),
    );
    expect(rendered.href.startsWith("data:image/svg+xml")).toBe(true);
    expect(rendered.width).toBeGreaterThan(40);
  });

  it("keeps a shipped hostile platoon SIDC when rebuilding", () => {
    const rendered = symbolDataUrl(sample());
    expect(rendered.valid).toBe(true);
  });

  it("strips the XML declaration so symbol markup can sit in the overlay SVG", () => {
    const rendered = symbolDataUrl(sample());
    expect(rendered.inlineSvg.startsWith("<svg")).toBe(true);
    expect(rendered.inlineSvg).not.toMatch(/<\?xml/);
    expect(inlineSvgMarkup("<?xml version=\"1.0\"?><svg/>")).toBe("<svg/>");
  });

  it("draws uniqueDesignation from the unit name", () => {
    const rendered = symbolDataUrl(sample({ designation: "1st Squad" }));
    expect(rendered.svg).toContain("1st Squad");
  });
});
