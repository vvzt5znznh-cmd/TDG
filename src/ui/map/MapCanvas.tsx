import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { editableVertices, geometryCentroid, nearestEdge, pointerDistance, pointsBBox, rotateHandleFromBbox, scaleHandleFromBbox, type BBox } from "../../map/geometry";
import { pickFeature, pickVertex } from "../../map/hitTest";
import { allGroundAndOverlayFeatures } from "../../map/mapBase";
import { axisRenderPoints, axisWidthFromHandle, clampAxisWidth, graphicEdgeCount, isAxisKind, renderControlMeasure, vertexRoles, type VertexRole } from "../../map/milstd";
import { clampPointToSheet, clampViewport, clientToMapFromSvg, contentScale, screenToMapDistance, viewBox, zoomViewport, type Viewport } from "../../map/viewport";
import type { Audience, ControlMeasure, MapDocument, MapFeature, Point } from "../../schema/types";
import { FeatureShape, MapScene } from "./MapView";

export type MapTool = "select" | "pan" | "draw";

type Drag =
  | { kind: "pan"; lastClient: [number, number]; moved?: boolean }
  | { kind: "press"; id: string; start: [number, number]; last: [number, number] }
  | { kind: "move"; id: string; last: [number, number] }
  | { kind: "vertex"; index: number }
  | { kind: "rotate" }
  | { kind: "spin"; center: [number, number]; lastAngle: number }
  | { kind: "scale"; center: [number, number]; last: [number, number] }
  | { kind: "axisWidth" };

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
  adjusting,
  onViewport,
  onSelect,
  onClickPoint,
  onFinishDraft,
  onMove,
  onMoveVertex,
  onMoveAxisWidth,
  onRotate,
  onRotateDelta,
  onScale,
  onStrokeStart,
  onStrokeEnd,
  onHoverPoint,
  onPlaceAt,
  onAdjustPoint,
  onInsertVertex,
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
  adjusting?: boolean;
  onViewport: (viewport: Viewport) => void;
  onSelect: (id: string | null) => void;
  onClickPoint: (point: Point) => void;
  onFinishDraft?: () => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveVertex: (id: string, index: number, point: Point) => void;
  onMoveAxisWidth?: (id: string, width: number) => void;
  onRotate: (id: string, rotationDeg: number) => void;
  onRotateDelta?: (id: string, deltaDeg: number) => void;
  onScale?: (id: string, factor: number, center: [number, number]) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onHoverPoint?: (point: [number, number] | null) => void;
  onPlaceAt?: (point: [number, number]) => void;
  onAdjustPoint?: (point: [number, number]) => void;
  onInsertVertex?: (id: string, afterIndex: number, point: [number, number]) => void;
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
  }, []);

  function mapPoint(event: { clientX: number; clientY: number }): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    return clientToMapFromSvg(svg, event, viewport);
  }

  function maybeSnap(point: [number, number]): [number, number] {
    const next = snap ? ([Math.round(point[0] / 25) * 25, Math.round(point[1] / 25) * 25] as [number, number]) : point;
    return clampPointToSheet(next);
  }

  function mapPx(screenPx: number): number {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect() ?? { width: 800, height: 600 };
    return screenToMapDistance(screenPx, rect, viewport);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (placing) return;
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
    if (selected && selected.featureType !== "symbol" && box) {
      const { handle: spinAt } = rotateHandleFromBbox(box, 0, mapPx(28));
      if (onRotateDelta && pointerDistance(point, spinAt) < slop) {
        onStrokeStart();
        const [cx, cy] = geometryCentroid(selected.geometry);
        const lastAngle = (Math.atan2(point[0] - cx, cy - point[1]) * 180) / Math.PI;
        dragRef.current = { kind: "spin", center: [cx, cy], lastAngle };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const scaleAt = onScale ? scaleHandleFromBbox(box, mapPx(16)) : null;
      if (scaleAt && pointerDistance(point, scaleAt) < slop) {
        onStrokeStart();
        dragRef.current = { kind: "scale", center: geometryCentroid(selected.geometry), last: point };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (selected.featureType === "control_measure" && isAxisKind(selected.kind) && onMoveAxisWidth) {
        const widthAt = axisWidthHandle(selected);
        if (widthAt && pointerDistance(point, widthAt) < slop) {
          onStrokeStart();
          dragRef.current = { kind: "axisWidth" };
          suppressClickRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
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
    // During adjust, a click on empty ground sizes the graphic — don't pan.
    if (adjusting) return;
    dragRef.current = { kind: "pan", lastClient: [event.clientX, event.clientY] };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const hover = mapPoint(event);
    onHoverPoint?.(hover);
    // Rubber band from the last clicked point while drawing.
    if (tool === "draw" && draftPoints && draftPoints.length > 0 && hover) {
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
    if (drag.kind === "axisWidth" && selected?.featureType === "control_measure" && onMoveAxisWidth) {
      const verts = editableVertices(selected.geometry);
      const raw = axisWidthFromHandle(verts, maybeSnap(point));
      onMoveAxisWidth(selectedId, clampAxisWidth(raw, shaftLen(verts)));
      return;
    }
    if (drag.kind === "scale") {
      const before = pointerDistance(drag.last, drag.center);
      const after = pointerDistance(point, drag.center);
      if (before > 4 && after > 4) {
        onScale?.(selectedId, after / before, drag.center);
        drag.last = point;
      }
      return;
    }
    if (drag.kind === "rotate" && selected?.featureType === "symbol") {
      const [sx, sy] = selected.position.coordinates;
      const deg = (Math.atan2(point[0] - sx, sy - point[1]) * 180) / Math.PI;
      onRotate(selectedId, Math.round(deg));
    }
    if (drag.kind === "spin") {
      const deg = (Math.atan2(point[0] - drag.center[0], drag.center[1] - point[1]) * 180) / Math.PI;
      const delta = deg - drag.lastAngle;
      if (Math.abs(delta) > 0.2) {
        onRotateDelta?.(selectedId, delta);
        drag.lastAngle = deg;
      }
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (drag && drag.kind !== "pan" && drag.kind !== "press") onStrokeEnd();
    dragRef.current = null;
  }

  function handleClick(event: { clientX: number; clientY: number; altKey?: boolean }) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current) return;
    const point = mapPoint(event);
    if (!point) return;
    const snapped = maybeSnap(point);
    if (placing) {
      onPlaceAt?.(snapped);
      return;
    }
    if (panning) return;
    if (tool === "select") {
      if (event.altKey && selected && selected.featureType !== "symbol" && onInsertVertex) {
        const verts = editableVertices(selected.geometry);
        const closed = selected.geometry.type === "Polygon";
        const edgeLimit =
          selected.featureType === "control_measure"
            ? graphicEdgeCount(selected.kind, verts.length, closed)
            : closed
              ? verts.length
              : verts.length - 1;
        const edge = nearestEdge(verts, point, closed && edgeLimit === verts.length);
        if (edge && edge.index < edgeLimit && edge.dist < mapPx(18)) {
          onInsertVertex(selected.id, edge.index, maybeSnap(edge.at));
          return;
        }
      }
      if (adjusting) {
        onAdjustPoint?.(snapped);
        return;
      }
      const hit = pickFeature(visibleFeatures(map, audience), snapped, mapPx(12));
      onSelect(hit?.id ?? null);
      return;
    }
    onClickPoint({ type: "Point", coordinates: snapped });
  }

  const handleR = mapPx(6);
  const handles = selected && selected.featureType !== "symbol" ? editableVertices(selected.geometry) : [];
  const roles =
    selected?.featureType === "control_measure" ? vertexRoles(selected.kind, handles.length) : handles.map(() => "path" as VertexRole);
  const widthHandle = selected?.featureType === "control_measure" && isAxisKind(selected.kind) ? axisWidthHandle(selected) : null;
  const box = selected ? featureBBox(selected) : null;
  const scaleHandle = selected && selected.featureType !== "symbol" && onScale && box ? scaleHandleFromBbox(box, mapPx(16)) : null;
  const symbolSpin =
    selected?.featureType === "symbol" && box ? rotateHandleFromBbox(box, selected.rotationDeg ?? 0, mapPx(28)) : null;
  const geomSpin = selected && selected.featureType !== "symbol" && onRotateDelta && box ? rotateHandleFromBbox(box, 0, mapPx(28)) : null;

  return (
    <div className={`map-canvas-frame ${greyscale ? "greyscale" : ""}`}>
      <svg
        ref={svgRef}
        className="map-canvas"
        viewBox={viewBox(viewport)}
        preserveAspectRatio="xMidYMid meet"
        style={{
          cursor:
            cursor ?? (placing ? "grabbing" : panning ? "grab" : tool === "select" ? "default" : "crosshair"),
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
        {tool === "draw" && rubber && draftPoints && draftPoints.length > 0 ? (
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
        {tool === "select" && !placing ? (
          <g className="map-handles" pointerEvents="none">
            {handles.map(([hx, hy], index) => (
              <VertexHandle key={index} x={hx} y={hy} r={handleR} role={roles[index] ?? "path"} />
            ))}
            {widthHandle ? <VertexHandle key="axis-width" x={widthHandle[0]} y={widthHandle[1]} r={handleR} role="width" /> : null}
            {scaleHandle ? (
              <rect
                className="scale-handle"
                x={scaleHandle[0] - handleR}
                y={scaleHandle[1] - handleR}
                width={handleR * 2}
                height={handleR * 2}
                fill="#fff"
                stroke="#3e4c34"
                strokeWidth={handleR / 4}
              />
            ) : null}
            {geomSpin ? <RotateHandle anchor={geomSpin.anchor} handle={geomSpin.handle} r={handleR} /> : null}
            {symbolSpin ? <RotateHandle anchor={symbolSpin.anchor} handle={symbolSpin.handle} r={handleR} /> : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function axisWidthHandle(feature: ControlMeasure): [number, number] | null {
  const verts = editableVertices(feature.geometry);
  if (verts.length === 0) return null;
  const pts = axisRenderPoints(verts, feature.axisWidth);
  return pts[pts.length - 1] ?? null;
}

function shaftLen(verts: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < verts.length; i++) {
    const a = verts[i - 1]!;
    const b = verts[i]!;
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

function featureBBox(feature: MapFeature): BBox | null {
  if (feature.featureType === "symbol") {
    const [cx, cy] = feature.position.coordinates;
    const size = feature.sizePx ?? 42;
    return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
  }
  if (feature.featureType === "control_measure") {
    const rendered = renderControlMeasure(feature);
    if (rendered && rendered.width > 4 && rendered.height > 4) {
      return { x: rendered.x, y: rendered.y, width: rendered.width, height: rendered.height };
    }
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

/** Circular-arrow rotate control at the end of a stem from the box top-center. */
function RotateHandle({ anchor, handle, r }: { anchor: [number, number]; handle: [number, number]; r: number }) {
  const size = r * 1.85;
  return (
    <g className="rotate-handle">
      <line x1={anchor[0]} y1={anchor[1]} x2={handle[0]} y2={handle[1]} stroke="#9a2f2a" strokeWidth={Math.max(1.2, r / 3.5)} />
      <circle cx={handle[0]} cy={handle[1]} r={size} fill="#fff" stroke="#9a2f2a" strokeWidth={Math.max(1.2, r / 3.5)} />
      <path
        d={rotateArrowPath(handle[0], handle[1], size * 0.58)}
        fill="none"
        stroke="#9a2f2a"
        strokeWidth={Math.max(1.4, r / 2.6)}
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
