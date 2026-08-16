import { useMemo } from "react";
import type { MilSymbol } from "../../schema/types";
import { renderSymbol } from "../../map/symbolRender";

export function SymbolMark({ symbol, highlight }: { symbol: MilSymbol; highlight?: boolean }) {
  const [x, y] = symbol.position.coordinates;
  const rotation = symbol.rotationDeg ?? 0;
  const rendered = useMemo(() => {
    try {
      return renderSymbol(symbol);
    } catch {
      return null;
    }
  }, [symbol]);
  const pad = 6;
  if (!rendered) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={10} fill="#fff" stroke="#8f1d1d" strokeWidth={2} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation})`} style={{ cursor: "pointer" }}>
      {highlight ? (
        <rect
          x={-rendered.anchor.x - pad}
          y={-rendered.anchor.y - pad}
          width={rendered.width + pad * 2}
          height={rendered.height + pad * 2}
          fill="none"
          stroke="#9a2f2a"
          strokeWidth={3}
        />
      ) : null}
      <image
        href={rendered.href}
        x={-rendered.anchor.x}
        y={-rendered.anchor.y}
        width={rendered.width}
        height={rendered.height}
      />
    </g>
  );
}
