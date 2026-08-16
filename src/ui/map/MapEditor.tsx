import { useState } from "react";
import { readFileAsDataUrl } from "../../io/files";
import { newId } from "../../schema/ids";
import type {
  Affiliation,
  Audience,
  Confidence,
  ControlMeasureKind,
  LayerRole,
  MapDocument,
  MapFeature,
  Scenario,
  TerrainFeatureKind,
} from "../../schema/types";
import { loadBearingFeatureIds } from "../../validator/validate";
import { Field, NumberInput, Select, TextInput } from "../fields";
import { FRAME_FOR_AFFILIATION, geometryFromDraft, MapView } from "./MapView";

type Tool = "select" | "symbol" | "terrain" | "control";
type DrawKind = "point" | "line" | "polygon";

const TERRAIN_KINDS: TerrainFeatureKind[] = ["woods", "water", "wetland", "built_up", "road", "trail", "bridge", "contour", "spot_elevation", "custom"];
const CONTROL_KINDS: ControlMeasureKind[] = [
  "boundary",
  "phase_line",
  "objective",
  "axis_of_advance",
  "engagement_area",
  "battle_position",
  "trp",
  "lz",
  "checkpoint",
  "obstacle",
  "custom",
];

function replaceMap(scenario: Scenario, map: MapDocument): Scenario {
  return { ...scenario, maps: scenario.maps.map((item) => (item.id === map.id ? map : item)) };
}

function addFeature(map: MapDocument, layerId: string, feature: MapFeature): MapDocument {
  return {
    ...map,
    layers: map.layers.map((layer) => (layer.id === layerId ? { ...layer, features: [...layer.features, feature] } : layer)),
  };
}

function defaultAudience(role: LayerRole): Audience[] {
  if (role === "enemy_truth" || role === "solution_overlay" || role === "outcome_overlay") return ["facilitator"];
  return ["student", "facilitator"];
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
  const [tool, setTool] = useState<Tool>("select");
  const [drawKind, setDrawKind] = useState<DrawKind>("point");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [greyscale, setGreyscale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [affiliation, setAffiliation] = useState<Affiliation>("friendly");
  const [confidence, setConfidence] = useState<Confidence>("confirmed");
  const [designation, setDesignation] = useState("");
  const [terrainKind, setTerrainKind] = useState<TerrainFeatureKind>("wetland");
  const [controlKind, setControlKind] = useState<ControlMeasureKind>("objective");
  const [label, setLabel] = useState("");
  const activeLayerId = map?.layers[0]?.id ?? "";

  if (!map) return <p>No map document on this scenario.</p>;

  const imageRef = map.base.kind === "raster" ? map.base.imageRef : "";
  const imageUrl = imageRef ? assets?.[imageRef] : undefined;
  const loadBearingIds = loadBearingFeatureIds(scenario);
  const selected = map.layers.flatMap((layer) => layer.features).find((feature) => feature.id === selectedId);

  function commitGeometry(point: [number, number]) {
    if (!map) return;
    if (tool === "select") return;
    if (tool === "symbol") {
      const feature: MapFeature = {
        featureType: "symbol",
        id: newId(),
        affiliation,
        frame: FRAME_FOR_AFFILIATION[affiliation],
        confidence,
        position: { type: "Point", coordinates: point },
        designation: designation || undefined,
        echelonMarker: affiliation === "friendly" || affiliation === "hostile" ? "••" : undefined,
      };
      const layerId = map.layers.find((layer) => layer.role === (affiliation === "hostile" ? "enemy_known" : "friendly"))?.id ?? activeLayerId;
      onChange(replaceMap(scenario, addFeature(map, layerId, feature)));
      setSelectedId(feature.id);
      return;
    }
    const nextDraft = [...draft, point];
    if (drawKind === "point") {
      const geometry = geometryFromDraft("point", nextDraft);
      if (!geometry) return;
      const feature: MapFeature =
        tool === "terrain"
          ? { featureType: "terrain", id: newId(), kind: terrainKind, geometry, label: label || undefined }
          : { featureType: "control_measure", id: newId(), kind: controlKind, geometry, label: label || controlKind.toUpperCase() };
      const role = tool === "terrain" ? "terrain" : "control_measures";
      const layerId = map.layers.find((layer) => layer.role === role)?.id ?? activeLayerId;
      onChange(replaceMap(scenario, addFeature(map, layerId, feature)));
      setDraft([]);
      setSelectedId(feature.id);
      return;
    }
    setDraft(nextDraft);
  }

  function finishDraft() {
    if (!map) return;
    const kind = drawKind;
    const geometry = geometryFromDraft(kind, draft);
    if (!geometry) return;
    const feature: MapFeature =
      tool === "terrain"
        ? { featureType: "terrain", id: newId(), kind: terrainKind, geometry, label: label || undefined }
        : { featureType: "control_measure", id: newId(), kind: controlKind, geometry, label: label || controlKind.toUpperCase() };
    const role = tool === "terrain" ? "terrain" : "control_measures";
    const layerId = map.layers.find((layer) => layer.role === role)?.id ?? activeLayerId;
    onChange(replaceMap(scenario, addFeature(map, layerId, feature)));
    setDraft([]);
    setSelectedId(feature.id);
  }

  function deleteSelected() {
    if (!selectedId || !map) return;
    onChange(
      replaceMap(scenario, {
        ...map,
        layers: map.layers.map((layer) => ({ ...layer, features: layer.features.filter((feature) => feature.id !== selectedId) })),
      }),
    );
    setSelectedId(null);
  }

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !map || map.base.kind !== "raster") return;
    const dataUrl = await readFileAsDataUrl(file);
    onAsset(map.base.imageRef, dataUrl);
  }

  return (
    <section>
      <div className="section-kicker">Map</div>
      <h2>Raster base + overlay</h2>
      <p className="hint">Upload a scan, sketch photo, or screenshot. Frame shape carries affiliation even in greyscale.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="btn">
          Upload raster
          <input type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files)} />
        </label>
        <label className="row">
          View
          <Select
            value={audience}
            options={[
              { value: "all", label: "editor (all layers)" },
              { value: "student", label: "student" },
              { value: "facilitator", label: "facilitator" },
            ]}
            onChange={setAudience}
          />
        </label>
        <label className="row">
          <input type="checkbox" checked={greyscale} onChange={(event) => setGreyscale(event.target.checked)} />
          Greyscale preview
        </label>
      </div>
      <div className="map-toolbar">
        {(["select", "symbol", "terrain", "control"] as Tool[]).map((item) => (
          <button type="button" key={item} className={`btn ${tool === item ? "btn-primary" : ""}`} onClick={() => { setTool(item); setDraft([]); }}>
            {item}
          </button>
        ))}
        {tool !== "select" && tool !== "symbol" ? (
          <Select
            value={drawKind}
            options={[
              { value: "point", label: "point" },
              { value: "line", label: "line" },
              { value: "polygon", label: "polygon" },
            ]}
            onChange={(value) => { setDrawKind(value); setDraft([]); }}
          />
        ) : null}
        {draft.length > 0 ? (
          <>
            <button type="button" className="btn" onClick={finishDraft} disabled={drawKind === "line" ? draft.length < 2 : draft.length < 3}>
              Finish shape ({draft.length} pts)
            </button>
            <button type="button" className="btn" onClick={() => setDraft([])}>
              Cancel
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn-danger" disabled={!selectedId} onClick={deleteSelected}>
          Delete selected
        </button>
      </div>
      {tool === "symbol" ? (
        <div className="grid-3">
          <Field label="Affiliation">
            <Select value={affiliation} options={["friendly", "hostile", "neutral", "unknown"].map((value) => ({ value: value as Affiliation, label: value }))} onChange={setAffiliation} />
          </Field>
          <Field label="Confidence">
            <Select value={confidence} options={["confirmed", "suspected", "templated"].map((value) => ({ value: value as Confidence, label: value }))} onChange={setConfidence} />
          </Field>
          <Field label="Designation">
            <TextInput value={designation} onChange={setDesignation} />
          </Field>
        </div>
      ) : null}
      {tool === "terrain" ? (
        <div className="grid-2">
          <Field label="Kind">
            <Select value={terrainKind} options={TERRAIN_KINDS.map((value) => ({ value, label: value.replaceAll("_", " ") }))} onChange={setTerrainKind} />
          </Field>
          <Field label="Label">
            <TextInput value={label} onChange={setLabel} />
          </Field>
        </div>
      ) : null}
      {tool === "control" ? (
        <div className="grid-2">
          <Field label="Kind">
            <Select value={controlKind} options={CONTROL_KINDS.map((value) => ({ value, label: value.replaceAll("_", " ") }))} onChange={setControlKind} />
          </Field>
          <Field label="Label">
            <TextInput value={label} onChange={setLabel} />
          </Field>
        </div>
      ) : null}
      <MapView
        map={map}
        imageUrl={imageUrl}
        audience={audience}
        greyscale={greyscale}
        loadBearingIds={loadBearingIds}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setTool("select"); }}
        onClickPoint={(point) => commitGeometry([point.coordinates[0], point.coordinates[1]])}
      />
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Field label="Scale bar (meters)">
          <NumberInput min={1} value={map.scaleBar.meters} onChange={(meters) => onChange(replaceMap(scenario, { ...map, scaleBar: { ...map.scaleBar, meters } }))} />
        </Field>
        <Field label="Scale bar length (px)">
          <NumberInput min={20} value={map.scaleBar.renderLengthPx} onChange={(renderLengthPx) => onChange(replaceMap(scenario, { ...map, scaleBar: { ...map.scaleBar, renderLengthPx } }))} />
        </Field>
        <Field label="North arrow rotation (deg)">
          <NumberInput value={map.northArrow.rotationDeg} onChange={(rotationDeg) => onChange(replaceMap(scenario, { ...map, northArrow: { rotationDeg } }))} />
        </Field>
        <Field label="Base opacity">
          <NumberInput
            min={0}
            value={map.base.kind === "raster" ? map.base.opacity : 1}
            onChange={(opacity) =>
              map.base.kind === "raster" ? onChange(replaceMap(scenario, { ...map, base: { ...map.base, opacity: Math.min(1, Math.max(0, opacity)) } })) : undefined
            }
          />
        </Field>
      </div>
      <h3>Layers</h3>
      <div className="layer-list">
        {map.layers.map((layer) => (
          <div className="card" key={layer.id} style={{ minWidth: 220 }}>
            <strong>{layer.role.replaceAll("_", " ")}</strong>
            <div className="hint">{layer.features.length} features</div>
            <label>
              <input
                type="checkbox"
                checked={layer.visibleIn.includes("student")}
                disabled={layer.role === "enemy_truth" || layer.role === "solution_overlay"}
                onChange={(event) => {
                  const visibleIn: Audience[] = event.target.checked
                    ? [...new Set([...layer.visibleIn, "student" as const])]
                    : layer.visibleIn.filter((item) => item !== "student");
                  onChange(
                    replaceMap(scenario, {
                      ...map,
                      layers: map.layers.map((item) => (item.id === layer.id ? { ...item, visibleIn: visibleIn.length ? visibleIn : ["facilitator"] } : item)),
                    }),
                  );
                }}
              />{" "}
              student
            </label>
            <label>
              <input
                type="checkbox"
                checked={layer.visibleIn.includes("facilitator")}
                onChange={(event) => {
                  const visibleIn: Audience[] = event.target.checked
                    ? [...new Set([...layer.visibleIn, "facilitator" as const])]
                    : layer.visibleIn.filter((item) => item !== "facilitator");
                  onChange(
                    replaceMap(scenario, {
                      ...map,
                      layers: map.layers.map((item) => (item.id === layer.id ? { ...item, visibleIn: visibleIn.length ? visibleIn : defaultAudience(item.role) } : item)),
                    }),
                  );
                }}
              />{" "}
              facilitator
            </label>
          </div>
        ))}
      </div>
      {selected ? (
        <div className="card">
          <strong>Selected</strong>
          <div className="hint">{selected.featureType} · {selected.id}</div>
          {"label" in selected ? <div>{selected.label}</div> : null}
          {"designation" in selected ? <div>{selected.designation}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
