import type { Affiliation, Confidence, ControlMeasure, MapFeature, MilSymbol, TerrainFeature } from "../../schema/types";
import { editableVertices } from "../../map/geometry";
import { graphicDef, isSecurityFront, pointSpec, securityLetterSpacing, setSecurityLetterSpacing } from "../../map/milstd";
import { ECHELON_OPTIONS, echelonFromSidc, functionIdFromSidc, UNIT_CATALOG } from "../../map/sidc";
import { ColorInput, CommitTextInput, Field, NumberInput, Select } from "../fields";

const AFFILIATION_OPTIONS: { value: Affiliation; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "hostile", label: "Hostile" },
  { value: "neutral", label: "Neutral" },
  { value: "unknown", label: "Unknown" },
];

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suspected", label: "Suspected" },
  { value: "templated", label: "Templated" },
];

const TERRAIN_DEFAULTS: Record<string, { stroke: string; fill: string }> = {
  contour: { stroke: "#8a6f4d", fill: "#8a6f4d" },
  mountain: { stroke: "#7a6247", fill: "#7a6247" },
  woods: { stroke: "#6f9455", fill: "#89ab6d" },
  water: { stroke: "#4a7a99", fill: "#9dbfd4" },
  river: { stroke: "#5b8fae", fill: "#5b8fae" },
  stream: { stroke: "#5b8fae", fill: "#5b8fae" },
  wetland: { stroke: "#7f9c6b", fill: "#b5cfa4" },
  built_up: { stroke: "#5a5248", fill: "#cfc4b2" },
  building: { stroke: "#1b2118", fill: "#1b2118" },
  road: { stroke: "#1b2118", fill: "#1b2118" },
  trail: { stroke: "#1b2118", fill: "#1b2118" },
  bridge: { stroke: "#1b2118", fill: "#1b2118" },
  custom: { stroke: "#3e4c34", fill: "#3e4c34" },
  spot_elevation: { stroke: "#5a4a38", fill: "#5a4a38" },
};

export function Inspector({
  feature,
  onPatch,
  onDelete,
  onRotateBy,
  onAddPoint,
}: {
  feature: MapFeature | undefined;
  onPatch: (patch: (Partial<MilSymbol> & { functionId?: string }) | Partial<TerrainFeature> | Partial<ControlMeasure>) => void;
  onDelete: () => void;
  onRotateBy?: (deg: number) => void;
  onAddPoint?: () => void;
}) {
  if (!feature) {
    return (
      <aside className="map-inspector">
        <div className="section-kicker">Inspector</div>
        <p className="hint">Select a unit or a piece of ground. Drag the unit picture from the rail onto the sheet to place it.</p>
      </aside>
    );
  }

  if (feature.featureType === "symbol") {
    const symbol = feature;
    const echelon = symbol.echelon ?? echelonFromSidc(symbol.sidc);
    const kind = functionIdFromSidc(symbol.sidc);
    const kindOptions = UNIT_CATALOG.some((unit) => unit.functionId === kind)
      ? UNIT_CATALOG.map((unit) => ({ value: unit.functionId, label: unit.label }))
      : [{ value: kind, label: kind }, ...UNIT_CATALOG.map((unit) => ({ value: unit.functionId, label: unit.label }))];
    return (
      <aside className="map-inspector">
        <div className="section-kicker">This unit</div>
        <Field label="Designation">
          <CommitTextInput value={symbol.designation ?? ""} onCommit={(designation) => onPatch({ designation })} placeholder="1st Squad" />
        </Field>
        <Field label="Kind">
          <Select value={kind} options={kindOptions} onChange={(functionId) => onPatch({ functionId })} />
        </Field>
        <Field label="Whose">
          <Select value={symbol.affiliation} options={AFFILIATION_OPTIONS} onChange={(affiliation) => onPatch({ affiliation })} />
        </Field>
        <Field label="Echelon">
          <Select value={echelon} options={ECHELON_OPTIONS} onChange={(value) => onPatch({ echelon: value })} />
        </Field>
        <Field label="Known?">
          <Select value={symbol.confidence} options={CONFIDENCE_OPTIONS} onChange={(confidence) => onPatch({ confidence })} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.headquarters)} onChange={(event) => onPatch({ headquarters: event.target.checked })} />
          Headquarters
        </label>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.taskForce)} onChange={(event) => onPatch({ taskForce: event.target.checked })} />
          Task force
        </label>
        <Field label="Higher formation">
          <CommitTextInput value={symbol.higherFormation ?? ""} onCommit={(higherFormation) => onPatch({ higherFormation })} placeholder="2. coy" />
        </Field>
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
        <Field label="Size">
          <NumberInput min={20} max={90} value={symbol.sizePx ?? 42} onChange={(sizePx) => onPatch({ sizePx })} />
        </Field>
        <Field label="Rotate symbol" hint="Spin the icon. Drag the rotate handle above the box.">
          <NumberInput value={Math.round(symbol.rotationDeg ?? 0)} onChange={(rotationDeg) => onPatch({ rotationDeg })} />
        </Field>
        <Field label="Movement" hint="Speed leader on the symbol. 0 means none — this is not rotation.">
          <NumberInput value={symbol.directionDeg ?? 0} onChange={(directionDeg) => onPatch({ directionDeg })} />
        </Field>
        <p className="hint">{symbol.sidc}</p>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </aside>
    );
  }

  if (feature.featureType === "terrain") {
    const paint = TERRAIN_DEFAULTS[feature.kind] ?? TERRAIN_DEFAULTS.custom!;
    const hill = feature.kind === "mountain" || feature.kind === "contour";
    return (
      <aside className="map-inspector">
        <div className="section-kicker">{feature.kind.replaceAll("_", " ")}</div>
        <Field label="Label">
          <CommitTextInput value={feature.label ?? ""} onCommit={(label) => onPatch({ label: label || undefined })} placeholder={hill ? "Hill 214" : ""} />
        </Field>
        <Field label="Line color">
          <ColorInput value={feature.stroke} fallback={paint.stroke} onChange={(stroke) => onPatch({ stroke })} />
        </Field>
        {feature.geometry.type !== "LineString" ? (
          <Field label="Fill color">
            <ColorInput value={feature.fill} fallback={paint.fill} onChange={(fill) => onPatch({ fill })} />
          </Field>
        ) : null}
        {hill ? (
          <>
            <Field label="Peak (m)" hint="Printed at the top. Contour lines step down from this.">
              <NumberInput value={feature.elevation ?? 0} onChange={(elevation) => onPatch({ elevation: elevation || undefined })} />
            </Field>
            <Field label="Contour lines" hint="Including the outline. Each line is one interval.">
              <NumberInput min={1} max={12} value={feature.contourCount ?? 3} onChange={(contourCount) => onPatch({ contourCount })} />
            </Field>
            <Field label="Interval">
              <Select
                value={String(feature.contourInterval ?? 10)}
                options={[
                  { value: "10", label: "10 m" },
                  { value: "100", label: "100 m" },
                ]}
                onChange={(value) => onPatch({ contourInterval: Number(value) as 10 | 100 })}
              />
            </Field>
          </>
        ) : null}
        <RotateAndPoints onRotateBy={onRotateBy} onAddPoint={onAddPoint} canAdd={feature.geometry.type !== "Point"} />
        <p className="hint">Drag to move. Drag the white corners to reshape. Alt-click a line to add a point.</p>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </aside>
    );
  }

  const label = "label" in feature ? feature.label ?? "" : "";
  const def = feature.featureType === "control_measure" ? graphicDef(feature.kind) : undefined;
  const kind = def?.label ?? ("kind" in feature ? feature.kind.replaceAll("_", " ") : feature.featureType);
  const spec = feature.featureType === "control_measure" ? pointSpec(feature.kind) : null;
  const verts = "geometry" in feature ? editableVertices(feature.geometry).length : 0;
  const canAdd =
    feature.featureType === "control_measure" &&
    feature.geometry.type !== "Point" &&
    (!spec || verts < spec.max);

  return (
    <aside className="map-inspector">
      <div className="section-kicker">{kind}</div>
      {def ? <p className="hint">2525D {def.label}.</p> : null}
      {feature.featureType === "control_measure" ? (
        <Field label="Whose">
          <Select
            value={feature.affiliation ?? "friendly"}
            options={AFFILIATION_OPTIONS}
            onChange={(affiliation) => onPatch({ affiliation })}
          />
        </Field>
      ) : null}
      <Field label="Label" hint={def ? "Drawn by the symbol standard where doctrine puts it." : undefined}>
        <CommitTextInput value={label} onCommit={(value) => onPatch({ label: value })} />
      </Field>
      {feature.featureType === "control_measure" && isSecurityFront(feature.kind) && verts >= 4 ? (
        <Field label="Letter spacing" hint="Space between the S, G, or C marks along the front. You can also drag the inner dots.">
          <input
            type="range"
            min={12}
            max={90}
            value={Math.round(securityLetterSpacing(feature.geometry) * 100)}
            onChange={(event) => onPatch({ geometry: setSecurityLetterSpacing(feature.geometry, Number(event.target.value) / 100) })}
            aria-label="Letter spacing"
          />
        </Field>
      ) : null}
      <RotateAndPoints onRotateBy={onRotateBy} onAddPoint={canAdd ? onAddPoint : undefined} canAdd={Boolean(canAdd)} />
      <p className="hint">
        {feature.featureType === "control_measure"
          ? "Drag the body to move. Dots on the ink reshape it. A diamond is width. The square scales. Drag the rotate handle above the box."
          : "Drag to move. Drag the white corners to reshape."}
      </p>
      <button type="button" className="btn btn-danger" onClick={onDelete}>
        Delete
      </button>
    </aside>
  );
}

function RotateAndPoints({
  onRotateBy,
  onAddPoint,
  canAdd,
}: {
  onRotateBy?: (deg: number) => void;
  onAddPoint?: () => void;
  canAdd: boolean;
}) {
  if (!onRotateBy && !onAddPoint) return null;
  return (
    <div className="inspector-actions">
      {onRotateBy ? (
        <Field label="Rotate" hint="Keeps the size. Or drag the rotate handle above the box.">
          <span className="rotate-btns">
            {([-90, -15, 15, 90] as const).map((deg) => (
              <button key={deg} type="button" className="tool-btn" onClick={() => onRotateBy(deg)}>
                {deg > 0 ? `+${deg}°` : `${deg}°`}
              </button>
            ))}
          </span>
        </Field>
      ) : null}
      {canAdd && onAddPoint ? (
        <button type="button" className="btn" onClick={onAddPoint}>
          Add point
        </button>
      ) : null}
    </div>
  );
}
