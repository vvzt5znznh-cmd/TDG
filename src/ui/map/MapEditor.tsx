import { useEffect, useState } from "react";
import { readFileAsDataUrl } from "../../io/files";
import { setVertex } from "../../map/geometry";
import {
  addBaseTerrain,
  allGroundAndOverlayFeatures,
  deleteFeature,
  ensureVectorBase,
  mapImageRef,
  patchFeature,
} from "../../map/mapBase";
import { buildSidc, ECHELON_MARKER, frameForAffiliation, UNIT_CATALOG } from "../../map/sidc";
import { newId } from "../../schema/ids";
import type {
  Affiliation,
  Audience,
  Confidence,
  ControlMeasureKind,
  Echelon,
  MapDocument,
  MapFeature,
  Point,
  Scenario,
  TerrainFeature,
  TerrainFeatureKind,
} from "../../schema/types";
import { loadBearingFeatureIds } from "../../validator/validate";
import { Field, NumberInput, Select, TextInput } from "../fields";
import { geometryFromDraft, MapView } from "./MapView";
import { SymbolChip } from "./MilSymbolMark";

type DrawTool =
  | { id: "select"; label: "Select" }
  | { id: "objective"; label: "OBJ"; control: ControlMeasureKind; draw: "point" }
  | { id: "phase_line"; label: "PL"; control: ControlMeasureKind; draw: "line" }
  | { id: "axis"; label: "Axis"; control: ControlMeasureKind; draw: "line" }
  | { id: "woods"; label: "Woods"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "water"; label: "Water"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "wetland"; label: "Swamp"; terrain: TerrainFeatureKind; draw: "polygon" }
  | { id: "road"; label: "Road"; terrain: TerrainFeatureKind; draw: "line" };

const DRAW_TOOLS: DrawTool[] = [
  { id: "select", label: "Select" },
  { id: "objective", label: "OBJ", control: "objective", draw: "point" },
  { id: "phase_line", label: "PL", control: "phase_line", draw: "line" },
  { id: "axis", label: "Axis", control: "axis_of_advance", draw: "line" },
  { id: "woods", label: "Woods", terrain: "woods", draw: "polygon" },
  { id: "water", label: "Water", terrain: "water", draw: "polygon" },
  { id: "wetland", label: "Swamp", terrain: "wetland", draw: "polygon" },
  { id: "road", label: "Road", terrain: "road", draw: "line" },
];

function replaceMap(scenario: Scenario, map: MapDocument): Scenario {
  return { ...scenario, maps: scenario.maps.map((item) => (item.id === map.id ? map : item)) };
}

function addFeature(map: MapDocument, layerRole: MapDocument["layers"][number]["role"], feature: MapFeature): MapDocument {
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
  const [drawId, setDrawId] = useState<DrawTool["id"] | "symbol">("select");
  const [functionId, setFunctionId] = useState("UCI");
  const [affiliation, setAffiliation] = useState<Affiliation>("friendly");
  const [confidence, setConfidence] = useState<Confidence>("confirmed");
  const [echelon, setEchelon] = useState<Echelon>(scenario.meta.echelon === "custom" ? "platoon" : scenario.meta.echelon);
  const [designation, setDesignation] = useState("");
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [greyscale, setGreyscale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!map) return;
    const next = ensureVectorBase(map);
    if (next !== map) onChange(replaceMap(scenario, next));
    // Promote once when a raster file is opened; ensureVectorBase returns the same object afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id, map?.base.kind]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDraft([]);
        setDrawId("select");
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) {
        event.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map]);

  if (!map) return <p>No map on this scenario.</p>;

  const imageRef = mapImageRef(map) ?? "";
  const imageUrl = imageRef ? assets?.[imageRef] : undefined;
  const loadBearingIds = loadBearingFeatureIds(scenario);
  const selected = allGroundAndOverlayFeatures(map).find((feature) => feature.id === selectedId);
  const drawTool = DRAW_TOOLS.find((tool) => tool.id === drawId);

  function deleteSelected() {
    if (!selectedId || !map) return;
    onChange(replaceMap(scenario, deleteFeature(map, selectedId)));
    setSelectedId(null);
  }

  function placeSymbol(point: [number, number]) {
    if (!map) return;
    const sidc = buildSidc({ affiliation, confidence, echelon, functionId });
    const feature: MapFeature = {
      featureType: "symbol",
      id: newId(),
      sidc,
      affiliation,
      frame: frameForAffiliation(affiliation),
      confidence,
      position: { type: "Point", coordinates: point },
      designation: designation || undefined,
      echelonMarker: ECHELON_MARKER[echelon] || undefined,
    };
    const role = affiliation === "hostile" ? (audience === "facilitator" ? "enemy_truth" : "enemy_known") : "friendly";
    onChange(replaceMap(scenario, addFeature(map, role, feature)));
  }

  function commitPoint(point: [number, number]) {
    if (drawId === "select") {
      setSelectedId(null);
      return;
    }
    if (drawId === "symbol") {
      placeSymbol(point);
      return;
    }
    if (!drawTool || drawTool.id === "select") return;
    if (drawTool.draw === "point" && "control" in drawTool) {
      const geometry = geometryFromDraft("point", [point]);
      if (!geometry) return;
      const feature: MapFeature = {
        featureType: "control_measure",
        id: newId(),
        kind: drawTool.control,
        geometry,
        label: label || drawTool.label,
      };
      onChange(replaceMap(scenario, addFeature(map, "control_measures", feature)));
      return;
    }
    const next = [...draft, point];
    setDraft(next);
  }

  function finishDraft() {
    if (!map || !drawTool || drawTool.id === "select" || drawTool.draw === "point") return;
    const geometry = geometryFromDraft(drawTool.draw, draft);
    if (!geometry) return;
    if ("terrain" in drawTool) {
      const feature: TerrainFeature = {
        featureType: "terrain",
        id: newId(),
        kind: drawTool.terrain,
        geometry,
        label: label || drawTool.label,
      };
      onChange(replaceMap(scenario, addBaseTerrain(map, feature)));
    } else {
      const feature: MapFeature = {
        featureType: "control_measure",
        id: newId(),
        kind: drawTool.control,
        geometry,
        label: label || drawTool.label,
      };
      onChange(replaceMap(scenario, addFeature(map, "control_measures", feature)));
    }
    setDraft([]);
  }

  function moveVertex(featureId: string, vertexIndex: number, point: Point) {
    if (!map) return;
    const feature = allGroundAndOverlayFeatures(map).find((item) => item.id === featureId);
    if (!feature || !("geometry" in feature)) return;
    const geometry = setVertex(feature.geometry, vertexIndex, point.coordinates);
    onChange(replaceMap(scenario, patchFeature(map, featureId, { geometry })));
  }

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file || !map) return;
    const promoted = ensureVectorBase(map);
    const ref = promoted.underlay?.imageRef ?? `img_${newId()}`;
    onAsset(ref, await readFileAsDataUrl(file));
    onChange(
      replaceMap(scenario, {
        ...promoted,
        underlay: { imageRef: ref, opacity: promoted.underlay?.opacity ?? 1 },
      }),
    );
  }

  return (
    <div className="map-workspace">
      <aside className="map-rail">
        <label className="btn btn-primary" style={{ width: "100%", textAlign: "center" }}>
          Upload tracing image
          <input type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files)} />
        </label>
        <p className="hint">Optional. Sketch photo or scan to trace. Woods, swamp, water, and roads are the map — select them and drag the corners.</p>

        <div className="section-kicker">Unit (APP-6)</div>
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
        <Field label="Echelon">
          <Select
            value={echelon}
            options={[
              { value: "fireteam", label: "Fireteam" },
              { value: "squad", label: "Squad" },
              { value: "platoon", label: "Platoon" },
              { value: "company", label: "Company" },
              { value: "battalion", label: "Battalion" },
              { value: "brigade", label: "Brigade" },
            ]}
            onChange={setEchelon}
          />
        </Field>
        <Field label="Known?">
          <Select
            value={confidence}
            options={[
              { value: "confirmed", label: "Confirmed (solid)" },
              { value: "suspected", label: "Suspected (dashed)" },
              { value: "templated", label: "Templated" },
            ]}
            onChange={setConfidence}
          />
        </Field>
        <Field label="Name on symbol">
          <TextInput value={designation} onChange={setDesignation} placeholder="2. plut" />
        </Field>
        <div className="symbol-palette">
          {UNIT_CATALOG.map((unit) => {
            const sidc = buildSidc({ affiliation, confidence, echelon, functionId: unit.functionId });
            return (
              <SymbolChip
                key={unit.id}
                sidc={sidc}
                label={unit.label}
                selected={drawId === "symbol" && functionId === unit.functionId}
                onClick={() => {
                  setFunctionId(unit.functionId);
                  setDrawId("symbol");
                  setDraft([]);
                  setSelectedId(null);
                }}
              />
            );
          })}
        </div>
        <p className="hint">{drawId === "symbol" ? "Click the map to stamp." : "Pick a unit, then click the map."}</p>

        <div className="section-kicker">Draw</div>
        <div className="map-toolbar">
          {DRAW_TOOLS.map((tool) => (
            <button
              type="button"
              key={tool.id}
              className={`btn ${drawId === tool.id ? "btn-primary" : ""}`}
              onClick={() => {
                setDrawId(tool.id);
                setDraft([]);
                setSelectedId(null);
              }}
            >
              {tool.label}
            </button>
          ))}
        </div>
        {drawTool && drawTool.id !== "select" && drawTool.draw !== "point" ? (
          <p className="hint">Click points, then Finish. Esc cancels.</p>
        ) : null}
        <Field label="Label">
          <TextInput value={label} onChange={setLabel} placeholder="OBJ WEST" />
        </Field>
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
        <button type="button" className="btn btn-danger" disabled={!selectedId} onClick={deleteSelected}>
          Delete selected
        </button>

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
            <input type="checkbox" checked={greyscale} onChange={(event) => setGreyscale(event.target.checked)} />
            Greyscale (photocopy check)
          </label>
          <Field label="Scale (m)">
            <NumberInput min={1} value={map.scaleBar.meters} onChange={(meters) => onChange(replaceMap(scenario, { ...map, scaleBar: { ...map.scaleBar, meters } }))} />
          </Field>
          <Field label="North rotation">
            <NumberInput value={map.northArrow.rotationDeg} onChange={(rotationDeg) => onChange(replaceMap(scenario, { ...map, northArrow: { rotationDeg } }))} />
          </Field>
          <Field label="Tracing opacity">
            <NumberInput
              min={0}
              max={1}
              value={map.underlay?.opacity ?? 1}
              onChange={(opacity) =>
                onChange(
                  replaceMap(scenario, {
                    ...map,
                    underlay: map.underlay ? { ...map.underlay, opacity } : undefined,
                  }),
                )
              }
            />
          </Field>
        </details>
        {selected?.featureType === "symbol" ? (
          <p className="hint">Selected {selected.designation || selected.sidc || "symbol"}</p>
        ) : null}
        {selected && (selected.featureType === "terrain" || selected.featureType === "control_measure") ? (
          <Field label="Selected label">
            <TextInput
              value={selected.label ?? ""}
              onChange={(value) => onChange(replaceMap(scenario, patchFeature(map, selected.id, { label: value })))}
            />
          </Field>
        ) : null}
      </aside>
      <div>
        <p className="map-mode">
          {drawId === "select"
            ? "Select — click ground or a symbol. Drag corners to reshape. Delete to remove."
            : drawId === "symbol"
              ? `Placing ${UNIT_CATALOG.find((unit) => unit.functionId === functionId)?.label ?? "unit"} — click the map to stamp.`
              : drawTool && "draw" in drawTool && drawTool.draw !== "point"
                ? `Drawing ${drawTool.label} — click points, then Finish (or double-click).`
                : `Placing ${drawTool?.label ?? "point"} — click the map.`}
        </p>
        <MapView
          map={map}
          imageUrl={imageUrl}
          audience={audience}
          greyscale={greyscale}
          loadBearingIds={loadBearingIds}
          selectedId={selectedId}
          onSelect={(id) => {
            if (drawId === "select") setSelectedId(id);
          }}
          onClickPoint={(point) => commitPoint([point.coordinates[0], point.coordinates[1]])}
          draftPoints={draft}
          onFinishDraft={finishDraft}
          onMoveVertex={drawId === "select" ? moveVertex : undefined}
        />
      </div>
    </div>
  );
}
