import type { ReactElement } from "react";
import type { Audience, ControlMeasure, GeoGeometry, MapDocument, MapFeature, TerrainFeatureKind } from "../../schema/types";
import { pointsOf, toSvgPoints } from "../../map/geometry";
import { arrowHeadPoints, controlMeasureStyle, labelAnchor, tickAt } from "../../map/controlGraphics";
import { baseFeatures, isRasterUnderlay, syntheticBaseLayer } from "../../map/mapBase";
import { MAP_HEIGHT, MAP_WIDTH } from "../../map/viewport";
import { SymbolMark } from "./MilSymbolMark";

export const AFFILIATION_COLOR = {
  friendly: "#1f4f7a",
  hostile: "#8f1d1d",
  neutral: "#2d6a3f",
  unknown: "#5c5346",
} as const;

const TERRAIN_PAINT: Record<TerrainFeatureKind, { color: string; fill: string; width: number }> = {
  contour: { color: "#8a6a40", fill: "#8a6a40", width: 1.5 },
  spot_elevation: { color: "#5a4a38", fill: "#5a4a38", width: 2 },
  woods: { color: "#3d4a32", fill: "#5d7a52", width: 2 },
  water: { color: "#2d4a62", fill: "#6a8fa8", width: 2 },
  wetland: { color: "#2d5a4e", fill: "#6a9a88", width: 2 },
  built_up: { color: "#5a5248", fill: "#b8aea0", width: 2 },
  road: { color: "#6b5344", fill: "#6b5344", width: 8 },
  trail: { color: "#8a6a50", fill: "#8a6a50", width: 4 },
  bridge: { color: "#4a4038", fill: "#4a4038", width: 8 },
  custom: { color: "#3e4c34", fill: "#3e4c34", width: 2 },
};

function terrainPaint(kind: TerrainFeatureKind, loadBearing?: boolean, highlight?: boolean) {
  if (loadBearing) return { color: "#9a2f2a", fill: "#9a2f2a", width: 4 };
  const paint = TERRAIN_PAINT[kind];
  return highlight ? { ...paint, width: paint.width + 2 } : paint;
}

export function ControlMeasureShape({
  feature,
  highlight,
  loadBearing,
}: {
  feature: ControlMeasure;
  highlight?: boolean;
  loadBearing?: boolean;
}) {
  const pts = pointsOf(feature.geometry);
  const style = controlMeasureStyle(feature.kind);
  const color = loadBearing || highlight ? "#9a2f2a" : style.color;
  const width = highlight ? style.width + 1.5 : style.width;
  const [lx, ly] = labelAnchor(feature);
  const label = (
    <text x={lx + 10} y={ly - 8} fontSize={14} fontFamily="serif" fill={color} fontWeight={700}>
      {feature.label}
    </text>
  );

  if (feature.kind === "objective" && feature.geometry.type === "Point" && pts[0]) {
    const [x, y] = pts[0];
    return (
      <g>
        <circle cx={x} cy={y} r={18} fill="none" stroke={color} strokeWidth={width} />
        <circle cx={x} cy={y} r={4} fill={color} />
        <text x={x} y={y - 26} textAnchor="middle" fontSize={14} fontFamily="serif" fontWeight={700} fill={color}>
          {feature.label}
        </text>
      </g>
    );
  }

  if ((feature.kind === "trp" || feature.kind === "lz" || feature.kind === "checkpoint") && pts[0]) {
    const [x, y] = pts[0];
    return (
      <g>
        <rect x={x - 11} y={y - 11} width={22} height={22} fill="#fff" stroke={color} strokeWidth={width} />
        <text x={x} y={y - 18} textAnchor="middle" fontSize={13} fontFamily="serif" fontWeight={700} fill={color}>
          {feature.label}
        </text>
      </g>
    );
  }

  if (feature.geometry.type === "LineString" && pts.length >= 2) {
    const last = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    const first = pts[0]!;
    const second = pts[1]!;
    const startTick = tickAt(first, second);
    const endTick = tickAt(last, prev);
    return (
      <g>
        <polyline
          points={toSvgPoints(pts)}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={style.dash}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {feature.kind === "phase_line" ? (
          <>
            <line x1={startTick[0][0]} y1={startTick[0][1]} x2={startTick[1][0]} y2={startTick[1][1]} stroke={color} strokeWidth={width} />
            <line x1={endTick[0][0]} y1={endTick[0][1]} x2={endTick[1][0]} y2={endTick[1][1]} stroke={color} strokeWidth={width} />
          </>
        ) : null}
        {feature.kind === "axis_of_advance" ? <polygon points={arrowHeadPoints(prev, last)} fill={color} /> : null}
        {label}
      </g>
    );
  }

  if (feature.geometry.type === "Polygon" && pts.length >= 3) {
    return (
      <g>
        <polygon
          points={toSvgPoints(pts)}
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={width}
          strokeDasharray={style.dash}
        />
        {label}
      </g>
    );
  }

  if (pts[0]) {
    const [x, y] = pts[0];
    return (
      <g>
        <circle cx={x} cy={y} r={7} fill="#fff" stroke={color} strokeWidth={width} />
        {label}
      </g>
    );
  }
  return null;
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
  if (feature.featureType === "control_measure") {
    return <ControlMeasureShape feature={feature} highlight={highlight} loadBearing={loadBearing} />;
  }
  const pts = pointsOf(feature.geometry);
  if (pts.length === 0) return null;
  const paint = feature.featureType === "terrain" ? terrainPaint(feature.kind, loadBearing, highlight) : { color: "#3e4c34", fill: "#3e4c34", width: highlight ? 4 : 2 };
  if (feature.geometry.type === "Point") {
    const [x, y] = pts[0] ?? [0, 0];
    return (
      <g>
        <circle cx={x} cy={y} r={7} fill="#fff" stroke={paint.color} strokeWidth={paint.width} />
        {"label" in feature && feature.label ? (
          <text x={x + 10} y={y - 8} fontSize={14} fontFamily="serif" fill={paint.color}>
            {feature.label}
          </text>
        ) : null}
      </g>
    );
  }
  if (feature.geometry.type === "LineString") {
    return (
      <g>
        <polyline points={toSvgPoints(pts)} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeLinecap="round" />
        {"label" in feature && feature.label && pts[0] ? (
          <text x={pts[0][0]} y={pts[0][1] - 8} fontSize={13} fill={paint.color}>
            {feature.label}
          </text>
        ) : null}
      </g>
    );
  }
  return (
    <g>
      <polygon points={toSvgPoints(pts)} fill={paint.fill} fillOpacity={0.42} stroke={paint.color} strokeWidth={paint.width} />
      {"label" in feature && feature.label && pts[0] ? (
        <text x={pts[0][0]} y={pts[0][1] + 16} fontSize={13} fill={paint.color}>
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

export function MapGrid({ step = 50 }: { step?: number }) {
  const lines: ReactElement[] = [];
  for (let x = 0; x <= MAP_WIDTH; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} stroke="#3d4a32" strokeOpacity={x % (step * 4) === 0 ? 0.18 : 0.08} />);
  }
  for (let y = 0; y <= MAP_HEIGHT; y += step) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="#3d4a32" strokeOpacity={y % (step * 4) === 0 ? 0.18 : 0.08} />);
  }
  return <g className="map-grid">{lines}</g>;
}

export function usedLegend(map: MapDocument, audience: Audience | "all") {
  const entries: { id: string; label: string; color: string }[] = [];
  const seen = new Set<string>();
  const layers = [syntheticBaseLayer(map), ...map.layers];
  for (const layer of layers) {
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
        entries.push({ id: key, label: feature.kind.replaceAll("_", " "), color: TERRAIN_PAINT[feature.kind].fill });
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

export function MapScene({
  map,
  imageUrl,
  audience,
  loadBearingIds,
  selectedId,
  draftPoints,
  showGrid,
  onSelect,
}: {
  map: MapDocument;
  imageUrl?: string;
  audience: Audience | "all";
  loadBearingIds?: Set<string>;
  selectedId?: string | null;
  draftPoints?: [number, number][];
  showGrid?: boolean;
  onSelect?: (id: string) => void;
}) {
  const layers = map.layers.filter((layer) => audience === "all" || layer.visibleIn.includes(audience));
  const ground = audience === "all" || audience === "student" || audience === "facilitator" ? baseFeatures(map) : [];
  const imageOpacity = map.underlay?.opacity ?? (map.base.kind === "raster" ? map.base.opacity : 1);
  const tracing = isRasterUnderlay(imageUrl) ? imageUrl : undefined;

  return (
    <>
      <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#e7e2d1" />
      {tracing ? (
        <image
          href={tracing}
          x={0}
          y={0}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          opacity={imageOpacity}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      ) : (
        <>
          <rect
            x={24}
            y={24}
            width={MAP_WIDTH - 48}
            height={MAP_HEIGHT - 48}
            fill="#efe9d6"
            stroke="#3d4a32"
            strokeWidth={4}
          />
          {map.name ? (
            <text x={80} y={70} fontFamily="Georgia, serif" fontSize={28} fill="#3d4a32">
              {map.name}
            </text>
          ) : null}
        </>
      )}
      {showGrid ? <MapGrid /> : null}
      <g className="map-base">
        {ground.map((feature) => (
          <g key={feature.id} onClick={() => onSelect?.(feature.id)}>
            <FeatureShape feature={feature} highlight={selectedId === feature.id} loadBearing={loadBearingIds?.has(feature.id)} />
          </g>
        ))}
      </g>
      {layers.map((layer) => (
        <g key={layer.id}>
          {layer.features.map((feature) => (
            <g key={feature.id} onClick={() => onSelect?.(feature.id)}>
              <FeatureShape feature={feature} highlight={selectedId === feature.id} loadBearing={loadBearingIds?.has(feature.id)} />
            </g>
          ))}
        </g>
      ))}
      <ScaleBar x={60} y={MAP_HEIGHT - 50} meters={map.scaleBar.meters} lengthPx={map.scaleBar.renderLengthPx} />
      <NorthArrow x={MAP_WIDTH - 50} y={70} rotationDeg={map.northArrow.rotationDeg} />
      {draftPoints && draftPoints.length > 0 ? (
        <g>
          {draftPoints.length > 1 ? (
            <polyline
              points={draftPoints.map(([dx, dy]) => `${dx},${dy}`).join(" ")}
              fill="none"
              stroke="#9a2f2a"
              strokeWidth={3}
              strokeDasharray="8 6"
            />
          ) : null}
          {draftPoints.map(([dx, dy], index) => (
            <circle key={index} cx={dx} cy={dy} r={7} fill="#9a2f2a" stroke="#fff" strokeWidth={2} />
          ))}
        </g>
      ) : null}
    </>
  );
}

export function MapView({
  map,
  imageUrl,
  audience,
  greyscale,
  loadBearingIds,
  selectedId,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
}: {
  map: MapDocument;
  imageUrl?: string;
  audience: Audience | "all";
  greyscale?: boolean;
  loadBearingIds?: Set<string>;
  selectedId?: string | null;
  width?: number;
  height?: number;
}) {
  return (
    <div>
      <div className={`map-stage ${greyscale ? "greyscale" : ""}`}>
        <svg className="map-overlay map-print" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={map.name}>
          <MapScene map={map} imageUrl={imageUrl} audience={audience} loadBearingIds={loadBearingIds} selectedId={selectedId} />
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
