import { useEffect, useMemo, useRef, useState } from "react";
import { readFileAsDataUrl } from "../../io/files";
import { setVertex } from "../../map/geometry";
import {
  addBaseTerrain,
  allGroundAndOverlayFeatures,
  deleteFeature,
  ensureVectorBase,
  mapImageRef,
  moveFeature,
  patchFeature,
} from "../../map/mapBase";
import { buildSidc, ECHELON_MARKER, frameForAffiliation, UNIT_GROUPS, withSyncedSidc } from "../../map/sidc";
import { defaultViewport, fitViewport, type Viewport } from "../../map/viewport";
import { newId } from "../../schema/ids";
import type {
  Affiliation,
  Audience,
  ControlMeasureKind,
  Echelon,
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
import { Inspector } from "./Inspector";
import { MapCanvas, type MapTool } from "./MapCanvas";
import { geometryFromDraft, usedLegend } from "./MapView";
import { SymbolChip } from "./MilSymbolMark";

type DrawKind = "point" | "line" | "polygon";

type DrawTool =
  | { id: "woods"; label: "Woods"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "water"; label: "Water"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "wetland"; label: "Swamp"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "road"; label: "Road"; terrain: TerrainFeatureKind; draw: "line" }
  | { id: "objective"; label: "OBJ"; control: ControlMeasureKind; draw: "point" }
  | { id: "phase_line"; label: "PL"; control: ControlMeasureKind; draw: "line" }
  | { id: "axis"; label: "Axis"; control: ControlMeasureKind; draw: "line" }
  | { id: "boundary"; label: "Bdy"; control: ControlMeasureKind; draw: "line" }
  | { id: "trp"; label: "TRP"; control: ControlMeasureKind; draw: "point" };

const GROUND_TOOLS: DrawTool[] = [
  { id: "woods", label: "Woods", terrain: "woods", draw: "polygon" },
  { id: "water", label: "Water", terrain: "water", draw: "polygon" },
  { id: "wetland", label: "Swamp", terrain: "wetland", draw: "polygon" },
  { id: "road", label: "Road", terrain: "road", draw: "line" },
];

const GRAPHIC_TOOLS: DrawTool[] = [
  { id: "objective", label: "OBJ", control: "objective", draw: "point" },
  { id: "phase_line", label: "PL", control: "phase_line", draw: "line" },
  { id: "axis", label: "Axis", control: "axis_of_advance", draw: "line" },
  { id: "boundary", label: "Bdy", control: "boundary", draw: "line" },
  { id: "trp", label: "TRP", control: "trp", draw: "point" },
];

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
  const [drawId, setDrawId] = useState<DrawTool["id"] | null>(null);
  const [functionId, setFunctionId] = useState("UCI");
  const [affiliation, setAffiliation] = useState<Affiliation>("friendly");
  const stampEchelon: Echelon = scenario.meta.echelon === "custom" ? "platoon" : scenario.meta.echelon;
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [greyscale, setGreyscale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [viewport, setViewport] = useState<Viewport>(defaultViewport);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [past, setPast] = useState<MapDocument[]>([]);
  const [future, setFuture] = useState<MapDocument[]>([]);
  const strokeRef = useRef<MapDocument | null>(null);
  const mapRef = useRef(map);
  mapRef.current = map;

  const drawTool = [...GROUND_TOOLS, ...GRAPHIC_TOOLS].find((item) => item.id === drawId);

  useEffect(() => {
    if (!map) return;
    const next = ensureVectorBase(map);
    if (next !== map) onChange(replaceMap(scenario, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id, map?.base.kind]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
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
      if (event.key === "+" && notTyping(event)) setViewport((vp) => ({ ...vp, zoom: Math.min(8, vp.zoom * 1.2) }));
      if (event.key === "-" && notTyping(event)) setViewport((vp) => ({ ...vp, zoom: Math.max(0.4, vp.zoom / 1.2) }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map, draft, past, future]);

  const selected = map ? allGroundAndOverlayFeatures(map).find((feature) => feature.id === selectedId) : undefined;
  const imageRef = map ? mapImageRef(map) ?? "" : "";
  const imageUrl = imageRef ? assets?.[imageRef] : undefined;
  const loadBearingIds = loadBearingFeatureIds(scenario);
  const stampConfidence = affiliation === "hostile" ? "suspected" : "confirmed";
  const stampSidc = buildSidc({
    affiliation,
    confidence: stampConfidence,
    echelon: stampEchelon,
    functionId,
  });

  const filteredGroups = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) return UNIT_GROUPS;
    return UNIT_GROUPS.map((group) => ({
      ...group,
      units: group.units.filter((unit) => unit.label.toLowerCase().includes(q)),
    })).filter((group) => group.units.length > 0);
  }, [symbolQuery]);

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

  function placeSymbol(point: [number, number]) {
    if (!map) return;
    const feature = withSyncedSidc({
      featureType: "symbol",
      id: newId(),
      sidc: stampSidc,
      affiliation,
      frame: frameForAffiliation(affiliation),
      confidence: stampConfidence,
      position: { type: "Point", coordinates: point },
      echelon: stampEchelon,
      echelonMarker: ECHELON_MARKER[stampEchelon] || undefined,
      sizePx: 42,
    });
    const role = affiliation === "hostile" ? (audience === "facilitator" ? "enemy_truth" : "enemy_known") : "friendly";
    commit(addOverlayFeature(map, role, feature));
  }

  function commitPoint(point: [number, number]) {
    if (tool === "stamp") {
      placeSymbol(point);
      return;
    }
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
    if ("terrain" in drawTool) {
      const feature: TerrainFeature = {
        featureType: "terrain",
        id: newId(),
        kind: drawTool.terrain,
        geometry,
        label: label || drawTool.label,
      };
      commit(addBaseTerrain(map, feature));
    } else {
      const feature: MapFeature = {
        featureType: "control_measure",
        id: newId(),
        kind: drawTool.control,
        geometry,
        label: label || drawTool.label,
      };
      commit(addOverlayFeature(map, "control_measures", feature));
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
      const next = withSyncedSidc({ ...selected, ...patch } as MilSymbol);
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

  function chooseDraw(item: DrawTool) {
    setDrawId(item.id);
    setTool("draw");
    setDraft([]);
    setSelectedId(null);
  }

  const canvasTool: MapTool = tool;

  return (
    <div className="map-workspace map-workspace-v2">
      <aside className="map-rail">
        <div className="map-toolbar">
          <button type="button" className={`btn ${tool === "select" && !drawId ? "btn-primary" : ""}`} onClick={() => { setTool("select"); setDrawId(null); }}>
            Select
          </button>
          <button type="button" className={`btn ${tool === "pan" ? "btn-primary" : ""}`} onClick={() => { setTool("pan"); setDrawId(null); }}>
            Pan
          </button>
          <button type="button" className="btn" disabled={past.length === 0} onClick={undo}>
            Undo
          </button>
          <button type="button" className="btn" disabled={future.length === 0} onClick={redo}>
            Redo
          </button>
        </div>

        <label className="btn btn-primary" style={{ width: "100%", textAlign: "center" }}>
          Tracing image
          <input type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files)} />
        </label>

        <div className="section-kicker">Ground</div>
        <div className="map-toolbar">
          {GROUND_TOOLS.map((item) => (
            <button key={item.id} type="button" className={`btn ${drawId === item.id ? "btn-primary" : ""}`} onClick={() => chooseDraw(item)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="section-kicker">Control measures</div>
        <div className="map-toolbar">
          {GRAPHIC_TOOLS.map((item) => (
            <button key={item.id} type="button" className={`btn ${drawId === item.id ? "btn-primary" : ""}`} onClick={() => chooseDraw(item)}>
              {item.label}
            </button>
          ))}
        </div>
        {tool === "draw" ? (
          <Field label="Label">
            <TextInput value={label} onChange={setLabel} placeholder="OBJ WEST / PL RED" />
          </Field>
        ) : null}
        {draft.length > 0 ? (
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={finishDraft}>
              Finish ({draft.length})
            </button>
            <button type="button" className="btn" onClick={() => setDraft([])}>
              Cancel
            </button>
          </div>
        ) : null}

        <div className="section-kicker">Stamp unit</div>
        <Field label="Whose">
          <Select
            value={affiliation}
            options={[
              { value: "friendly", label: "Friendly" },
              { value: "hostile", label: "Hostile" },
              { value: "neutral", label: "Neutral" },
              { value: "unknown", label: "Unknown" },
            ]}
            onChange={setAffiliation}
          />
        </Field>
        <Field label="Search">
          <TextInput value={symbolQuery} onChange={setSymbolQuery} placeholder="infantry" />
        </Field>
        {filteredGroups.map((group) => (
          <div key={group.id}>
            <div className="section-kicker">{group.label}</div>
            <div className="symbol-palette">
              {group.units.map((unit) => {
                const sidc = buildSidc({
                  affiliation,
                  confidence: stampConfidence,
                  echelon: stampEchelon,
                  functionId: unit.functionId,
                });
                return (
                  <SymbolChip
                    key={unit.id}
                    sidc={sidc}
                    label={unit.label}
                    selected={tool === "stamp" && functionId === unit.functionId}
                    onClick={() => {
                      setFunctionId(unit.functionId);
                      setTool("stamp");
                      setDrawId(null);
                      setDraft([]);
                      setSelectedId(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <details>
          <summary>Map settings</summary>
          <Field label="View">
            <Select
              value={audience}
              options={[
                { value: "all", label: "All layers" },
                { value: "student", label: "Student" },
                { value: "facilitator", label: "Facilitator" },
              ]}
              onChange={setAudience}
            />
          </Field>
          <label className="row">
            <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
            Grid
          </label>
          <label className="row">
            <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
            Snap
          </label>
          <label className="row">
            <input type="checkbox" checked={greyscale} onChange={(event) => setGreyscale(event.target.checked)} />
            Greyscale
          </label>
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
              value={map.underlay?.opacity ?? 1}
              onChange={(opacity) => commit({ ...map, underlay: map.underlay ? { ...map.underlay, opacity } : undefined })}
            />
          </Field>
        </details>
      </aside>

      <div className="map-stage-col">
        <p className="map-mode">
          {tool === "select"
            ? "Select — drag to move, corners to reshape, handle above a unit to rotate. Space pans. Wheel zooms."
            : tool === "pan"
              ? "Pan — drag the sheet. Wheel zooms. 0 fits."
              : tool === "stamp"
                ? `Stamp ${UNIT_GROUPS.flatMap((group) => group.units).find((unit) => unit.functionId === functionId)?.label ?? "unit"} — click to place. Esc returns to select.`
                : drawTool?.draw === "point"
                  ? `Place ${drawTool.label} — click the map.`
                  : `Draw ${drawTool?.label ?? "shape"} — click points, Enter or double-click to finish.`}
        </p>
        <MapCanvas
          map={map}
          imageUrl={imageUrl}
          audience={audience}
          greyscale={greyscale}
          loadBearingIds={loadBearingIds}
          selectedId={selectedId}
          viewport={viewport}
          tool={canvasTool}
          snap={snap}
          showGrid={showGrid}
          draftPoints={draft}
          onViewport={setViewport}
          onSelect={setSelectedId}
          onClickPoint={(point) => commitPoint([point.coordinates[0], point.coordinates[1]])}
          onFinishDraft={finishDraft}
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
        <div className="map-hud">
          <span>{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" className="btn" onClick={() => setViewport(fitViewport())}>
            Fit
          </button>
          <span className="hint" style={{ margin: 0 }}>
            Wheel zoom · Space pan · V select · ⌘Z undo
          </span>
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

      <Inspector feature={selected} onPatch={(patch) => patchSelected(patch)} onDelete={deleteSelected} />
    </div>
  );
}

function notTyping(event: KeyboardEvent): boolean {
  return !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement);
}
