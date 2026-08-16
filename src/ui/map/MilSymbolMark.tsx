import { useMemo } from "react";
import ms from "milsymbol";
import type { MilSymbol } from "../../schema/types";
import { buildSidc, frameForAffiliation } from "../../map/sidc";
import type { SymbolOptions } from "milsymbol";

ms.setStandard("APP6");

/** milsymbol throws if optional text fields are present but undefined. */
export function symbolDataUrl(
  symbol: MilSymbol,
  size = 40,
): { href: string; anchor: { x: number; y: number }; width: number; height: number } {
  const sidc =
    symbol.sidc ||
    buildSidc({
      affiliation: symbol.affiliation,
      confidence: symbol.confidence,
      echelon: "platoon",
      functionId: "UCI",
    });
  const options: SymbolOptions = {
    size,
    standard: "APP6",
    infoFields: Boolean(symbol.designation),
  };
  if (symbol.designation) options.uniqueDesignation = symbol.designation;
  if (symbol.strengthModifier === "reinforced") options.reinforcedReduced = "+";
  if (symbol.strengthModifier === "reduced") options.reinforcedReduced = "-";
  if (symbol.confidence === "templated") options.additionalInformation = "?";

  const generated = new ms.Symbol(sidc, options);
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
  const rendered = useMemo(() => {
    try {
      return symbolDataUrl(symbol, 42);
    } catch {
      return null;
    }
  }, [symbol]);
  const pad = 6;
  if (!rendered) {
    return (
      <g>
        <circle cx={x} cy={y} r={10} fill="#fff" stroke="#8f1d1d" strokeWidth={2} />
      </g>
    );
  }
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
    try {
      const generated = new ms.Symbol(sidc, { size: 28, standard: "APP6" });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.asSVG())}`;
    } catch {
      return "";
    }
  }, [sidc]);
  return (
    <button type="button" className={`symbol-chip ${selected ? "selected" : ""}`} onClick={onClick} title={label}>
      {href ? <img src={href} alt="" /> : null}
      <span>{label}</span>
    </button>
  );
}

export { frameForAffiliation };
