import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { editableVertices, pointerDistance, rotateHandlePoint } from "../../map/geometry";
import { pickFeature, pickVertex } from "../../map/hitTest";
import { allGroundAndOverlayFeatures } from "../../map/mapBase";
import { clampViewport, clientToMapFromSvg, contentScale, screenToMapDistance, viewBox, zoomViewport, type Viewport } from "../../map/viewport";
import type { Audience, MapDocument, MapFeature, Point } from "../../schema/types";
import type { UnitStamp } from "../../map/stamp";
import { stampFromDataTransfer } from "../../map/stamp";
import { MapScene } from "./MapView";

export type MapTool = "select" | "pan" | "draw";

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
  onDropStamp,
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
  onDropStamp?: (stamp: UnitStamp, point: Point) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const [dropReady, setDropReady] = useState(false);
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
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = contentScale(rect, viewport);
      const dx = (event.clientX - drag.lastClient[0]) / scale;
      const dy = (event.clientY - drag.lastClient[1]) / scale;
      drag.lastClient = [event.clientX, event.clientY];
      onViewport(clampViewport({ ...viewport, x: viewport.x - dx, y: viewport.y - dy }));
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
      const hit = pickFeature(visibleFeatures(map, audience), snapped, mapPx(12));
      onSelect(hit?.id ?? null);
      return;
    }
    onClickPoint({ type: "Point", coordinates: snapped });
  }

  function handleDragOver(event: ReactDragEvent) {
    if (!onDropStamp) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropReady(true);
  }

  function handleDrop(event: ReactDragEvent) {
    if (!onDropStamp) return;
    event.preventDefault();
    setDropReady(false);
    const stamp = stampFromDataTransfer(event.dataTransfer);
    const point = mapPoint(event);
    if (!stamp || !point) return;
    onDropStamp(stamp, { type: "Point", coordinates: maybeSnap(point) });
  }

  const handleR = mapPx(6);
  const handles = selected && selected.featureType !== "symbol" ? editableVertices(selected.geometry) : [];
  const symbolHandle =
    selected?.featureType === "symbol"
      ? rotateHandlePoint(selected.position.coordinates[0], selected.position.coordinates[1], selected.rotationDeg ?? 0, mapPx(44))
      : null;

  return (
    <div
      className={`map-canvas-frame ${greyscale ? "greyscale" : ""} ${dropReady ? "drop-ready" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDropReady(false);
      }}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        className="map-canvas"
        viewBox={viewBox(viewport)}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: cursor ?? (panning ? "grab" : tool === "select" ? "default" : "crosshair") }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={(event) => {
          event.stopPropagation();
          handleDrop(event);
        }}
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
            <circle key={index} className="vertex-handle" cx={hx} cy={hy} r={handleR} fill="#fff" stroke="#9a2f2a" strokeWidth={handleR / 4} />
          ))}
        {tool === "select" && symbolHandle && selected?.featureType === "symbol" ? (
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

function visibleFeatures(map: MapDocument, audience: Audience | "all"): MapFeature[] {
  return allGroundAndOverlayFeatures(map).filter((feature) => {
    if (map.base.kind === "vector" && map.base.features.some((item) => item.id === feature.id)) return true;
    const layer = map.layers.find((item) => item.features.some((itemFeature) => itemFeature.id === feature.id));
    return !layer || audience === "all" || layer.visibleIn.includes(audience);
  });
}
