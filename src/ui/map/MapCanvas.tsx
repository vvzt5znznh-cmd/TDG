import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { editableVertices, nearestEdge, pointerDistance, pointsBBox, rotateHandleFromBbox, type BBox } from "../../map/geometry";
import { pickFeature, pickVertex } from "../../map/hitTest";
import { allGroundAndOverlayFeatures } from "../../map/mapBase";
import { graphicEdgeCount, isAxisKind, vertexRoles, type VertexRole } from "../../map/milstd";
import { clampViewport, clientToMapFromSvg, contentScale, screenToMapDistance, viewBox, zoomViewport, type Viewport } from "../../map/viewport";
import type { Audience, MapDocument, MapFeature, Point } from "../../schema/types";
import { FeatureShape, MapScene } from "./MapView";

export type MapTool = "select" | "pan" | "draw";

type Drag =
  | { kind: "pan"; lastClient: [number, number]; moved?: boolean }
  | { kind: "press"; id: string; start: [number, number]; last: [number, number] }
  | { kind: "move"; id: string; last: [number, number] }
  | { kind: "vertex"; index: number }
  | { kind: "rotate" };

const DRAG_THRESHOLD_PX = 5;

export function MapCanvas({
  map,
  imageUrl,
  audience,
  greyscale,
  loadBearingIds,
  selectedId,
  viewport,
  tool,
  snap,
  showGrid,
  draftPoints,
  cursor,
  svgRef: svgRefProp,
  ghost,
  placing,
  drawing,
  insertMode,
  onViewport,
  onSelect,
  onClickPoint,
  onFinishDraft,
  onMove,
  onMoveVertex,
  onRotate,
  onStrokeStart,
  onStrokeEnd,
  onHoverPoint,
  onPlaceAt,
  onInsertVertex,
  onDeleteVertex,
}: {
  map: MapDocument;
  imageUrl?: string;
  audience: Audience | "all";
  greyscale?: boolean;
  loadBearingIds?: Set<string>;
  selectedId?: string | null;
  viewport: Viewport;
  tool: MapTool;
  snap: boolean;
  showGrid?: boolean;
  draftPoints?: [number, number][];
  cursor?: string;
  svgRef?: RefObject<SVGSVGElement | null>;
  ghost?: MapFeature | null;
  placing?: boolean;
  drawing?: boolean;
  insertMode?: boolean;
  onViewport: (viewport: Viewport) => void;
  onSelect: (id: string | null) => void;
  onClickPoint: (point: Point) => void;
  onFinishDraft?: () => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveVertex: (id: string, index: number, point: Point) => void;
  onRotate: (id: string, rotationDeg: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onHoverPoint?: (point: [number, number] | null) => void;
  onPlaceAt?: (point: [number, number]) => void;
  onInsertVertex?: (id: string, afterIndex: number, point: [number, number]) => void;
  onDeleteVertex?: (id: string, index: number) => void;
}) {
  const localSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = svgRefProp ?? localSvgRef;
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const [rubber, setRubber] = useState<[number, number] | null>(null);
  const selected = selectedId ? allGroundAndOverlayFeatures(map).find((feature) => feature.id === selectedId) : undefined;
  const panning = tool === "pan" || spacePan;

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      const el = svgRef.current;
      if (!el) return;
      event.preventDefault();
      const point = clientToMapFromSvg(el, event, viewport);
      // Trackpad pinch arrives as ctrl+wheel with fine deltas; plain wheel steps stay gentle.
      const factor =
        event.ctrlKey || event.metaKey
          ? Math.exp(-event.deltaY * 0.012)
          : event.deltaY > 0
            ? 0.92
            : 1.09;
      onViewport(zoomViewport(viewport, factor, point));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [viewport, onViewport, svgRef]);

  useEffect(() => {
    function typing(event: KeyboardEvent) {
      return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
    }
    function onDown(event: KeyboardEvent) {
      if (event.code !== "Space" || typing(event) || event.repeat) return;
      if (drawing || placing) return;
      event.preventDefault();
      setSpacePan(true);
    }
    function onUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePan(false);
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [drawing, placing]);

  function mapPoint(event: { clientX: number; clientY: number }): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    return clientToMapFromSvg(svg, event, viewport);
  }

  function maybeSnap(point: [number, number]): [number, number] {
    if (!snap) return point;
    const step = 25;
    return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
  }

  function mapPx(screenPx: number): number {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect() ?? { width: 800, height: 600 };
    return screenToMapDistance(screenPx, rect, viewport);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (placing || drawing) return;
    const point = mapPoint(event);
    if (!point) return;
    if (panning || event.button === 1) {
      dragRef.current = { kind: "pan", lastClient: [event.clientX, event.clientY] };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool !== "select") return;
    const slop = mapPx(12);
    const box = selected ? featureBBox(selected) : null;
    if (selected?.featureType === "symbol" && box) {
      const { handle } = rotateHandleFromBbox(box, selected.rotationDeg ?? 0, mapPx(28));
      if (pointerDistance(point, handle) < slop) {
        onStrokeStart();
        dragRef.current = { kind: "rotate" };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (selected && selected.featureType !== "symbol") {
      const vertex = pickVertex(selected, point, slop);
      if (vertex != null) {
        onStrokeStart();
        dragRef.current = { kind: "vertex", index: vertex };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    const hit = pickFeature(visibleFeatures(map, audience), point, slop);
    if (hit) {
      onSelect(hit.id);
      dragRef.current = { kind: "press", id: hit.id, start: point, last: point };
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (drawing || placing) return;
    dragRef.current = { kind: "pan", lastClient: [event.clientX, event.clientY] };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const hover = mapPoint(event);
    onHoverPoint?.(hover);
    // Rubber band from the last clicked point while drawing terrain or a graphic.
    if ((tool === "draw" || drawing) && draftPoints && draftPoints.length > 0 && hover) {
      setRubber(maybeSnap(hover));
    } else if (rubber) {
      setRubber(null);
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = contentScale(rect, viewport);
      const dxClient = event.clientX - drag.lastClient[0];
      const dyClient = event.clientY - drag.lastClient[1];
      if (!drag.moved && Math.abs(dxClient) + Math.abs(dyClient) > 3) {
        drag.moved = true;
        suppressClickRef.current = true;
      }
      drag.lastClient = [event.clientX, event.clientY];
      onViewport(clampViewport({ ...viewport, x: viewport.x - dxClient / scale, y: viewport.y - dyClient / scale }));
      return;
    }
    const point = mapPoint(event);
    if (!point) return;
    if (drag.kind === "press") {
      if (pointerDistance(point, drag.start) < mapPx(DRAG_THRESHOLD_PX)) return;
      onStrokeStart();
      onMove(drag.id, point[0] - drag.last[0], point[1] - drag.last[1]);
      dragRef.current = { kind: "move", id: drag.id, last: point };
      return;
    }
    if (drag.kind === "move") {
      onMove(drag.id, point[0] - drag.last[0], point[1] - drag.last[1]);
      drag.last = point;
      return;
    }
    if (!selectedId) return;
    if (drag.kind === "vertex") {
      onMoveVertex(selectedId, drag.index, { type: "Point", coordinates: maybeSnap(point) });
      return;
    }
    if (drag.kind === "rotate" && selected?.featureType === "symbol") {
      const [sx, sy] = selected.position.coordinates;
      const deg = (Math.atan2(point[0] - sx, sy - point[1]) * 180) / Math.PI;
      onRotate(selectedId, Math.round(deg));
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (drag && drag.kind !== "pan" && drag.kind !== "press") onStrokeEnd();
    dragRef.current = null;
  }

  function handleClick(event: { clientX: number; clientY: number; altKey?: boolean; shiftKey?: boolean }) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current) return;
    const point = mapPoint(event);
    if (!point) return;
    const snapped = maybeSnap(point);
    if (placing || drawing) {
      onPlaceAt?.(snapped);
      return;
    }
    if (panning) return;
    if (tool === "select") {
      if (event.shiftKey && selected && selected.featureType !== "symbol" && onDeleteVertex) {
        const vertex = pickVertex(selected, point, mapPx(12));
        if (vertex != null) {
          onDeleteVertex(selected.id, vertex);
          return;
        }
      }
      if ((event.altKey || insertMode) && selected && selected.featureType !== "symbol" && onInsertVertex) {
        const verts = editableVertices(selected.geometry);
        const closed = selected.geometry.type === "Polygon";
        const edgeLimit =
          selected.featureType === "control_measure"
            ? graphicEdgeCount(selected.kind, verts.length, closed)
            : closed
              ? verts.length
              : verts.length - 1;
        const edgeVerts =
          selected.featureType === "control_measure" && isAxisKind(selected.kind)
            ? verts.slice(0, Math.max(2, verts.length - 1))
            : verts;
        const edge = nearestEdge(edgeVerts, point, closed && edgeLimit === verts.length);
        if (edge && edge.index < edgeLimit && edge.dist < mapPx(18)) {
          onInsertVertex(selected.id, edge.index, maybeSnap(edge.at));
          return;
        }
      }
      const hit = pickFeature(visibleFeatures(map, audience), snapped, mapPx(12));
      onSelect(hit?.id ?? null);
      return;
    }
    onClickPoint({ type: "Point", coordinates: snapped });
  }

  const handleR = mapPx(6);
  const handles = selected && selected.featureType !== "symbol" && !drawing ? editableVertices(selected.geometry) : [];
  const roles =
    selected?.featureType === "control_measure" ? vertexRoles(selected.kind, handles.length) : handles.map(() => "path" as VertexRole);
  const box = selected?.featureType === "symbol" ? featureBBox(selected) : null;
  const symbolSpin = selected?.featureType === "symbol" && box ? rotateHandleFromBbox(box, selected.rotationDeg ?? 0, mapPx(28)) : null;
  const drawPts = drawing && draftPoints ? draftPoints : [];

  return (
    <div className={`map-canvas-frame ${greyscale ? "greyscale" : ""}`}>
      <svg
        ref={svgRef}
        className="map-canvas"
        viewBox={viewBox(viewport)}
        preserveAspectRatio="xMidYMid meet"
        style={{
          cursor:
            cursor ?? (placing || drawing ? "crosshair" : panning ? "grab" : tool === "select" ? "default" : "crosshair"),
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          onHoverPoint?.(null);
          setRubber(null);
        }}
        onClick={handleClick}
        onDoubleClick={() => {
          if (draftPoints && draftPoints.length > 0) onFinishDraft?.();
        }}
        role="application"
        aria-label={map.name}
      >
        <MapScene
          map={map}
          imageUrl={imageUrl}
          audience={audience}
          loadBearingIds={loadBearingIds}
          selectedId={selectedId}
          draftPoints={draftPoints}
          showGrid={showGrid}
        />
        {(tool === "draw" || drawing) && rubber && draftPoints && draftPoints.length > 0 ? (
          <line
            x1={draftPoints[draftPoints.length - 1]![0]}
            y1={draftPoints[draftPoints.length - 1]![1]}
            x2={rubber[0]}
            y2={rubber[1]}
            stroke="#9a2f2a"
            strokeWidth={2}
            strokeDasharray="6 6"
            pointerEvents="none"
          />
        ) : null}
        {ghost ? (
          <g className="unit-ghost" pointerEvents="none">
            <FeatureShape feature={ghost} />
          </g>
        ) : null}
        {drawPts.length > 0 ? (
          <g className="draw-points" pointerEvents="none">
            {drawPts.map(([hx, hy], index) => (
              <g key={index}>
                <circle cx={hx} cy={hy} r={handleR} fill="#fff" stroke="#9a2f2a" strokeWidth={handleR / 4} />
                <text x={hx} y={hy - handleR * 1.6} textAnchor="middle" fontSize={handleR * 2.2} fill="#9a2f2a">
                  {index + 1}
                </text>
              </g>
            ))}
          </g>
        ) : null}
        {tool === "select" && !placing && !drawing ? (
          <g className="map-handles" pointerEvents="none">
            {handles.map(([hx, hy], index) => (
              <VertexHandle key={index} x={hx} y={hy} r={handleR} role={roles[index] ?? "path"} />
            ))}
            {symbolSpin ? <RotateHandle anchor={symbolSpin.anchor} handle={symbolSpin.handle} r={handleR} /> : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function featureBBox(feature: MapFeature): BBox | null {
  if (feature.featureType === "symbol") {
    const [cx, cy] = feature.position.coordinates;
    const size = feature.sizePx ?? 42;
    return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
  }
  if (!("geometry" in feature)) return null;
  return pointsBBox(editableVertices(feature.geometry));
}

function VertexHandle({ x, y, r, role }: { x: number; y: number; r: number; role: VertexRole }) {
  const stroke = role === "letter" ? "#1f4f7a" : role === "protected" ? "#3e4c34" : "#9a2f2a";
  if (role === "width") {
    return (
      <rect
        className="vertex-handle vertex-handle-width"
        x={x - r}
        y={y - r}
        width={r * 2}
        height={r * 2}
        transform={`rotate(45 ${x} ${y})`}
        fill="#fff"
        stroke={stroke}
        strokeWidth={r / 4}
      />
    );
  }
  return (
    <circle
      className={`vertex-handle vertex-handle-${role}`}
      cx={x}
      cy={y}
      r={role === "letter" ? r * 1.1 : r}
      fill="#fff"
      stroke={stroke}
      strokeWidth={r / 4}
    />
  );
}

/** Circular-arrow rotate control — the arrow is the handle, not a disc with an icon. */
function RotateHandle({ anchor, handle, r }: { anchor: [number, number]; handle: [number, number]; r: number }) {
  const size = r * 2.15;
  return (
    <g className="rotate-handle">
      <line x1={anchor[0]} y1={anchor[1]} x2={handle[0]} y2={handle[1]} stroke="#9a2f2a" strokeWidth={Math.max(1.2, r / 3.5)} />
      <path
        d={rotateArrowPath(handle[0], handle[1], size)}
        fill="none"
        stroke="#fff"
        strokeWidth={Math.max(3.2, r)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={rotateArrowPath(handle[0], handle[1], size)}
        fill="none"
        stroke="#9a2f2a"
        strokeWidth={Math.max(1.6, r / 2.2)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function rotateArrowPath(cx: number, cy: number, radius: number): string {
  const sx = cx;
  const sy = cy - radius;
  const ex = cx + radius * 0.92;
  const ey = cy;
  const arrow = `M ${ex} ${ey} l ${-radius * 0.55} ${-radius * 0.18} M ${ex} ${ey} l ${-radius * 0.18} ${radius * 0.55}`;
  return `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey} ${arrow}`;
}

function visibleFeatures(map: MapDocument, audience: Audience | "all"): MapFeature[] {
  return allGroundAndOverlayFeatures(map).filter((feature) => {
    if (map.base.kind === "vector" && map.base.features.some((item) => item.id === feature.id)) return true;
    const layer = map.layers.find((item) => item.features.some((itemFeature) => itemFeature.id === feature.id));
    return !layer || audience === "all" || layer.visibleIn.includes(audience);
  });
}
