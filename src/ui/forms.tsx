import { buildOutcomeStates, isTimeExpiredOutcome, MISSION_TYPE_LABELS, outcomePresetsFor } from "../schema/presets";
import { newId } from "../schema/ids";
import type {
  Deliverable,
  DependencyKind,
  DilemmaType,
  Domain,
  Echelon,
  MissionType,
  OutcomeState,
  Scenario,
} from "../schema/types";
import { Field, NumberInput, optionize, Select, StringList, TextArea, TextInput } from "./fields";

const ECHELONS: Echelon[] = ["fireteam", "squad", "platoon", "company", "battalion", "brigade", "custom"];
const DOMAINS: Domain[] = ["ground", "air", "naval", "logistics", "combined", "civilian_emergency", "other"];
const DILEMMAS: DilemmaType[] = [
  "insufficient_combat_power",
  "time_pressure",
  "risk_vs_tempo",
  "incomplete_information",
  "conflicting_intent",
  "resource_allocation",
  "rules_of_engagement",
  "command_relationship",
  "custom",
];
const DEP_KINDS: DependencyKind[] = ["force", "terrain", "time", "information", "fires", "logistics", "civil", "weather"];
const DELIVERABLES: Deliverable[] = [
  "frag_order",
  "sketch",
  "rationale",
  "task_organization",
  "priority_of_work",
  "fire_support_plan",
  "custom",
];
const CAPABILITY_KEYS = [
  "dismountStrength",
  "directFire",
  "antiArmor",
  "organicIndirect",
  "mobility",
  "comms",
  "sustainmentRadius",
  "nightCapability",
] as const;

function outcomesStillPreset(scenario: Scenario, missionType: MissionType): boolean {
  const presetLabels = outcomePresetsFor(missionType).map((item) => item.label);
  const current = scenario.outcomeStates.filter((state) => !isTimeExpiredOutcome(state)).map((state) => state.label);
  return current.length === presetLabels.length && current.every((label, index) => label === presetLabels[index]);
}

export function MetaForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  return (
    <section>
      <div className="section-kicker">Meta</div>
      <h2>Scenario identity</h2>
      <Field label="Title">
        <TextInput value={scenario.title} onChange={(title) => onChange({ ...scenario, title })} />
      </Field>
      <div className="grid-3">
        <Field label="Echelon">
          <Select value={scenario.meta.echelon} options={optionize(ECHELONS)} onChange={(echelon) => onChange({ ...scenario, meta: { ...scenario.meta, echelon } })} />
        </Field>
        <Field label="Mission type" hint="Changing this resets outcome states if you have not edited the preset labels.">
          <Select
            value={scenario.meta.missionType}
            options={(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map((value) => ({ value, label: MISSION_TYPE_LABELS[value] }))}
            onChange={(missionType) => {
              const next = { ...scenario, meta: { ...scenario.meta, missionType } };
              if (outcomesStillPreset(scenario, scenario.meta.missionType)) {
                next.outcomeStates = buildOutcomeStates(missionType);
              }
              onChange(next);
            }}
          />
        </Field>
        <Field label="Domain">
          <Select value={scenario.meta.domain} options={optionize(DOMAINS)} onChange={(domain) => onChange({ ...scenario, meta: { ...scenario.meta, domain } })} />
        </Field>
      </div>
      <div className="grid-3">
        <Field label="Era">
          <TextInput value={scenario.meta.setting.era} onChange={(era) => onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, era } } })} />
        </Field>
        <Field label="Region">
          <TextInput value={scenario.meta.setting.region} onChange={(region) => onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, region } } })} />
        </Field>
        <Field label="Season">
          <TextInput value={scenario.meta.setting.season} onChange={(season) => onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, season } } })} />
        </Field>
      </div>
      <div className="grid-3">
        <Field label="Estimated minutes">
          <NumberInput min={1} value={scenario.meta.estimatedMinutes} onChange={(estimatedMinutes) => onChange({ ...scenario, meta: { ...scenario.meta, estimatedMinutes } })} />
        </Field>
        <Field label="Author">
          <TextInput value={scenario.meta.author} onChange={(author) => onChange({ ...scenario, meta: { ...scenario.meta, author } })} />
        </Field>
        <Field label="Provenance">
          <TextInput value={scenario.meta.provenance ?? ""} onChange={(provenance) => onChange({ ...scenario, meta: { ...scenario.meta, provenance } })} />
        </Field>
      </div>
      <label className="row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={scenario.meta.setting.fictionalized}
          onChange={(event) =>
            onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, fictionalized: event.target.checked } } })
          }
        />
        Fictionalized (recommended)
      </label>
      <Field label="Tags">
        <StringList values={scenario.meta.tags} onChange={(tags) => onChange({ ...scenario, meta: { ...scenario.meta, tags } })} addLabel="Add tag" />
      </Field>
    </section>
  );
}

export function DilemmaForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const featureOptions = scenario.maps.flatMap((map) =>
    map.layers.flatMap((layer) =>
      layer.features.map((feature) => ({
        id: feature.id,
        label:
          ("label" in feature && feature.label) ||
          ("designation" in feature && feature.designation) ||
          ("name" in feature && feature.name) ||
          feature.id,
      })),
    ),
  );

  return (
    <section>
      <div className="section-kicker">Dilemma</div>
      <h2>The tension</h2>
      <p className="hint">One or two sentences. The app will not draft this for you.</p>
      <Field label="Statement">
        <TextArea rows={3} value={scenario.dilemma.statement} onChange={(statement) => onChange({ ...scenario, dilemma: { ...scenario.dilemma, statement } })} />
      </Field>
      <Field label="Type">
        <Select
          value={scenario.dilemma.type}
          options={optionize(DILEMMAS)}
          onChange={(type) => onChange({ ...scenario, dilemma: { ...scenario.dilemma, type } })}
        />
      </Field>
      {scenario.dilemma.dependencies.map((dependency, index) => (
        <div className="card" key={index}>
          <div className="grid-2">
            <Field label="Kind">
              <Select
                value={dependency.kind}
                options={optionize(DEP_KINDS)}
                onChange={(kind) => {
                  const dependencies = [...scenario.dilemma.dependencies];
                  dependencies[index] = { ...dependency, kind };
                  onChange({ ...scenario, dilemma: { ...scenario.dilemma, dependencies } });
                }}
              />
            </Field>
            <Field label="Capability refs">
              <select
                multiple
                value={dependency.capabilityRefs ?? []}
                onChange={(event) => {
                  const capabilityRefs = [...event.target.selectedOptions].map((option) => option.value as (typeof CAPABILITY_KEYS)[number]);
                  const dependencies = [...scenario.dilemma.dependencies];
                  dependencies[index] = { ...dependency, capabilityRefs };
                  onChange({ ...scenario, dilemma: { ...scenario.dilemma, dependencies } });
                }}
              >
                {CAPABILITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <TextArea
              rows={2}
              value={dependency.description}
              onChange={(description) => {
                const dependencies = [...scenario.dilemma.dependencies];
                dependencies[index] = { ...dependency, description };
                onChange({ ...scenario, dilemma: { ...scenario.dilemma, dependencies } });
              }}
            />
          </Field>
          <Field label="Map feature refs" hint="Dilemma-critical terrain the student must be able to see.">
            <select
              multiple
              value={dependency.mapFeatureRefs ?? []}
              onChange={(event) => {
                const mapFeatureRefs = [...event.target.selectedOptions].map((option) => option.value);
                const dependencies = [...scenario.dilemma.dependencies];
                dependencies[index] = { ...dependency, mapFeatureRefs };
                onChange({ ...scenario, dilemma: { ...scenario.dilemma, dependencies } });
              }}
            >
              {featureOptions.map((feature) => (
                <option key={feature.id} value={feature.id}>
                  {feature.label}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              onChange({
                ...scenario,
                dilemma: { ...scenario.dilemma, dependencies: scenario.dilemma.dependencies.filter((_, itemIndex) => itemIndex !== index) },
              })
            }
          >
            Remove dependency
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange({
            ...scenario,
            dilemma: {
              ...scenario.dilemma,
              dependencies: [...scenario.dilemma.dependencies, { kind: "force", description: "" }],
            },
          })
        }
      >
        Add dependency
      </button>
    </section>
  );
}

export function SituationForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const s = scenario.situation;
  const set = (patch: Partial<typeof s>) => onChange({ ...scenario, situation: { ...s, ...patch } });
  return (
    <section>
      <div className="section-kicker">Situation</div>
      <h2>What the student knows — and what they do not</h2>
      <Field label="General situation">
        <TextArea value={s.general} onChange={(general) => set({ general })} />
      </Field>
      <Field label="Enemy known (handout)">
        <TextArea value={s.enemy.known} onChange={(known) => set({ enemy: { ...s.enemy, known } })} />
      </Field>
      <Field label="Assessed enemy intent (handout)">
        <TextArea value={s.enemy.assessedIntent} onChange={(assessedIntent) => set({ enemy: { ...s.enemy, assessedIntent } })} />
      </Field>
      <Field label="Enemy ground truth (facilitator only)">
        <TextArea value={s.enemy.groundTruth} onChange={(groundTruth) => set({ enemy: { ...s.enemy, groundTruth } })} />
      </Field>
      <Field label="Friendly">
        <TextArea value={s.friendly} onChange={(friendly) => set({ friendly })} />
      </Field>
      <Field label="Higher mission (one up)">
        <TextArea rows={2} value={s.higherMission} onChange={(higherMission) => set({ higherMission })} />
      </Field>
      <Field label="Higher intent (one up)">
        <TextArea rows={2} value={s.higherIntent} onChange={(higherIntent) => set({ higherIntent })} />
      </Field>
      <Field label="Higher intent two up">
        <TextArea rows={2} value={s.higherIntentTwoUp} onChange={(higherIntentTwoUp) => set({ higherIntentTwoUp })} />
      </Field>
      <Field label="Attachments / detachments">
        <TextArea rows={2} value={s.attachmentsDetachments} onChange={(attachmentsDetachments) => set({ attachmentsDetachments })} />
      </Field>
      <Field label="Civil considerations">
        <TextArea rows={2} value={s.civilConsiderations ?? ""} onChange={(civilConsiderations) => set({ civilConsiderations })} />
      </Field>
      <div className="grid-2">
        <Field label="Weather / conditions">
          <TextInput value={s.weatherLight.conditions} onChange={(conditions) => set({ weatherLight: { ...s.weatherLight, conditions } })} />
        </Field>
        <Field label="Visibility">
          <TextInput value={s.weatherLight.visibility ?? ""} onChange={(visibility) => set({ weatherLight: { ...s.weatherLight, visibility } })} />
        </Field>
        <Field label="Temperature">
          <TextInput value={s.weatherLight.temperature ?? ""} onChange={(temperature) => set({ weatherLight: { ...s.weatherLight, temperature } })} />
        </Field>
        <Field label="Moon illumination">
          <TextInput value={s.weatherLight.moonIllumination ?? ""} onChange={(moonIllumination) => set({ weatherLight: { ...s.weatherLight, moonIllumination } })} />
        </Field>
        <Field label="BMNT">
          <TextInput value={s.weatherLight.bmnt ?? ""} onChange={(bmnt) => set({ weatherLight: { ...s.weatherLight, bmnt } })} />
        </Field>
        <Field label="Sunrise">
          <TextInput value={s.weatherLight.sunrise ?? ""} onChange={(sunrise) => set({ weatherLight: { ...s.weatherLight, sunrise } })} />
        </Field>
        <Field label="Sunset">
          <TextInput value={s.weatherLight.sunset ?? ""} onChange={(sunset) => set({ weatherLight: { ...s.weatherLight, sunset } })} />
        </Field>
        <Field label="EENT">
          <TextInput value={s.weatherLight.eent ?? ""} onChange={(eent) => set({ weatherLight: { ...s.weatherLight, eent } })} />
        </Field>
      </div>
    </section>
  );
}

export function RequirementForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const r = scenario.requirement;
  return (
    <section>
      <div className="section-kicker">Requirement</div>
      <h2>What now?</h2>
      <Field label="Role">
        <TextArea rows={2} value={r.role} onChange={(role) => onChange({ ...scenario, requirement: { ...r, role } })} />
      </Field>
      <Field label="Perspective">
        <TextArea rows={2} value={r.perspective} onChange={(perspective) => onChange({ ...scenario, requirement: { ...r, perspective } })} />
      </Field>
      <Field label="Prompt">
        <TextInput value={r.prompt} onChange={(prompt) => onChange({ ...scenario, requirement: { ...r, prompt } })} />
      </Field>
      <Field label="Time limit (minutes)">
        <NumberInput min={1} value={r.timeLimitMinutes} onChange={(timeLimitMinutes) => onChange({ ...scenario, requirement: { ...r, timeLimitMinutes } })} />
      </Field>
      <div className="check-row">
        {DELIVERABLES.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={r.deliverables.includes(item)}
              onChange={(event) => {
                const deliverables = event.target.checked ? [...r.deliverables, item] : r.deliverables.filter((value) => value !== item);
                onChange({ ...scenario, requirement: { ...r, deliverables } });
              }}
            />
            {item.replaceAll("_", " ")}
          </label>
        ))}
      </div>
    </section>
  );
}

export function OutcomesForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const update = (index: number, patch: Partial<OutcomeState>) => {
    const outcomeStates = [...scenario.outcomeStates];
    const current = outcomeStates[index];
    if (!current) return;
    outcomeStates[index] = { ...current, ...patch };
    onChange({ ...scenario, outcomeStates });
  };

  return (
    <section>
      <div className="section-kicker">Outcome states</div>
      <h2>Terminal states, not branches</h2>
      <p className="hint">A time-expired / no-decision state is required. Indecision is an answer.</p>
      {scenario.outcomeStates.map((state, index) => (
        <div className="card" key={state.id}>
          <Field label="Label">
            <TextInput value={state.label} onChange={(label) => update(index, { label })} />
          </Field>
          <Field label="Description">
            <TextArea rows={2} value={state.description} onChange={(description) => update(index, { description })} />
          </Field>
          <Field label="Discussion hook">
            <TextInput value={state.discussionHook ?? ""} onChange={(discussionHook) => update(index, { discussionHook })} />
          </Field>
          <div className="grid-2">
            <Field label="Time elapsed (minutes)">
              <NumberInput
                min={0}
                value={state.stateDelta.timeElapsedMinutes}
                onChange={(timeElapsedMinutes) => update(index, { stateDelta: { ...state.stateDelta, timeElapsedMinutes } })}
              />
            </Field>
            <Field label="Kind">
              <Select
                value={state.kind ?? "standard"}
                options={[
                  { value: "standard", label: "standard" },
                  { value: "time_expired", label: "time expired" },
                ]}
                onChange={(kind) => update(index, { kind })}
              />
            </Field>
          </div>
          <Field label="Enemy state changes">
            <TextArea rows={2} value={state.stateDelta.enemyStateChanges} onChange={(enemyStateChanges) => update(index, { stateDelta: { ...state.stateDelta, enemyStateChanges } })} />
          </Field>
          <Field label="New information">
            <StringList
              values={state.stateDelta.newInformation}
              onChange={(newInformation) => update(index, { stateDelta: { ...state.stateDelta, newInformation } })}
              addLabel="Add information"
            />
          </Field>
          <button
            type="button"
            className="btn btn-danger"
            disabled={isTimeExpiredOutcome(state) && scenario.outcomeStates.filter(isTimeExpiredOutcome).length < 2}
            onClick={() =>
              onChange({
                ...scenario,
                outcomeStates: scenario.outcomeStates.filter((_, itemIndex) => itemIndex !== index),
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange({
            ...scenario,
            outcomeStates: [
              ...scenario.outcomeStates,
              {
                id: newId(),
                label: "New outcome",
                description: "",
                kind: "standard",
                stateDelta: { unitStatusChanges: [], timeElapsedMinutes: 0, newInformation: [], enemyStateChanges: "" },
              },
            ],
          })
        }
      >
        Add outcome
      </button>
    </section>
  );
}

export function NotesForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const notes = scenario.facilitatorNotes;
  return (
    <section>
      <div className="section-kicker">Facilitator notes</div>
      <h2>Plausible COAs, not a school solution</h2>
      <Field label="Ground truth">
        <TextArea value={notes.groundTruth} onChange={(groundTruth) => onChange({ ...scenario, facilitatorNotes: { ...notes, groundTruth } })} />
      </Field>
      <Field label="Discussion points">
        <StringList values={notes.discussionPoints} onChange={(discussionPoints) => onChange({ ...scenario, facilitatorNotes: { ...notes, discussionPoints } })} />
      </Field>
      <Field label="Teaching points">
        <StringList values={notes.teachingPoints} onChange={(teachingPoints) => onChange({ ...scenario, facilitatorNotes: { ...notes, teachingPoints } })} />
      </Field>
      <Field label="Common errors">
        <StringList values={notes.commonErrors} onChange={(commonErrors) => onChange({ ...scenario, facilitatorNotes: { ...notes, commonErrors } })} />
      </Field>
      <Field label="Historical basis">
        <TextArea rows={2} value={notes.historicalBasis ?? ""} onChange={(historicalBasis) => onChange({ ...scenario, facilitatorNotes: { ...notes, historicalBasis } })} />
      </Field>
      {notes.plausibleCOAs.map((coa, index) => (
        <div className="card" key={index}>
          <Field label="COA label">
            <TextInput
              value={coa.label}
              onChange={(label) => {
                const plausibleCOAs = [...notes.plausibleCOAs];
                plausibleCOAs[index] = { ...coa, label };
                onChange({ ...scenario, facilitatorNotes: { ...notes, plausibleCOAs } });
              }}
            />
          </Field>
          <Field label="Summary">
            <TextArea
              rows={2}
              value={coa.summary}
              onChange={(summary) => {
                const plausibleCOAs = [...notes.plausibleCOAs];
                plausibleCOAs[index] = { ...coa, summary };
                onChange({ ...scenario, facilitatorNotes: { ...notes, plausibleCOAs } });
              }}
            />
          </Field>
          <Field label="Tradeoffs">
            <TextArea
              rows={2}
              value={coa.tradeoffs}
              onChange={(tradeoffs) => {
                const plausibleCOAs = [...notes.plausibleCOAs];
                plausibleCOAs[index] = { ...coa, tradeoffs };
                onChange({ ...scenario, facilitatorNotes: { ...notes, plausibleCOAs } });
              }}
            />
          </Field>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              onChange({
                ...scenario,
                facilitatorNotes: { ...notes, plausibleCOAs: notes.plausibleCOAs.filter((_, itemIndex) => itemIndex !== index) },
              })
            }
          >
            Remove COA
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange({
            ...scenario,
            facilitatorNotes: { ...notes, plausibleCOAs: [...notes.plausibleCOAs, { label: "", summary: "", tradeoffs: "" }] },
          })
        }
      >
        Add plausible COA
      </button>
    </section>
  );
}

export function TerrainForm({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const terrain = scenario.terrain;
  if (!terrain) return <p>No embedded terrain. v1 scenarios carry terrain in the file.</p>;
  const effects = terrain.effects;
  return (
    <section>
      <div className="section-kicker">Terrain</div>
      <h2>OCOKA, not decoration</h2>
      <div className="grid-2">
        <Field label="Name">
          <TextInput value={terrain.name} onChange={(name) => onChange({ ...scenario, terrain: { ...terrain, name } })} />
        </Field>
        <Field label="Region">
          <TextInput value={terrain.region} onChange={(region) => onChange({ ...scenario, terrain: { ...terrain, region } })} />
        </Field>
        <Field label="Grid">
          <Select
            value={terrain.gridSystem}
            options={[
              { value: "notional", label: "notional" },
              { value: "MGRS", label: "MGRS" },
              { value: "none", label: "none" },
            ]}
            onChange={(gridSystem) => onChange({ ...scenario, terrain: { ...terrain, gridSystem } })}
          />
        </Field>
        <Field label="Extent (meters)">
          <NumberInput min={100} value={terrain.extentMeters} onChange={(extentMeters) => onChange({ ...scenario, terrain: { ...terrain, extentMeters } })} />
        </Field>
      </div>
      {(
        [
          ["observationAndFire", "Observation and fire"],
          ["coverAndConcealment", "Cover and concealment"],
          ["obstacles", "Obstacles"],
          ["keyTerrain", "Key terrain"],
          ["avenuesOfApproach", "Avenues of approach"],
          ["trafficability", "Trafficability"],
          ["seasonalState", "Seasonal state"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <TextArea rows={2} value={effects[key]} onChange={(value) => onChange({ ...scenario, terrain: { ...terrain, effects: { ...effects, [key]: value } } })} />
        </Field>
      ))}
    </section>
  );
}
