import type { MouseEvent } from "react";
import type { Audience, GeoGeometry, MapDocument, MapFeature, Point } from "../../schema/types";
import { SymbolMark } from "./MilSymbolMark";

export const AFFILIATION_COLOR = {
  friendly: "#1f4f7a",
  hostile: "#8f1d1d",
  neutral: "#2d6a3f",
  unknown: "#5c5346",
} as const;

function pointsOf(geometry: GeoGeometry): [number, number][] {
  if (geometry.type === "Point") return [[geometry.coordinates[0], geometry.coordinates[1]]];
  if (geometry.type === "LineString") return geometry.coordinates.map(([x, y]) => [x, y]);
  return geometry.coordinates[0]?.map(([x, y]) => [x, y]) ?? [];
}

function toSvgPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

export function FeatureShape({
  feature,
  highlight,
  loadBearing,
}: {
  feature: MapFeature;
  highlight?: boolean;
  loadBearing?: boolean;
}) {
  if (feature.featureType === "symbol") {
    return <SymbolMark symbol={feature} highlight={highlight || loadBearing} />;
  }
  const pts = pointsOf(feature.geometry);
  if (pts.length === 0) return null;
  const color = loadBearing ? "#9a2f2a" : feature.featureType === "control_measure" ? "#1b2118" : "#3e4c34";
  const width = loadBearing || highlight ? 4 : 2;
  if (feature.geometry.type === "Point") {
    const [x, y] = pts[0] ?? [0, 0];
    return (
      <g>
        <circle cx={x} cy={y} r={7} fill="#fff" stroke={color} strokeWidth={width} />
        {"label" in feature && feature.label ? (
          <text x={x + 10} y={y - 8} fontSize={14} fontFamily="serif" fill={color}>
            {feature.label}
          </text>
        ) : null}
      </g>
    );
  }
  if (feature.geometry.type === "LineString") {
    return (
      <g>
        <polyline points={toSvgPoints(pts)} fill="none" stroke={color} strokeWidth={width} />
        {"label" in feature && feature.label && pts[0] ? (
          <text x={pts[0][0]} y={pts[0][1] - 8} fontSize={13} fill={color}>
            {feature.label}
          </text>
        ) : null}
      </g>
    );
  }
  return (
    <g>
      <polygon points={toSvgPoints(pts)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={width} />
      {"label" in feature && feature.label && pts[0] ? (
        <text x={pts[0][0]} y={pts[0][1] + 16} fontSize={13} fill={color}>
          {feature.label}
        </text>
      ) : null}
    </g>
  );
}

export function NorthArrow({ x, y, rotationDeg }: { x: number; y: number; rotationDeg: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotationDeg})`}>
      <polygon points="0,-28 8,12 -8,12" fill="#1b2118" />
      <text x={0} y={-34} textAnchor="middle" fontSize={14} fontFamily="serif">
        N
      </text>
    </g>
  );
}

export function ScaleBar({ x, y, meters, lengthPx }: { x: number; y: number; meters: number; lengthPx: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={lengthPx} y2={0} stroke="#1b2118" strokeWidth={4} />
      <line x1={0} y1={-6} x2={0} y2={6} stroke="#1b2118" strokeWidth={3} />
      <line x1={lengthPx} y1={-6} x2={lengthPx} y2={6} stroke="#1b2118" strokeWidth={3} />
      <text x={lengthPx / 2} y={-10} textAnchor="middle" fontSize={12}>
        {meters} m
      </text>
    </g>
  );
}

export function usedLegend(map: MapDocument, audience: Audience | "all") {
  const entries: { id: string; label: string; color: string }[] = [];
  const seen = new Set<string>();
  for (const layer of map.layers) {
    if (audience !== "all" && !layer.visibleIn.includes(audience)) continue;
    for (const feature of layer.features) {
      if (feature.featureType === "symbol") {
        const key = `${feature.affiliation}-${feature.confidence}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
          id: key,
          label: `${feature.affiliation} (${feature.confidence})`,
          color: AFFILIATION_COLOR[feature.affiliation],
        });
      } else if (feature.featureType === "control_measure") {
        const key = `cm-${feature.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ id: key, label: feature.kind.replaceAll("_", " "), color: "#1b2118" });
      } else if (feature.featureType === "terrain") {
        const key = `t-${feature.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ id: key, label: feature.kind.replaceAll("_", " "), color: "#3e4c34" });
      }
    }
  }
  if (map.legend.manualEntries) {
    for (const entry of map.legend.manualEntries) {
      entries.push({ id: entry.id, label: entry.label, color: entry.swatch ?? "#1b2118" });
    }
  }
  return entries;
}

export function MapView({
  map,
  imageUrl,
  audience,
  greyscale,
  loadBearingIds,
  selectedId,
  onSelect,
  onClickPoint,
  width = 1600,
  height = 1200,
}: {
  map: MapDocument;
  imageUrl?: string;
  audience: Audience | "all";
  greyscale?: boolean;
  loadBearingIds?: Set<string>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onClickPoint?: (point: Point) => void;
  width?: number;
  height?: number;
}) {
  const layers = map.layers.filter((layer) => audience === "all" || layer.visibleIn.includes(audience));

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onClickPoint) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    onClickPoint({ type: "Point", coordinates: [x, y] });
  }

  return (
    <div>
      <div className={`map-stage ${greyscale ? "greyscale" : ""}`}>
        {imageUrl ? <img src={imageUrl} alt={map.name} /> : <div style={{ aspectRatio: `${width} / ${height}`, background: "#e7e2d1" }} />}
        <svg
          className="map-overlay"
          viewBox={`0 0 ${width} ${height}`}
          onClick={handleClick}
          role="img"
          aria-label={map.name}
        >
          {layers.map((layer) => (
            <g key={layer.id}>
              {layer.features.map((feature) => (
                <g key={feature.id} onClick={(event) => { event.stopPropagation(); onSelect?.(feature.id); }}>
                  <FeatureShape
                    feature={feature}
                    highlight={selectedId === feature.id}
                    loadBearing={loadBearingIds?.has(feature.id)}
                  />
                </g>
              ))}
            </g>
          ))}
          <ScaleBar x={60} y={height - 50} meters={map.scaleBar.meters} lengthPx={map.scaleBar.renderLengthPx} />
          <NorthArrow x={width - 50} y={70} rotationDeg={map.northArrow.rotationDeg} />
        </svg>
      </div>
      {map.legend.autoGenerate ? (
        <div className="legend">
          {usedLegend(map, audience).map((entry) => (
            <div className="legend-item" key={entry.id}>
              <span style={{ width: 12, height: 12, background: entry.color, display: "inline-block", border: "1px solid #1b2118" }} />
              {entry.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function geometryFromDraft(kind: "point" | "line" | "polygon", draft: [number, number][]): GeoGeometry | null {
  if (kind === "point" && draft[0]) return { type: "Point", coordinates: draft[0] };
  if (kind === "line" && draft.length >= 2) return { type: "LineString", coordinates: draft };
  if (kind === "polygon" && draft.length >= 3) {
    const closed = [...draft, draft[0]];
    return { type: "Polygon", coordinates: [closed] };
  }
  return null;
}
