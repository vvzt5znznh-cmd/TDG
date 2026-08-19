import type { ReactElement } from "react";
import type { Audience, ControlMeasure, GeoGeometry, MapDocument, MapFeature, TerrainFeature, TerrainFeatureKind } from "../../schema/types";
import { centroid, editableVertices, nestedRings, pointsOf, smoothPath, toSvgPoints } from "../../map/geometry";
import { renderControlMeasure } from "../../map/milstd";
import { baseFeatures, isRasterUnderlay, syntheticBaseLayer } from "../../map/mapBase";
import { MAP_HEIGHT, MAP_WIDTH } from "../../map/viewport";
import { SymbolMark } from "./MilSymbolMark";
import { useMilStdReady } from "./useMilStd";

export const AFFILIATION_COLOR = {
  friendly: "#1f4f7a",
  hostile: "#8f1d1d",
  neutral: "#2d6a3f",
  unknown: "#5c5346",
} as const;

const TERRAIN_PAINT: Record<TerrainFeatureKind, { color: string; fill: string; width: number }> = {
  contour: { color: "#8a6f4d", fill: "#8a6f4d", width: 1.8 },
  spot_elevation: { color: "#5a4a38", fill: "#5a4a38", width: 2 },
  mountain: { color: "#7a6247", fill: "#7a6247", width: 2 },
  woods: { color: "#6f9455", fill: "#89ab6d", width: 1.5 },
  water: { color: "#4a7a99", fill: "#9dbfd4", width: 2.5 },
  river: { color: "#5b8fae", fill: "#5b8fae", width: 9 },
  stream: { color: "#5b8fae", fill: "#5b8fae", width: 3.5 },
  wetland: { color: "#7f9c6b", fill: "#b5cfa4", width: 2 },
  built_up: { color: "#5a5248", fill: "#cfc4b2", width: 2 },
  building: { color: "#1b2118", fill: "#1b2118", width: 2 },
  road: { color: "#1b2118", fill: "#1b2118", width: 7 },
  trail: { color: "#1b2118", fill: "#1b2118", width: 2.5 },
  bridge: { color: "#1b2118", fill: "#1b2118", width: 5 },
  custom: { color: "#3e4c34", fill: "#3e4c34", width: 2 },
};

function terrainPaint(feature: TerrainFeature, loadBearing?: boolean, highlight?: boolean) {
  if (loadBearing) return { color: "#9a2f2a", fill: "#9a2f2a", width: 4 };
  const paint = TERRAIN_PAINT[feature.kind];
  const color = feature.stroke ?? paint.color;
  const fill = feature.fill ?? paint.fill;
  return highlight ? { color, fill, width: paint.width + 2 } : { color, fill, width: paint.width };
}

/**
 * Control measures and tactical mission tasks, drawn by the US Army
 * MIL-STD-2525D renderer from the feature's control points. Selection is the
 * ink itself plus its control-point handles — never a bounding square.
 */
export function ControlMeasureShape({
  feature,
  highlight,
  loadBearing,
}: {
  feature: ControlMeasure;
  highlight?: boolean;
  loadBearing?: boolean;
}) {
  const ready = useMilStdReady();
  const pts = pointsOf(feature.geometry);
  const rendered = ready ? renderControlMeasure(feature) : null;
  if (!rendered) {
    // Renderer still loading (or unmapped kind): sketch the control points.
    if (pts.length === 0) return null;
    if (pts.length === 1) {
      const [x, y] = pts[0]!;
      return <circle cx={x} cy={y} r={7} fill="#fff" stroke="#5c5346" strokeWidth={2} strokeDasharray="4 4" />;
    }
    return <polyline points={toSvgPoints(pts)} fill="none" stroke="#5c5346" strokeWidth={2} strokeDasharray="4 4" />;
  }
  const [bx, by] = pts[0] ?? [rendered.x, rendered.y];
  return (
    <g className={`milstd-graphic${highlight ? " is-selected" : ""}`}>
      <g transform={`translate(${rendered.x} ${rendered.y})`} dangerouslySetInnerHTML={{ __html: rendered.innerSvg }} />
      {loadBearing ? (
        <circle cx={bx} cy={by} r={5} fill="#9a2f2a" stroke="#fff" strokeWidth={1.5} pointerEvents="none" />
      ) : null}
    </g>
  );
}

/** The ")(" abutment flares at both ends of a bridge deck. */
function bridgeFlares(pts: [number, number][]): ReactElement[] {
  const flares: ReactElement[] = [];
  const ends: [number, number][][] = [
    [pts[0]!, pts[1]!],
    [pts[pts.length - 1]!, pts[pts.length - 2]!],
  ];
  ends.forEach(([end, inner], endIndex) => {
    const angle = Math.atan2(inner[1] - end[1], inner[0] - end[0]);
    for (const side of [1, -1]) {
      const flare = angle + side * (Math.PI * 3) / 4;
      flares.push(
        <line
          key={`${endIndex}-${side}`}
          x1={end[0]}
          y1={end[1]}
          x2={end[0] + 13 * Math.cos(flare)}
          y2={end[1] + 13 * Math.sin(flare)}
          stroke="#1b2118"
          strokeWidth={2.5}
          strokeLinecap="round"
        />,
      );
    }
  });
  return flares;
}

/** Ground drawn like a photocopied TDG sheet: stippled woods, dashed contours, bold black roads. */
function TerrainShape({ feature, highlight, loadBearing }: { feature: TerrainFeature; highlight?: boolean; loadBearing?: boolean }) {
  const pts = pointsOf(feature.geometry);
  if (pts.length === 0) return null;
  const paint = terrainPaint(feature, loadBearing, highlight);
  const emphasis = highlight || loadBearing;
  const label =
    feature.label && pts[0] ? (
      <text x={pts[0][0]} y={pts[0][1] - 8} fontSize={13} fontFamily="serif" fill={paint.color}>
        {feature.label}
      </text>
    ) : null;

  if (feature.geometry.type === "LineString" && pts.length >= 2) {
    const d = smoothPath(pts);
    if (feature.kind === "river" || feature.kind === "stream") {
      return (
        <g>
          <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeLinecap="round" strokeLinejoin="round" />
          {label}
        </g>
      );
    }
    if (feature.kind === "road") {
      return (
        <g>
          <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeLinecap="round" strokeLinejoin="round" />
          {label}
        </g>
      );
    }
    if (feature.kind === "trail") {
      return (
        <g>
          <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeDasharray="1 9" strokeLinecap="round" strokeLinejoin="round" />
          {label}
        </g>
      );
    }
    if (feature.kind === "bridge") {
      return (
        <g>
          <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeLinecap="round" />
          {bridgeFlares(pts)}
          {label}
        </g>
      );
    }
    if (feature.kind === "contour") {
      return (
        <g>
          <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeDasharray="9 6" strokeLinecap="round" />
          {label}
        </g>
      );
    }
    return (
      <g>
        <path d={d} fill="none" stroke={paint.color} strokeWidth={paint.width} strokeLinecap="round" />
        {label}
      </g>
    );
  }

  if (feature.geometry.type === "Polygon" && pts.length >= 3) {
    const ring = editableVertices(feature.geometry);
    const d = smoothPath(ring, true);
    if (feature.kind === "mountain" || feature.kind === "contour") {
      const [cx, cy] = centroid(ring);
      const total = Math.max(1, Math.min(12, feature.contourCount ?? 3));
      const innerCount = Math.max(0, total - 1);
      const interval = feature.contourInterval ?? 10;
      const peak = feature.elevation;
      const inners = nestedRings(ring, innerCount);
      return (
        <g>
          <path d={d} fill="#efe9d6" fillOpacity={emphasis ? 0.5 : 0.01} stroke={paint.color} strokeWidth={paint.width} strokeDasharray="10 5" />
          {inners.map((inner, index) => (
            <g key={index}>
              <path d={smoothPath(inner, true)} fill="none" stroke={paint.color} strokeWidth={1.7} strokeDasharray={`${Math.max(4, 8 - index)} ${4 + index}`} />
              {peak != null ? (
                <text
                  x={centroid(inner)[0]}
                  y={centroid(inner)[1] + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="serif"
                  fill={paint.color}
                >
                  {peak - (innerCount - index) * interval}
                </text>
              ) : null}
            </g>
          ))}
          {feature.label || peak != null ? (
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={15} fontFamily="serif" fontWeight={600} fill="#3c4336">
              {feature.label ?? String(peak)}
            </text>
          ) : null}
        </g>
      );
    }
    if (feature.kind === "woods") {
      return (
        <g>
          <path d={d} fill="#89ab6d" fillOpacity={0.16} stroke="none" />
          <path d={d} fill="url(#tdg-woods)" stroke={emphasis ? "#9a2f2a" : "none"} strokeWidth={2} strokeDasharray="3 6" />
          {label}
        </g>
      );
    }
    if (feature.kind === "built_up") {
      return (
        <g>
          <path d={d} fill={paint.fill} fillOpacity={0.55} stroke={paint.color} strokeWidth={paint.width} />
          <path d={d} fill="url(#tdg-builtup)" stroke="none" />
          {label}
        </g>
      );
    }
    if (feature.kind === "wetland" || feature.kind === "water") {
      return (
        <g>
          <path d={d} fill={paint.fill} fillOpacity={feature.kind === "water" ? 0.75 : 0.85} stroke={paint.color} strokeWidth={paint.width} />
          {feature.label && pts[0] ? (
            <text x={pts[0][0]} y={pts[0][1] + 16} fontSize={13} fontFamily="serif" fill="#3c4336">
              {feature.label}
            </text>
          ) : null}
        </g>
      );
    }
    return (
      <g>
        <path d={d} fill={paint.fill} fillOpacity={0.42} stroke={paint.color} strokeWidth={paint.width} />
        {feature.label && pts[0] ? (
          <text x={pts[0][0]} y={pts[0][1] + 16} fontSize={13} fontFamily="serif" fill={paint.color}>
            {feature.label}
          </text>
        ) : null}
      </g>
    );
  }

  const [x, y] = pts[0] ?? [0, 0];
  if (feature.kind === "building") {
    return (
      <g>
        <rect x={x - 7} y={y - 7} width={14} height={14} fill={paint.fill} stroke={emphasis ? "#9a2f2a" : "none"} strokeWidth={2} />
        {label}
      </g>
    );
  }
  if (feature.kind === "spot_elevation") {
    return (
      <g>
        <text x={x} y={y + 4} textAnchor="middle" fontSize={13} fontFamily="serif" fill="#3c4336">
          x {feature.label ?? ""}
        </text>
      </g>
    );
  }
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill="#fff" stroke={paint.color} strokeWidth={paint.width} />
      {label}
    </g>
  );
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
  if (feature.featureType === "terrain") {
    return <TerrainShape feature={feature} highlight={highlight} loadBearing={loadBearing} />;
  }
  const pts = pointsOf(feature.geometry);
  if (pts.length === 0) return null;
  const paint = { color: "#3e4c34", fill: "#3e4c34", width: highlight || loadBearing ? 4 : 2 };
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
        entries.push({ id: key, label: feature.kind.replaceAll("_", " "), color: feature.stroke ?? TERRAIN_PAINT[feature.kind].fill });
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
      <defs>
        <pattern id="tdg-builtup" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect x="3" y="3" width="7" height="7" fill="#5a5248" fillOpacity="0.5" />
        </pattern>
        <pattern id="tdg-woods" width="30" height="30" patternUnits="userSpaceOnUse">
          {/* Irregular stipple like the photocopied vegetation dots on TDG sheets. */}
          <circle cx="6" cy="7" r="2.6" fill="#6f9455" fillOpacity="0.85" />
          <circle cx="19" cy="4" r="2.1" fill="#6f9455" fillOpacity="0.7" />
          <circle cx="26" cy="14" r="2.5" fill="#6f9455" fillOpacity="0.8" />
          <circle cx="12" cy="18" r="2.9" fill="#6f9455" fillOpacity="0.85" />
          <circle cx="3" cy="24" r="2" fill="#6f9455" fillOpacity="0.7" />
          <circle cx="21" cy="26" r="2.6" fill="#6f9455" fillOpacity="0.8" />
        </pattern>
      </defs>
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
