import type { Affiliation, Confidence, ControlMeasure, Echelon, MapFeature, MilSymbol, TerrainFeature } from "../../schema/types";
import { Field, NumberInput, Select, TextInput } from "../fields";

const AFFILIATION_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "hostile", label: "Hostile" },
  { value: "neutral", label: "Neutral" },
  { value: "unknown", label: "Unknown" },
];

const CONFIDENCE_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suspected", label: "Suspected" },
  { value: "templated", label: "Templated" },
];

const ECHELON_OPTIONS: { value: Echelon; label: string }[] = [
  { value: "fireteam", label: "Fireteam" },
  { value: "squad", label: "Squad" },
  { value: "platoon", label: "Platoon" },
  { value: "company", label: "Company" },
  { value: "battalion", label: "Battalion" },
  { value: "brigade", label: "Brigade" },
];

export function Inspector({
  feature,
  echelon,
  onEchelon,
  onPatch,
  onDelete,
}: {
  feature: MapFeature | undefined;
  echelon: Echelon;
  onEchelon: (echelon: Echelon) => void;
  onPatch: (patch: Partial<MilSymbol> | Partial<TerrainFeature> | Partial<ControlMeasure>) => void;
  onDelete: () => void;
}) {
  if (!feature) {
    return (
      <aside className="map-inspector">
        <div className="section-kicker">Inspector</div>
        <p className="hint">Select a symbol or a piece of ground. Drag to move. Corners reshape. The handle above a unit rotates it.</p>
      </aside>
    );
  }

  if (feature.featureType === "symbol") {
    const symbol = feature;
    return (
      <aside className="map-inspector">
        <div className="section-kicker">Unit symbol</div>
        <Field label="Designation">
          <TextInput value={symbol.designation ?? ""} onChange={(designation) => onPatch({ designation })} placeholder="2. plut" />
        </Field>
        <Field label="Higher formation">
          <TextInput value={symbol.higherFormation ?? ""} onChange={(higherFormation) => onPatch({ higherFormation })} placeholder="2. coy" />
        </Field>
        <Field label="Staff comments">
          <TextInput value={symbol.staffComments ?? ""} onChange={(staffComments) => onPatch({ staffComments })} placeholder="DS" />
        </Field>
        <Field label="Whose">
          <Select value={symbol.affiliation} options={AFFILIATION_OPTIONS} onChange={(affiliation) => onPatch({ affiliation: affiliation as Affiliation })} />
        </Field>
        <Field label="Known?">
          <Select value={symbol.confidence} options={CONFIDENCE_OPTIONS} onChange={(confidence) => onPatch({ confidence: confidence as Confidence })} />
        </Field>
        <Field label="Echelon (next stamp)">
          <Select value={echelon} options={ECHELON_OPTIONS} onChange={onEchelon} />
        </Field>
        <Field label="Size">
          <NumberInput min={20} max={90} value={symbol.sizePx ?? 42} onChange={(sizePx) => onPatch({ sizePx })} />
        </Field>
        <Field label="Rotation">
          <NumberInput value={symbol.rotationDeg ?? 0} onChange={(rotationDeg) => onPatch({ rotationDeg })} />
        </Field>
        <Field label="Direction of movement">
          <NumberInput value={symbol.directionDeg ?? 0} onChange={(directionDeg) => onPatch({ directionDeg })} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.headquarters)} onChange={(event) => onPatch({ headquarters: event.target.checked })} />
          Headquarters (staff)
        </label>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.taskForce)} onChange={(event) => onPatch({ taskForce: event.target.checked })} />
          Task force
        </label>
        <Field label="Strength">
          <Select
            value={symbol.strengthModifier ?? "none"}
            options={[
              { value: "none", label: "None" },
              { value: "reinforced", label: "Reinforced (+)" },
              { value: "reduced", label: "Reduced (−)" },
            ]}
            onChange={(value) => onPatch({ strengthModifier: value === "none" ? undefined : (value as "reinforced" | "reduced") })}
          />
        </Field>
        <p className="hint">{symbol.sidc}</p>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </aside>
    );
  }

  const label = "label" in feature ? feature.label ?? "" : "";
  const kind = "kind" in feature ? feature.kind.replaceAll("_", " ") : feature.featureType;
  return (
    <aside className="map-inspector">
      <div className="section-kicker">{kind}</div>
      <Field label="Label">
        <TextInput value={label} onChange={(value) => onPatch({ label: value })} />
      </Field>
      <p className="hint">Drag the feature to move it. Drag the white corners to reshape.</p>
      <button type="button" className="btn btn-danger" onClick={onDelete}>
        Delete
      </button>
    </aside>
  );
}
