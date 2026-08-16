import { describe, expect, it } from "vitest";
import { symbolDataUrl } from "../ui/map/MilSymbolMark";
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

  it("renders a symbol with no designation or sidc", () => {
    const rendered = symbolDataUrl(
      sample({ sidc: undefined, designation: undefined, affiliation: "friendly", frame: "rectangle", confidence: "confirmed" }),
    );
    expect(rendered.href.startsWith("data:image/svg+xml")).toBe(true);
  });
});
