import { useRef } from "react";
import type { MilSymbol } from "../../schema/types";
import { renderSymbol, type SymbolPicture } from "../../map/symbolRender";

function pictureKey(symbol: MilSymbol): string {
  return [
    symbol.sidc ?? "",
    symbol.designation ?? "",
    symbol.higherFormation ?? "",
    symbol.staffComments ?? "",
    symbol.strengthModifier ?? "",
    symbol.confidence,
    String(symbol.directionDeg ?? ""),
    String(Boolean(symbol.headquarters)),
    String(symbol.sizePx ?? ""),
  ].join("|");
}

export function SymbolMark({
  symbol,
  highlight,
  picture,
}: {
  symbol: MilSymbol;
  highlight?: boolean;
  picture?: SymbolPicture;
}) {
  const [x, y] = symbol.position.coordinates;
  const rotation = symbol.rotationDeg ?? 0;
  const cacheRef = useRef<{ key: string; drawn: SymbolPicture | null } | null>(null);
  const key = pictureKey(symbol);
  let drawn: SymbolPicture | null;
  if (picture) {
    drawn = picture;
  } else if (cacheRef.current?.key === key) {
    drawn = cacheRef.current.drawn;
  } else {
    try {
      drawn = renderSymbol(symbol);
    } catch {
      drawn = null;
    }
    cacheRef.current = { key, drawn };
  }
  const pad = 6;
  if (!drawn) {
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
          x={-drawn.anchor.x - pad}
          y={-drawn.anchor.y - pad}
          width={drawn.width + pad * 2}
          height={drawn.height + pad * 2}
          fill="none"
          stroke="#9a2f2a"
          strokeWidth={3}
        />
      ) : null}
      <image
        href={drawn.href}
        x={-drawn.anchor.x}
        y={-drawn.anchor.y}
        width={drawn.width}
        height={drawn.height}
      />
    </g>
  );
}
