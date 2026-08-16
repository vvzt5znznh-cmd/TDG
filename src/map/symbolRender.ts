import ms from "milsymbol";
import type { SymbolOptions } from "milsymbol";
import type { MilSymbol } from "../schema/types";
import { withSyncedSidc } from "./sidc";

ms.setStandard("APP6");

export const DEFAULT_SYMBOL_SIZE = 42;

/** milsymbol throws if optional text fields are present but undefined. */
export function symbolOptions(symbol: MilSymbol, size = symbol.sizePx ?? DEFAULT_SYMBOL_SIZE): SymbolOptions {
  const options: SymbolOptions = {
    size,
    standard: "APP6",
    infoFields: Boolean(symbol.designation || symbol.higherFormation || symbol.staffComments),
    infoSize: 0.38,
  };
  if (symbol.designation) options.uniqueDesignation = symbol.designation;
  if (symbol.higherFormation) options.higherFormation = symbol.higherFormation;
  if (symbol.staffComments) options.staffComments = symbol.staffComments;
  if (symbol.strengthModifier === "reinforced") options.reinforcedReduced = "+";
  if (symbol.strengthModifier === "reduced") options.reinforcedReduced = "-";
  if (symbol.confidence === "templated") options.additionalInformation = "?";
  if (typeof symbol.directionDeg === "number" && symbol.directionDeg !== 0) options.direction = symbol.directionDeg;
  if (symbol.headquarters) options.hqStaffLength = Math.max(20, size * 0.7);
  return options;
}

export function symbolSidc(symbol: MilSymbol): string {
  return withSyncedSidc(symbol).sidc ?? "SFGPUCI----D";
}

/** Strip the XML declaration so milsymbol markup can be inlined in the overlay SVG (print-safe). */
export function inlineSvgMarkup(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>/i, "").trim();
}

export function renderSymbol(symbol: MilSymbol, size = symbol.sizePx ?? DEFAULT_SYMBOL_SIZE) {
  const generated = new ms.Symbol(symbolSidc(symbol), symbolOptions(symbol, size));
  const svg = generated.asSVG();
  let href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // Nested SVG data URLs often vanish in print; PNG from canvas survives the print pipeline.
  if (typeof document !== "undefined") {
    try {
      href = generated.asCanvas().toDataURL("image/png");
    } catch {
      // jsdom / tests keep the SVG href
    }
  }
  return {
    href,
    svg,
    inlineSvg: inlineSvgMarkup(svg),
    anchor: generated.getAnchor(),
    width: generated.getSize().width,
    height: generated.getSize().height,
    valid: Boolean(generated.isValid()),
  };
}

export function symbolDataUrl(symbol: MilSymbol, size = symbol.sizePx ?? DEFAULT_SYMBOL_SIZE) {
  return renderSymbol(symbol, size);
}

export function catalogChipHref(sidc: string): string {
  const generated = new ms.Symbol(sidc, { size: 28, standard: "APP6" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.asSVG())}`;
}
