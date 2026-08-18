import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { readFileAsDataUrl } from "../../io/files";
import { addPointOnLongestEdge, editableVertices, geometryCentroid, insertVertex, rotateGeometry, scaleGeometry, setVertex } from "../../map/geometry";
import {
  addBaseTerrain,
  allGroundAndOverlayFeatures,
  deleteFeature,
  ensureLayer,
  ensureVectorBase,
  mapImageRef,
  moveFeature,
  patchFeature,
} from "../../map/mapBase";
import {
  applyPlaceAdjust,
  defaultPointsAt,
  placeHint,
  placeRecipe,
  placeSteps,
  pointSpec,
} from "../../map/milstd";
import { withSyncedSidc } from "../../map/sidc";
import { createSymbolFromStamp, layerRoleForAffiliation, type UnitStamp } from "../../map/stamp";
import {
  clientToMapFromSvg,
  defaultViewport,
  fitViewport,
  viewportCenter,
  zoomViewport,
  type Viewport,
} from "../../map/viewport";
import { newId } from "../../schema/ids";
import type {
  Audience,
  ControlMeasure,
  ControlMeasureKind,
  Echelon,
  GeoGeometry,
  MapDocument,
  MapFeature,
  MilSymbol,
  Point,
  Scenario,
  TerrainFeature,
  TerrainFeatureKind,
} from "../../schema/types";
import { loadBearingFeatureIds } from "../../validator/validate";
import { Field, NumberInput, Select, TextInput } from "../fields";
import { GraphicPalette } from "./GraphicPalette";
import { Inspector } from "./Inspector";
import { MapCanvas, type MapTool } from "./MapCanvas";
import { geometryFromDraft, usedLegend } from "./MapView";
import { UnitTray } from "./UnitTray";

/** Leaflet only loads when the author opens the real-ground picker. */
const RealMapPicker = lazy(() => import("./RealMapPicker"));

type DrawKind = "point" | "line" | "polygon";

interface DrawToolDef {
  id: string;
  label: string;
  draw: DrawKind;
  terrain?: TerrainFeatureKind;
  hint?: string;
  /** Features whose shape says everything start unlabeled. */
  defaultLabel?: string;
}

const GROUND_TOOLS: DrawToolDef[] = [
  { id: "mountain", label: "Hill", draw: "polygon", terrain: "mountain", hint: "Click the hill outline; label it with the height (e.g. 293). Enter finishes." },
  { id: "contour", label: "Contour", draw: "line", terrain: "contour", hint: "A single dashed contour line." },
  { id: "woods", label: "Woods", draw: "polygon", terrain: "woods", hint: "Stippled vegetation. Clicks become a smooth blob." },
  { id: "water", label: "Lake", draw: "polygon", terrain: "water" },
  { id: "wetland", label: "Swamp", draw: "polygon", terrain: "wetland" },
  { id: "built_up", label: "Town", draw: "polygon", terrain: "built_up" },
  { id: "building", label: "Building", draw: "point", terrain: "building", hint: "One structure — a filled square." },
  { id: "river", label: "River", draw: "line", terrain: "river" },
  { id: "stream", label: "Stream", draw: "line", terrain: "stream" },
  { id: "road", label: "Road", draw: "line", terrain: "road", hint: "Bold black road. Use Path for the small one." },
  { id: "trail", label: "Path", draw: "line", terrain: "trail", hint: "Dotted small road or trail." },
  { id: "bridge", label: "Bridge", draw: "line", terrain: "bridge", hint: "Two clicks across the water — drawn with abutment flares." },
];

type PlacePayload = { type: "unit" } | { type: "graphic"; kind: ControlMeasureKind };

function replaceMap(scenario: Scenario, map: MapDocument): Scenario {
  return { ...scenario, maps: scenario.maps.map((item) => (item.id === map.id ? map : item)) };
}

function addOverlayFeature(map: MapDocument, layerRole: MapDocument["layers"][number]["role"], feature: MapFeature): MapDocument {
  const layer = map.layers.find((item) => item.role === layerRole) ?? map.layers[0];
  if (!layer) return map;
  return {
    ...map,
    layers: map.layers.map((item) => (item.id === layer.id ? { ...item, features: [...item.features, feature] } : item)),
  };
}

/** Live cursor position without re-rendering the whole studio at pointer rate. */
function CoordReadout({ register }: { register: (fn: (pt: [number, number] | null) => void) => void }) {
  const [pt, setPt] = useState<[number, number] | null>(null);
  useEffect(() => {
    register(setPt);
  }, [register]);
  return <span className="studio-coords">{pt ? `${Math.round(pt[0])} · ${Math.round(pt[1])}` : "— · —"}</span>;
}

export function MapEditor({
  scenario,
  assets,
  onChange,
  onAsset,
}: {
  scenario: Scenario;
  assets?: Record<string, string>;
  onChange: (scenario: Scenario) => void;
  onAsset: (ref: string, dataUrl: string) => void;
}) {
  const map = scenario.maps[0];
  const [tool, setTool] = useState<MapTool>("select");
  const [drawId, setDrawId] = useState<string | null>(null);
  const stampEchelon: Echelon = scenario.meta.echelon === "custom" ? "platoon" : scenario.meta.echelon;
  const [unitDraft, setUnitDraft] = useState<UnitStamp>({
    functionId: "UCI",
    echelon: stampEchelon,
    affiliation: "friendly",
  });
  const [placing, setPlacing] = useState(false);
  const [ghost, setGhost] = useState<MapFeature | null>(null);
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [greyscale, setGreyscale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [viewport, setViewport] = useState<Viewport>(defaultViewport);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [showRealMap, setShowRealMap] = useState(false);
  const [openDock, setOpenDock] = useState<"ground" | "units" | "graphics" | "sheet" | null>("graphics");
  const [armed, setArmed] = useState<PlacePayload | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; kind: ControlMeasureKind; step: number } | null>(null);
  const [past, setPast] = useState<MapDocument[]>([]);
  const [future, setFuture] = useState<MapDocument[]>([]);
  const strokeRef = useRef<MapDocument | null>(null);
  const mapRef = useRef(map);
  mapRef.current = map;
  const svgRef = useRef<SVGSVGElement>(null);
  const unitDraftRef = useRef(unitDraft);
  unitDraftRef.current = unitDraft;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const audienceRef = useRef(audience);
  audienceRef.current = audience;
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const placeSessionRef = useRef<{ cancelled: boolean } | null>(null);
  const coordListenerRef = useRef<((pt: [number, number] | null) => void) | null>(null);
  const registerCoord = useCallback((fn: (pt: [number, number] | null) => void) => {
    coordListenerRef.current = fn;
  }, []);

  const drawTool = GROUND_TOOLS.find((item) => item.id === drawId);

  useEffect(() => {
    if (!map) return;
    const next = ensureVectorBase(map);
    if (next !== map) onChange(replaceMap(scenario, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id, map?.base.kind]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancelPlace();
        setAdjust(null);
        setDraft([]);
        setTool("select");
        setDrawId(null);
        return;
      }
      if (event.key === "Enter" && draft.length > 0) {
        event.preventDefault();
        finishDraft();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "v" && notTyping(event)) setTool("select");
      if (event.key === "h" && notTyping(event)) setTool("pan");
      if (event.key === "0" && notTyping(event)) setViewport(fitViewport());
      if ((event.key === "+" || event.key === "=") && notTyping(event)) {
        setViewport((vp) => zoomViewport(vp, 1.25, viewportCenter(vp)));
      }
      if ((event.key === "-" || event.key === "_") && notTyping(event)) {
        setViewport((vp) => zoomViewport(vp, 0.8, viewportCenter(vp)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map, draft, past, future]);

  useEffect(() => {
    if (!placing) {
      setGhost(null);
      return;
    }
    function onMove(ev: PointerEvent) {
      const payload = armedRef.current;
      if (!payload) return;
      if (!clientOnSheet(ev)) {
        setGhost(null);
        return;
      }
      const point = mapPointFromClient(ev);
      if (!point) {
        setGhost(null);
        return;
      }
      setGhost(ghostAt(payload, snapPoint(point)));
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing]);

  const selected = map ? allGroundAndOverlayFeatures(map).find((feature) => feature.id === selectedId) : undefined;
  const imageRef = map ? mapImageRef(map) ?? "" : "";
  const imageUrl = imageRef ? assets?.[imageRef] : undefined;
  const loadBearingIds = loadBearingFeatureIds(scenario);

  if (!map) return <p>No map on this scenario.</p>;

  function commit(next: MapDocument) {
    setPast((items) => [...items.slice(-79), map]);
    setFuture([]);
    onChange(replaceMap(scenario, next));
  }

  function undo() {
    const prev = past.at(-1);
    if (!prev || !map) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [map, ...items]);
    onChange(replaceMap(scenario, prev));
  }

  function redo() {
    const next = future[0];
    if (!next || !map) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, map]);
    onChange(replaceMap(scenario, next));
  }

  function deleteSelected() {
    if (!selectedId || !map) return;
    commit(deleteFeature(map, selectedId));
    setSelectedId(null);
  }

  function placeSymbol(point: [number, number], stamp: UnitStamp) {
    const current = mapRef.current;
    if (!current) return;
    const feature = createSymbolFromStamp(stamp, point);
    const role = layerRoleForAffiliation(feature.affiliation, audienceRef.current);
    commit(addOverlayFeature(ensureLayer(current, role), role, feature));
    setSelectedId(feature.id);
    setTool("select");
    setDrawId(null);
  }

  function snapPoint(point: [number, number]): [number, number] {
    if (!snapRef.current) return point;
    const step = 25;
    return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
  }

  function clientOnSheet(client: { clientX: number; clientY: number }): boolean {
    const svg = svgRef.current;
    if (!svg) return false;
    const rect = svg.getBoundingClientRect();
    return (
      client.clientX >= rect.left &&
      client.clientX <= rect.right &&
      client.clientY >= rect.top &&
      client.clientY <= rect.bottom
    );
  }

  function mapPointFromClient(client: { clientX: number; clientY: number }): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    return clientToMapFromSvg(svg, client, viewportRef.current);
  }

  function graphicGeometryAt(kind: ControlMeasureKind, point: [number, number]): GeoGeometry {
    const points = defaultPointsAt(kind, point);
    if (points.length === 1) return { type: "Point", coordinates: points[0]! };
    return { type: "LineString", coordinates: points };
  }

  function ghostAt(payload: PlacePayload, point: [number, number]): MapFeature {
    if (payload.type === "unit") {
      return { ...createSymbolFromStamp(unitDraftRef.current, point), id: "ghost" };
    }
    const ghostFeature: ControlMeasure = {
      featureType: "control_measure",
      id: "ghost",
      kind: payload.kind,
      geometry: graphicGeometryAt(payload.kind, point),
      label: "",
      affiliation: "friendly",
    };
    return ghostFeature;
  }

  function placeGraphic(kind: ControlMeasureKind, point: [number, number]) {
    const current = mapRef.current;
    if (!current) return;
    const feature: ControlMeasure = {
      featureType: "control_measure",
      id: newId(),
      kind,
      geometry: graphicGeometryAt(kind, point),
      label: "",
      affiliation: "friendly",
    };
    commit(addOverlayFeature(ensureLayer(current, "control_measures"), "control_measures", feature));
    setSelectedId(feature.id);
    setTool("select");
    setDrawId(null);
    const recipe = placeRecipe(kind);
    if (placeSteps(recipe) > 0) setAdjust({ id: feature.id, kind, step: 0 });
    else setAdjust(null);
  }

  function finishPlace(payload: PlacePayload, point: [number, number]) {
    setPlacing(false);
    setArmed(null);
    setGhost(null);
    if (payload.type === "unit") placeSymbol(point, unitDraftRef.current);
    else placeGraphic(payload.kind, point);
  }

  function applyAdjust(point: [number, number]) {
    if (!adjust) return;
    const current = mapRef.current;
    if (!current) return;
    const feature = allGroundAndOverlayFeatures(current).find((item) => item.id === adjust.id);
    if (!feature || feature.featureType !== "control_measure") {
      setAdjust(null);
      return;
    }
    const geometry = applyPlaceAdjust(adjust.kind, feature.geometry, point, adjust.step);
    commit(patchFeature(current, adjust.id, { geometry }));
    const nextStep = adjust.step + 1;
    if (nextStep >= placeSteps(placeRecipe(adjust.kind))) setAdjust(null);
    else setAdjust({ ...adjust, step: nextStep });
  }

  function cancelPlace() {
    if (placeSessionRef.current) placeSessionRef.current.cancelled = true;
    placeSessionRef.current = null;
    setPlacing(false);
    setArmed(null);
    setGhost(null);
  }

  /**
   * Drag from a palette card places where the pointer releases.
   * A click on the card arms the next sheet click — the graphic is already visible as a ghost.
   */
  function beginPlace(payload: PlacePayload, event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setAdjust(null);
    setArmed(payload);
    setPlacing(true);
    setTool("select");
    setDrawId(null);
    setSelectedId(null);
    const session = { cancelled: false };
    placeSessionRef.current = session;

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (session.cancelled || placeSessionRef.current !== session) return;
      placeSessionRef.current = null;
      if (!clientOnSheet(ev)) return;
      const point = mapPointFromClient(ev);
      if (!point) return;
      finishPlace(payload, snapPoint(point));
    }

    function onCancel() {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (placeSessionRef.current === session) cancelPlace();
    }

    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function commitPoint(point: [number, number]) {
    if (tool !== "draw" || !drawTool) return;
    if (drawTool.draw === "point") {
      finishGeometry("point", [point]);
      return;
    }
    setDraft((items) => [...items, point]);
  }

  function finishGeometry(kind: DrawKind, points: [number, number][]) {
    if (!map || !drawTool) return;
    const geometry = geometryFromDraft(kind, points);
    if (!geometry) return;
    const featureLabel = label || drawTool.defaultLabel || "";
    if (drawTool.terrain) {
      const feature: TerrainFeature = {
        featureType: "terrain",
        id: newId(),
        kind: drawTool.terrain,
        geometry,
        label: featureLabel || undefined,
      };
      commit(addBaseTerrain(map, feature));
    }
    setDraft([]);
  }

  function finishDraft() {
    if (!drawTool || drawTool.draw === "point") return;
    finishGeometry(drawTool.draw, draft);
  }

  function patchSelected(patch: object) {
    if (!selected || !map) return;
    if (selected.featureType === "symbol") {
      const extra = patch as Partial<MilSymbol> & { functionId?: string };
      const next = withSyncedSidc({ ...selected, ...extra }, extra.functionId);
      commit(patchFeature(map, selected.id, next));
      return;
    }
    commit(patchFeature(map, selected.id, patch));
  }

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file || !map) return;
    const promoted = ensureVectorBase(map);
    const ref = promoted.underlay?.imageRef ?? `img_${newId()}`;
    onAsset(ref, await readFileAsDataUrl(file));
    commit({
      ...promoted,
      underlay: { imageRef: ref, opacity: promoted.underlay?.opacity ?? 1 },
    });
  }

  function applyRealGround(dataUrl: string, meters: number) {
    if (!map) return;
    const promoted = ensureVectorBase(map);
    const ref = promoted.underlay?.imageRef ?? `img_${newId()}`;
    onAsset(ref, dataUrl);
    commit({
      ...promoted,
      underlay: { imageRef: ref, opacity: 1 },
      scaleBar: { ...promoted.scaleBar, meters },
    });
    setShowRealMap(false);
  }

  function chooseDraw(item: DrawToolDef) {
    setDrawId(item.id);
    setTool("draw");
    setDraft([]);
    setSelectedId(null);
  }

  function toolButton(item: DrawToolDef) {
    return (
      <button
        key={item.id}
        type="button"
        className={`tool-btn ${drawId === item.id ? "is-active" : ""}`}
        title={item.hint ?? item.label}
        onClick={() => chooseDraw(item)}
      >
        {item.label}
      </button>
    );
  }

  const modeHint = placing
    ? "Place — drop on the sheet. Esc cancels."
    : adjust
      ? placeHint(adjust.kind, adjust.step)
      : tool === "select"
        ? "Select — drag from the rail onto the sheet. Click a graphic to place it, then click to size it. White dots reshape; square scales; circle rotates."
        : tool === "pan"
          ? "Pan — drag the sheet. Wheel zooms. 0 fits."
          : drawTool?.draw === "point"
            ? `${drawTool.label} — click the map. ${drawTool.hint ?? ""}`
            : `${drawTool?.label ?? "Draw"} — click points, Enter or double-click finishes, Esc cancels. ${drawTool?.hint ?? ""}`;

  return (
    <div className="map-studio">
      <div className="studio-toolbar">
        <div className="studio-toolbar-group">
          <button type="button" className={`tool-btn ${tool === "select" && !drawId ? "is-active" : ""}`} title="Select (V)" onClick={() => { setTool("select"); setDrawId(null); }}>
            Select
          </button>
          <button type="button" className={`tool-btn ${tool === "pan" ? "is-active" : ""}`} title="Pan (H or Space)" onClick={() => { setTool("pan"); setDrawId(null); }}>
            Pan
          </button>
        </div>
        <div className="studio-toolbar-group">
          <button type="button" className="tool-btn" disabled={past.length === 0} onClick={undo} title="Undo (⌘Z)">
            Undo
          </button>
          <button type="button" className="tool-btn" disabled={future.length === 0} onClick={redo} title="Redo (⇧⌘Z)">
            Redo
          </button>
        </div>
        <div className="studio-toolbar-group">
          <button type="button" className="tool-btn" onClick={() => setViewport((vp) => zoomViewport(vp, 0.8, viewportCenter(vp)))} title="Zoom out (-)">
            −
          </button>
          <span className="studio-zoom">{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" className="tool-btn" onClick={() => setViewport((vp) => zoomViewport(vp, 1.25, viewportCenter(vp)))} title="Zoom in (+)">
            +
          </button>
          <button type="button" className="tool-btn" onClick={() => setViewport(fitViewport())} title="Fit the sheet (0)">
            Fit
          </button>
        </div>
        <div className="studio-toolbar-group">
          <button type="button" className={`tool-btn ${showGrid ? "is-on" : ""}`} onClick={() => setShowGrid((v) => !v)} title="Grid">
            Grid
          </button>
          <button type="button" className={`tool-btn ${snap ? "is-on" : ""}`} onClick={() => setSnap((v) => !v)} title="Snap to grid">
            Snap
          </button>
          <button type="button" className={`tool-btn ${greyscale ? "is-on" : ""}`} onClick={() => setGreyscale((v) => !v)} title="Print preview in greyscale">
            Grey
          </button>
        </div>
        <div className="studio-toolbar-group">
          <Select
            value={audience}
            options={[
              { value: "all", label: "All layers" },
              { value: "student", label: "Student view" },
              { value: "facilitator", label: "Facilitator view" },
            ]}
            onChange={setAudience}
          />
        </div>
        <div className="studio-toolbar-group studio-upload">
          <button type="button" className="tool-btn" title="Use a real map extent as the sheet's base" onClick={() => setShowRealMap(true)}>
            Real ground
          </button>
          <label className="tool-btn" title="Trace over a sketch or photo">
            Tracing image
            <input type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files)} />
          </label>
        </div>
      </div>

      <div className="studio-body">
        <aside className="studio-dock">
          <details
            className="dock-group"
            open={openDock === "ground"}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenDock("ground");
              else if (openDock === "ground") setOpenDock(null);
            }}
          >
            <summary>Ground</summary>
            <div className="tool-grid">{GROUND_TOOLS.map(toolButton)}</div>
          </details>

          <details
            className="dock-group"
            open={openDock === "units"}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenDock("units");
              else if (openDock === "units") setOpenDock(null);
            }}
          >
            <summary>Units</summary>
            <UnitTray
              stamp={unitDraft}
              query={symbolQuery}
              placing={placing}
              onStamp={setUnitDraft}
              onQuery={setSymbolQuery}
              onPlacePointerDown={(e) => beginPlace({ type: "unit" }, e)}
            />
          </details>

          <details
            className="dock-group"
            open={openDock === "graphics"}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenDock("graphics");
              else if (openDock === "graphics") setOpenDock(null);
            }}
          >
            <summary>Tactical graphics</summary>
            <p className="hint unit-tray-lead">
              Drag onto the sheet, or click and then click the sheet. The graphic appears immediately; the next click
              sizes it.
            </p>
            <GraphicPalette
              activeKind={armed?.type === "graphic" ? armed.kind : (adjust?.kind ?? null)}
              onCardPointerDown={(def, e) => beginPlace({ type: "graphic", kind: def.kind }, e)}
            />
          </details>

          {tool === "draw" ? (
            <Field label="Label">
              <TextInput value={label} onChange={setLabel} placeholder="OBJ WEST / PL RED / Hill 214" />
            </Field>
          ) : null}

          <details
            className="dock-group"
            open={openDock === "sheet"}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenDock("sheet");
              else if (openDock === "sheet") setOpenDock(null);
            }}
          >
            <summary>Sheet</summary>
            <Field label="Scale (m)">
              <NumberInput min={1} value={map.scaleBar.meters} onChange={(meters) => commit({ ...map, scaleBar: { ...map.scaleBar, meters } })} />
            </Field>
            <Field label="North rotation">
              <NumberInput value={map.northArrow.rotationDeg} onChange={(rotationDeg) => commit({ ...map, northArrow: { rotationDeg } })} />
            </Field>
            <Field label="Tracing opacity">
              <NumberInput
                min={0}
                max={1}
                step={0.05}
                value={map.underlay?.opacity ?? 1}
                onChange={(opacity) => commit({ ...map, underlay: map.underlay ? { ...map.underlay, opacity } : undefined })}
              />
            </Field>
          </details>
        </aside>

        <div className="studio-stage">
          <MapCanvas
            map={map}
            imageUrl={imageUrl}
            audience={audience}
            greyscale={greyscale}
            loadBearingIds={loadBearingIds}
            selectedId={selectedId}
            viewport={viewport}
            tool={tool}
            snap={snap}
            showGrid={showGrid}
            draftPoints={draft}
            svgRef={svgRef}
            ghost={ghost}
            placing={placing}
            adjusting={Boolean(adjust)}
            onViewport={setViewport}
            onSelect={(id) => {
              setSelectedId(id);
              if (id !== adjust?.id) setAdjust(null);
            }}
            onClickPoint={(point) => commitPoint([point.coordinates[0], point.coordinates[1]])}
            onFinishDraft={finishDraft}
            onHoverPoint={(pt) => coordListenerRef.current?.(pt)}
            onPlaceAt={(point) => {
              const payload = armedRef.current;
              if (!payload) return;
              finishPlace(payload, point);
            }}
            onAdjustPoint={applyAdjust}
            onInsertVertex={(id, afterIndex, point) => {
              const current = mapRef.current;
              if (!current) return;
              const feature = allGroundAndOverlayFeatures(current).find((item) => item.id === id);
              if (!feature || !("geometry" in feature) || feature.geometry.type === "Point") return;
              if (feature.featureType === "control_measure") {
                const spec = pointSpec(feature.kind);
                if (spec && editableVertices(feature.geometry).length >= spec.max) return;
              }
              commit(patchFeature(current, id, { geometry: insertVertex(feature.geometry, afterIndex, point) }));
            }}
            onMove={(id, dx, dy) => {
              const current = mapRef.current;
              if (!current) return;
              onChange(replaceMap(scenario, moveFeature(current, id, dx, dy)));
            }}
            onMoveVertex={(id, index, point: Point) => {
              const current = mapRef.current;
              if (!current) return;
              const feature = allGroundAndOverlayFeatures(current).find((item) => item.id === id);
              if (!feature || !("geometry" in feature)) return;
              onChange(replaceMap(scenario, patchFeature(current, id, { geometry: setVertex(feature.geometry, index, point.coordinates) })));
            }}
            onRotate={(id, rotationDeg) => {
              const current = mapRef.current;
              if (!current) return;
              onChange(replaceMap(scenario, patchFeature(current, id, { rotationDeg })));
            }}
            onRotateDelta={(id, deltaDeg) => {
              const current = mapRef.current;
              if (!current) return;
              const feature = allGroundAndOverlayFeatures(current).find((item) => item.id === id);
              if (!feature || !("geometry" in feature)) return;
              onChange(
                replaceMap(
                  scenario,
                  patchFeature(current, id, { geometry: rotateGeometry(feature.geometry, deltaDeg, geometryCentroid(feature.geometry)) }),
                ),
              );
            }}
            onScale={(id, factor, center) => {
              const current = mapRef.current;
              if (!current) return;
              const feature = allGroundAndOverlayFeatures(current).find((item) => item.id === id);
              if (!feature || !("geometry" in feature)) return;
              onChange(replaceMap(scenario, patchFeature(current, id, { geometry: scaleGeometry(feature.geometry, factor, center) })));
            }}
            onStrokeStart={() => {
              strokeRef.current = mapRef.current ?? null;
            }}
            onStrokeEnd={() => {
              if (strokeRef.current) {
                setPast((items) => [...items.slice(-79), strokeRef.current!]);
                setFuture([]);
                strokeRef.current = null;
              }
            }}
          />
          <div className="studio-status">
            <span className="studio-mode">{modeHint}</span>
            {draft.length > 0 ? (
              <span className="studio-draft-actions">
                <button type="button" className="tool-btn is-active" onClick={finishDraft}>
                  Finish ({draft.length})
                </button>
                <button type="button" className="tool-btn" onClick={() => setDraft([])}>
                  Cancel
                </button>
              </span>
            ) : null}
            <span className="studio-status-right">
              <CoordReadout register={registerCoord} />
            </span>
          </div>
          {map.legend.autoGenerate ? (
            <div className="legend studio-legend">
              {usedLegend(map, audience).map((entry) => (
                <div className="legend-item" key={entry.id}>
                  <span style={{ width: 12, height: 12, background: entry.color, display: "inline-block", border: "1px solid #1b2118" }} />
                  {entry.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Inspector
          feature={selected}
          onPatch={(patch) => patchSelected(patch)}
          onDelete={deleteSelected}
          onRotateBy={(deg) => {
            if (!selected || !("geometry" in selected) || !map) return;
            commit(patchFeature(map, selected.id, { geometry: rotateGeometry(selected.geometry, deg, geometryCentroid(selected.geometry)) }));
          }}
          onAddPoint={() => {
            if (!selected || !("geometry" in selected) || !map) return;
            if (selected.geometry.type === "Point") return;
            if (selected.featureType === "control_measure") {
              const spec = pointSpec(selected.kind);
              if (spec && editableVertices(selected.geometry).length >= spec.max) return;
            }
            commit(patchFeature(map, selected.id, { geometry: addPointOnLongestEdge(selected.geometry) }));
          }}
        />
      </div>

      {showRealMap ? (
        <Suspense fallback={null}>
          <RealMapPicker onUse={applyRealGround} onClose={() => setShowRealMap(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}

function notTyping(event: KeyboardEvent): boolean {
  return !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement);
}
