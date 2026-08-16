import { useMemo } from "react";
import ms from "milsymbol";
import type { MilSymbol } from "../../schema/types";
import { buildSidc, frameForAffiliation } from "../../map/sidc";

ms.setStandard("APP6");

export function symbolDataUrl(symbol: MilSymbol, size = 40): { href: string; anchor: { x: number; y: number }; width: number; height: number } {
  const sidc =
    symbol.sidc ||
    buildSidc({
      affiliation: symbol.affiliation,
      confidence: symbol.confidence,
      echelon: "platoon",
      functionId: "UCI",
    });
  const generated = new ms.Symbol(sidc, {
    size,
    standard: "APP6",
    uniqueDesignation: symbol.designation,
    infoFields: Boolean(symbol.designation),
    reinforcedReduced:
      symbol.strengthModifier === "reinforced" ? "+" : symbol.strengthModifier === "reduced" ? "-" : undefined,
    additionalInformation: symbol.confidence === "templated" ? "?" : undefined,
  });
  const svg = generated.asSVG();
  return {
    href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    anchor: generated.getAnchor(),
    width: generated.getSize().width,
    height: generated.getSize().height,
  };
}

export function SymbolMark({ symbol, highlight }: { symbol: MilSymbol; highlight?: boolean }) {
  const [x, y] = symbol.position.coordinates;
  const rendered = useMemo(() => symbolDataUrl(symbol, 42), [symbol]);
  const pad = 6;
  return (
    <g style={{ cursor: "pointer" }}>
      {highlight ? (
        <rect
          x={x - rendered.anchor.x - pad}
          y={y - rendered.anchor.y - pad}
          width={rendered.width + pad * 2}
          height={rendered.height + pad * 2}
          fill="none"
          stroke="#9a2f2a"
          strokeWidth={3}
        />
      ) : null}
      <image
        href={rendered.href}
        x={x - rendered.anchor.x}
        y={y - rendered.anchor.y}
        width={rendered.width}
        height={rendered.height}
      />
    </g>
  );
}

export function SymbolChip({
  sidc,
  selected,
  label,
  onClick,
}: {
  sidc: string;
  selected?: boolean;
  label: string;
  onClick: () => void;
}) {
  const href = useMemo(() => {
    const generated = new ms.Symbol(sidc, { size: 28, standard: "APP6" });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.asSVG())}`;
  }, [sidc]);
  return (
    <button type="button" className={`symbol-chip ${selected ? "selected" : ""}`} onClick={onClick} title={label}>
      <img src={href} alt="" />
      <span>{label}</span>
    </button>
  );
}

export { frameForAffiliation };
