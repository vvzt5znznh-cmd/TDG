import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { editableVertices, pointerDistance, rotateHandlePoint } from "../../map/geometry";
import { pickFeature, pickVertex } from "../../map/hitTest";
import { allGroundAndOverlayFeatures } from "../../map/mapBase";
import { clampViewport, clientToMap, viewBox, zoomViewport, type Viewport } from "../../map/viewport";
import type { Audience, MapDocument, MapFeature, Point } from "../../schema/types";
import { MapScene } from "./MapView";

export type MapTool = "select" | "pan" | "stamp" | "draw";

type Drag =
  | { kind: "pan"; lastClient: [number, number] }
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
  onViewport,
  onSelect,
  onClickPoint,
  onFinishDraft,
  onMove,
  onMoveVertex,
  onRotate,
  onStrokeStart,
  onStrokeEnd,
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
  onViewport: (viewport: Viewport) => void;
  onSelect: (id: string | null) => void;
  onClickPoint: (point: Point) => void;
  onFinishDraft?: () => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveVertex: (id: string, index: number, point: Point) => void;
  onRotate: (id: string, rotationDeg: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const selected = selectedId ? allGroundAndOverlayFeatures(map).find((feature) => feature.id === selectedId) : undefined;
  const panning = tool === "pan" || spacePan;

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      const el = svgRef.current;
      if (!el) return;
      event.preventDefault();
      const point = clientToMap(event, el.getBoundingClientRect(), viewport);
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      onViewport(zoomViewport(viewport, factor, point));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [viewport, onViewport]);

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
    return clientToMap(event, svg.getBoundingClientRect(), viewport);
  }

  function maybeSnap(point: [number, number]): [number, number] {
    if (!snap) return point;
    const step = 25;
    return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
  }

  function screenThreshold(): number {
    const svg = svgRef.current;
    if (!svg) return 8;
    const rect = svg.getBoundingClientRect();
    return (DRAG_THRESHOLD_PX / Math.max(rect.width, 1)) * (1600 / viewport.zoom);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const point = mapPoint(event);
    if (!point) return;
    if (panning || event.button === 1) {
      dragRef.current = { kind: "pan", lastClient: [event.clientX, event.clientY] };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool !== "select") return;
    if (selected?.featureType === "symbol") {
      const [sx, sy] = selected.position.coordinates;
      const handle = rotateHandlePoint(sx, sy, selected.rotationDeg ?? 0);
      if (pointerDistance(point, handle) < 14) {
        onStrokeStart();
        dragRef.current = { kind: "rotate" };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (selected && selected.featureType !== "symbol") {
      const vertex = pickVertex(selected, point, 14);
      if (vertex != null) {
        onStrokeStart();
        dragRef.current = { kind: "vertex", index: vertex };
        suppressClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    const hit = pickFeature(visibleFeatures(map, audience), point);
    if (hit) {
      onSelect(hit.id);
      dragRef.current = { kind: "press", id: hit.id, start: point, last: point };
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sizeW = 1600 / viewport.zoom;
      const sizeH = 1200 / viewport.zoom;
      const dx = ((event.clientX - drag.lastClient[0]) / rect.width) * sizeW;
      const dy = ((event.clientY - drag.lastClient[1]) / rect.height) * sizeH;
      drag.lastClient = [event.clientX, event.clientY];
      onViewport(clampViewport({ ...viewport, x: viewport.x - dx, y: viewport.y - dy }));
      return;
    }
    const point = mapPoint(event);
    if (!point) return;
    if (drag.kind === "press") {
      if (pointerDistance(point, drag.start) < screenThreshold()) return;
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

  function handleClick(event: { clientX: number; clientY: number }) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current) return;
    const point = mapPoint(event);
    if (!point) return;
    const snapped = maybeSnap(point);
    if (panning) return;
    if (tool === "select") {
      const hit = pickFeature(visibleFeatures(map, audience), snapped);
      onSelect(hit?.id ?? null);
      return;
    }
    onClickPoint({ type: "Point", coordinates: snapped });
  }

  const handles = selected && selected.featureType !== "symbol" ? editableVertices(selected.geometry) : [];
  const symbolHandle =
    selected?.featureType === "symbol"
      ? rotateHandlePoint(selected.position.coordinates[0], selected.position.coordinates[1], selected.rotationDeg ?? 0)
      : null;

  return (
    <div className={`map-canvas-frame ${greyscale ? "greyscale" : ""}`}>
      <svg
        ref={svgRef}
        className="map-canvas"
        viewBox={viewBox(viewport)}
        style={{ cursor: cursor ?? (panning ? "grab" : tool === "select" ? "default" : "crosshair") }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
        {tool === "select" &&
          handles.map(([hx, hy], index) => (
            <circle key={index} className="vertex-handle" cx={hx} cy={hy} r={8} fill="#fff" stroke="#9a2f2a" strokeWidth={2} />
          ))}
        {tool === "select" && symbolHandle && selected?.featureType === "symbol" ? (
          <g>
            <line
              x1={selected.position.coordinates[0]}
              y1={selected.position.coordinates[1]}
              x2={symbolHandle[0]}
              y2={symbolHandle[1]}
              stroke="#9a2f2a"
              strokeWidth={1.5}
            />
            <circle className="rotate-handle" cx={symbolHandle[0]} cy={symbolHandle[1]} r={7} fill="#fff" stroke="#9a2f2a" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function visibleFeatures(map: MapDocument, audience: Audience | "all"): MapFeature[] {
  return allGroundAndOverlayFeatures(map).filter((feature) => {
    if (map.base.kind === "vector" && map.base.features.some((item) => item.id === feature.id)) return true;
    const layer = map.layers.find((item) => item.features.some((itemFeature) => itemFeature.id === feature.id));
    return !layer || audience === "all" || layer.visibleIn.includes(audience);
  });
}
