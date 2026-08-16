import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent } from "react";
import { editableVertices, pointsOf, toSvgPoints } from "../../map/geometry";
import { baseFeatures, syntheticBaseLayer } from "../../map/mapBase";
import type { Audience, GeoGeometry, MapDocument, MapFeature, Point, TerrainFeatureKind } from "../../schema/types";
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

function featurePaint(feature: MapFeature, loadBearing?: boolean, highlight?: boolean) {
  if (loadBearing) return { color: "#9a2f2a", fill: "#9a2f2a", width: 4 };
  if (feature.featureType === "terrain") {
    const paint = TERRAIN_PAINT[feature.kind];
    return highlight ? { ...paint, width: paint.width + 2 } : paint;
  }
  const color = feature.featureType === "control_measure" ? "#1b2118" : "#3e4c34";
  return { color, fill: color, width: highlight ? 4 : 2 };
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
  const paint = featurePaint(feature, loadBearing, highlight);
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
        <polyline points={toSvgPoints(pts)} fill="none" stroke={paint.color} strokeWidth={paint.width} />
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

function clientToMap(event: { clientX: number; clientY: number }, svg: SVGSVGElement, width: number, height: number): [number, number] {
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * width;
  const y = ((event.clientY - rect.top) / rect.height) * height;
  return [x, y];
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
  onFinishDraft,
  onMoveVertex,
  draftPoints,
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
  onFinishDraft?: () => void;
  onMoveVertex?: (featureId: string, vertexIndex: number, point: Point) => void;
  draftPoints?: [number, number][];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; index: number } | null>(null);
  const suppressClickRef = useRef(false);
  const layers = map.layers.filter((layer) => audience === "all" || layer.visibleIn.includes(audience));
  const ground = audience === "all" || audience === "student" || audience === "facilitator" ? baseFeatures(map) : [];
  const imageOpacity = map.underlay?.opacity ?? (map.base.kind === "raster" ? map.base.opacity : 1);

  const selectedFeature =
    selectedId == null
      ? undefined
      : [...ground, ...layers.flatMap((layer) => layer.features)].find((feature) => feature.id === selectedId);
  const handles =
    onMoveVertex && selectedFeature && "geometry" in selectedFeature ? editableVertices(selectedFeature.geometry) : [];

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current || !onClickPoint) return;
    const svg = event.currentTarget;
    const [x, y] = clientToMap(event, svg, width, height);
    onClickPoint({ type: "Point", coordinates: [x, y] });
  }

  function moveDrag(event: ReactPointerEvent) {
    const current = dragRef.current;
    const svg = svgRef.current;
    if (!current || !svg || !onMoveVertex) return;
    const [x, y] = clientToMap(event, svg, width, height);
    onMoveVertex(current.id, current.index, { type: "Point", coordinates: [x, y] });
  }

  return (
    <div>
      <div className={`map-stage ${greyscale ? "greyscale" : ""}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={map.name} style={{ opacity: imageOpacity }} />
        ) : (
          <div style={{ aspectRatio: `${width} / ${height}`, background: "#e7e2d1" }} />
        )}
        <svg
          ref={svgRef}
          className="map-overlay"
          viewBox={`0 0 ${width} ${height}`}
          onClick={handleClick}
          onDoubleClick={() => {
            if (draftPoints && draftPoints.length > 0) onFinishDraft?.();
          }}
          role="img"
          aria-label={map.name}
        >
          <g className="map-base">
            {ground.map((feature) => (
              <g
                key={feature.id}
                onClick={(event) => {
                  if (onMoveVertex) event.stopPropagation();
                  onSelect?.(feature.id);
                }}
              >
                <FeatureShape
                  feature={feature}
                  highlight={selectedId === feature.id}
                  loadBearing={loadBearingIds?.has(feature.id)}
                />
              </g>
            ))}
          </g>
          {layers.map((layer) => (
            <g key={layer.id}>
              {layer.features.map((feature) => (
                <g
                  key={feature.id}
                  onClick={(event) => {
                    if (onMoveVertex) event.stopPropagation();
                    onSelect?.(feature.id);
                  }}
                >
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
          {selectedId && handles.length > 0 ? (
            <g>
              {handles.map(([hx, hy], index) => (
                <circle
                  key={`${selectedId}-${index}`}
                  className="vertex-handle"
                  cx={hx}
                  cy={hy}
                  r={8}
                  fill="#fff"
                  stroke="#9a2f2a"
                  strokeWidth={2}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    dragRef.current = { id: selectedId, index };
                    suppressClickRef.current = true;
                    (event.target as SVGCircleElement).setPointerCapture?.(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (dragRef.current) moveDrag(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    dragRef.current = null;
                    window.setTimeout(() => {
                      dragRef.current = null;
                    }, 0);
                  }}
                />
              ))}
            </g>
          ) : null}
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
