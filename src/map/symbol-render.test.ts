import { describe, expect, it } from "vitest";
import { symbolDataUrl } from "./symbolRender";
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
});
