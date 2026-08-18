import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { editableVertices, geometryCentroid, nearestEdge, pointerDistance, rotateHandlePoint } from "../../map/geometry";
import { pickFeature, pickVertex } from "../../map/hitTest";
import { allGroundAndOverlayFeatures } from "../../map/mapBase";
import { clampViewport, clientToMapFromSvg, contentScale, screenToMapDistance, viewBox, zoomViewport, type Viewport } from "../../map/viewport";
import type { Audience, MapDocument, MapFeature, Point } from "../../schema/types";
import { FeatureShape, MapScene } from "./MapView";

export type MapTool = "select" | "pan" | "draw";

type Drag =
  | { kind: "pan"; lastClient: [number, number]; moved?: boolean }
  | { kind: "press"; id: string; start: [number, number]; last: [number, number] }
  | { kind: "move"; id: string; last: [number, number] }
  | { kind: "vertex"; index: number }
  | { kind: "rotate" }
  | { kind: "spin"; center: [number, number]; lastAngle: number }
  | { kind: "scale"; center: [number, number]; last: [number, number] };

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
    if (selected?.featureType === "symbol") {
      const [sx, sy] = selected.position.coordinates;
      const handle = rotateHandlePoint(sx, sy, selected.rotationDeg ?? 0, mapPx(44));
      if (pointerDistance(point, handle) < slop) {
        onStrokeStart();
        dragRef.current = { kind: "rotate" };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (selected && selected.featureType !== "symbol") {
      const spinAt = rotateHandlePoint(geometryCentroid(selected.geometry)[0], geometryCentroid(selected.geometry)[1], 0, mapPx(44));
      if (onRotateDelta && pointerDistance(point, spinAt) < slop) {
        onStrokeStart();
        const [cx, cy] = geometryCentroid(selected.geometry);
        const lastAngle = (Math.atan2(point[0] - cx, cy - point[1]) * 180) / Math.PI;
        dragRef.current = { kind: "spin", center: [cx, cy], lastAngle };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const scaleAt = scaleHandlePoint(selected);
      if (scaleAt && onScale && pointerDistance(point, scaleAt) < slop) {
        onStrokeStart();
        dragRef.current = { kind: "scale", center: geometryCentroid(selected.geometry), last: point };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
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
        const edge = nearestEdge(verts, point, selected.geometry.type === "Polygon");
        if (edge && edge.dist < mapPx(18)) {
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
  const scaleHandle = selected && selected.featureType !== "symbol" && onScale ? scaleHandlePoint(selected) : null;
  const symbolHandle =
    selected?.featureType === "symbol"
      ? rotateHandlePoint(selected.position.coordinates[0], selected.position.coordinates[1], selected.rotationDeg ?? 0, mapPx(44))
      : null;
  const geomSpin =
    selected && selected.featureType !== "symbol" && onRotateDelta
      ? rotateHandlePoint(geometryCentroid(selected.geometry)[0], geometryCentroid(selected.geometry)[1], 0, mapPx(44))
      : null;
  const geomCenter = selected && selected.featureType !== "symbol" ? geometryCentroid(selected.geometry) : null;

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
        {tool === "select" &&
          !placing &&
          handles.map(([hx, hy], index) => (
            <circle key={index} className="vertex-handle" cx={hx} cy={hy} r={handleR} fill="#fff" stroke="#9a2f2a" strokeWidth={handleR / 4} />
          ))}
        {tool === "select" && !placing && scaleHandle ? (
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
        {tool === "select" && !placing && geomSpin && geomCenter ? (
          <g>
            <line x1={geomCenter[0]} y1={geomCenter[1]} x2={geomSpin[0]} y2={geomSpin[1]} stroke="#9a2f2a" strokeWidth={handleR / 4} />
            <circle className="rotate-handle" cx={geomSpin[0]} cy={geomSpin[1]} r={handleR} fill="#fff" stroke="#9a2f2a" strokeWidth={handleR / 4} />
          </g>
        ) : null}
        {tool === "select" && !placing && symbolHandle && selected?.featureType === "symbol" ? (
          <g>
            <line
              x1={selected.position.coordinates[0]}
              y1={selected.position.coordinates[1]}
              x2={symbolHandle[0]}
              y2={symbolHandle[1]}
              stroke="#9a2f2a"
              strokeWidth={handleR / 4}
            />
            <circle className="rotate-handle" cx={symbolHandle[0]} cy={symbolHandle[1]} r={handleR} fill="#fff" stroke="#9a2f2a" strokeWidth={handleR / 4} />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/** Uniform-scale grip: sits off the bottom-right of the feature's control points. */
function scaleHandlePoint(feature: MapFeature): [number, number] | null {
  if (feature.featureType === "symbol") return null;
  const pts = editableVertices(feature.geometry);
  if (pts.length < 2) return null;
  const maxX = Math.max(...pts.map((p) => p[0]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  return [maxX + 26, maxY + 26];
}

function visibleFeatures(map: MapDocument, audience: Audience | "all"): MapFeature[] {
  return allGroundAndOverlayFeatures(map).filter((feature) => {
    if (map.base.kind === "vector" && map.base.features.some((item) => item.id === feature.id)) return true;
    const layer = map.layers.find((item) => item.features.some((itemFeature) => itemFeature.id === feature.id));
    return !layer || audience === "all" || layer.visibleIn.includes(audience);
  });
}
