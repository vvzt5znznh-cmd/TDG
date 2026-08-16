import { buildOutcomeStates, isTimeExpiredOutcome, MISSION_TYPE_LABELS, outcomePresetsFor } from "../../schema/presets";
import { newId } from "../../schema/ids";
import { flattenTaskOrg, mapTaskOrg } from "../../schema/taskOrg";
import type { DilemmaType, Echelon, MissionType, Scenario, TaskOrgNode } from "../../schema/types";
import { Field, NumberInput, optionize, Select, TextArea, TextInput } from "../fields";

const ECHELONS: Echelon[] = ["fireteam", "squad", "platoon", "company", "battalion", "brigade"];
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

function outcomesStillPreset(scenario: Scenario, missionType: MissionType): boolean {
  const presetLabels = outcomePresetsFor(missionType).map((item) => item.label);
  const current = scenario.outcomeStates.filter((state) => !isTimeExpiredOutcome(state)).map((state) => state.label);
  return current.length === presetLabels.length && current.every((label, index) => label === presetLabels[index]);
}

function CompactTaskOrg({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const rows = flattenTaskOrg(scenario.forces.taskOrg);

  function setNode(id: string, patch: Partial<TaskOrgNode>) {
    onChange({
      ...scenario,
      forces: {
        ...scenario.forces,
        taskOrg: mapTaskOrg(scenario.forces.taskOrg, (node) => (node.id === id ? { ...node, ...patch } : node)),
      },
    });
  }

  return (
    <div>
      {rows.map(({ node, depth }) => (
        <div className="row" key={node.id} style={{ marginBottom: 6, paddingLeft: depth * 16 }}>
          <input type="text" value={node.designation} onChange={(event) => setNode(node.id, { designation: event.target.value })} />
          {node.id !== scenario.forces.taskOrg.id ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                function remove(root: TaskOrgNode): TaskOrgNode | null {
                  if (root.id === node.id) return null;
                  return { ...root, children: root.children.map(remove).filter((child): child is TaskOrgNode => child !== null) };
                }
                const next = remove(scenario.forces.taskOrg);
                if (!next) return;
                onChange({
                  ...scenario,
                  forces: {
                    ...scenario.forces,
                    taskOrg: next,
                    statusOverlay: scenario.forces.statusOverlay.filter((item) => item.taskOrgNodeId !== node.id),
                  },
                });
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => {
          const child: TaskOrgNode = { id: newId(), designation: "Squad", modifier: "none", children: [] };
          onChange({
            ...scenario,
            forces: {
              ...scenario.forces,
              taskOrg: mapTaskOrg(scenario.forces.taskOrg, (node) =>
                node.id === scenario.forces.taskOrg.id ? { ...node, children: [...node.children, child] } : node,
              ),
              statusOverlay: [
                ...scenario.forces.statusOverlay,
                { taskOrgNodeId: child.id, strength: { assigned: 0, effective: 0 }, ammunition: "full" },
              ],
            },
          });
        }}
      >
        Add unit
      </button>
    </div>
  );
}

export function WriteView({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const dep = scenario.dilemma.dependencies[0] ?? { kind: "force" as const, description: "" };

  return (
    <section className="write-view">
      <p className="lede">The problem the student has to solve. Map and facilitator notes are the other two tabs.</p>

      <Field label="Title">
        <TextInput value={scenario.title} onChange={(title) => onChange({ ...scenario, title })} />
      </Field>
      <div className="grid-3">
        <Field label="Echelon">
          <Select
            value={scenario.meta.echelon === "custom" ? "platoon" : scenario.meta.echelon}
            options={optionize(ECHELONS)}
            onChange={(echelon) => onChange({ ...scenario, meta: { ...scenario.meta, echelon } })}
          />
        </Field>
        <Field label="Mission">
          <Select
            value={scenario.meta.missionType}
            options={(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map((value) => ({ value, label: MISSION_TYPE_LABELS[value] }))}
            onChange={(missionType) => {
              const next = { ...scenario, meta: { ...scenario.meta, missionType } };
              if (outcomesStillPreset(scenario, scenario.meta.missionType)) next.outcomeStates = buildOutcomeStates(missionType);
              onChange(next);
            }}
          />
        </Field>
        <Field label="Time limit (min)">
          <NumberInput
            min={1}
            value={scenario.requirement.timeLimitMinutes}
            onChange={(timeLimitMinutes) => onChange({ ...scenario, requirement: { ...scenario.requirement, timeLimitMinutes } })}
          />
        </Field>
      </div>

      <h2>The dilemma</h2>
      <Field label="In one or two sentences, what is the tension?">
        <TextArea rows={3} value={scenario.dilemma.statement} onChange={(statement) => onChange({ ...scenario, dilemma: { ...scenario.dilemma, statement } })} />
      </Field>
      <div className="grid-2">
        <Field label="Type">
          <Select
            value={scenario.dilemma.type}
            options={optionize(DILEMMAS)}
            onChange={(type) => onChange({ ...scenario, dilemma: { ...scenario.dilemma, type } })}
          />
        </Field>
        <Field label="It hangs on">
          <Select
            value={dep.kind}
            options={optionize(["force", "terrain", "time", "information", "fires", "logistics", "civil", "weather"] as const)}
            onChange={(kind) =>
              onChange({
                ...scenario,
                dilemma: { ...scenario.dilemma, dependencies: [{ ...dep, kind }, ...scenario.dilemma.dependencies.slice(1)] },
              })
            }
          />
        </Field>
      </div>
      <Field label="Why that matters" hint="One line. Example: dismounts cannot take both objectives at once.">
        <TextInput
          value={dep.description}
          onChange={(description) =>
            onChange({
              ...scenario,
              dilemma: { ...scenario.dilemma, dependencies: [{ ...dep, description }, ...scenario.dilemma.dependencies.slice(1)] },
            })
          }
        />
      </Field>

      <h2>Situation</h2>
      <Field label="What's going on">
        <TextArea rows={4} value={scenario.situation.general} onChange={(general) => onChange({ ...scenario, situation: { ...scenario.situation, general } })} />
      </Field>
      <Field label="Enemy — what the student is told">
        <TextArea
          rows={3}
          value={scenario.situation.enemy.known}
          onChange={(known) => onChange({ ...scenario, situation: { ...scenario.situation, enemy: { ...scenario.situation.enemy, known } } })}
        />
      </Field>
      <Field label="Friendly">
        <TextArea rows={2} value={scenario.situation.friendly} onChange={(friendly) => onChange({ ...scenario, situation: { ...scenario.situation, friendly } })} />
      </Field>
      <div className="grid-2">
        <Field label="Higher intent (one up)">
          <TextArea rows={2} value={scenario.situation.higherIntent} onChange={(higherIntent) => onChange({ ...scenario, situation: { ...scenario.situation, higherIntent } })} />
        </Field>
        <Field label="Two up — required to print">
          <TextArea
            rows={2}
            value={scenario.situation.higherIntentTwoUp}
            onChange={(higherIntentTwoUp) => onChange({ ...scenario, situation: { ...scenario.situation, higherIntentTwoUp } })}
          />
        </Field>
      </div>

      <h2>What now?</h2>
      <Field label="You are…">
        <TextInput value={scenario.requirement.role} onChange={(role) => onChange({ ...scenario, requirement: { ...scenario.requirement, role } })} />
      </Field>
      <Field label="Prompt">
        <TextInput value={scenario.requirement.prompt} onChange={(prompt) => onChange({ ...scenario, requirement: { ...scenario.requirement, prompt } })} />
      </Field>

      <details className="more-block">
        <summary>Your force (names)</summary>
        <CompactTaskOrg scenario={scenario} onChange={onChange} />
      </details>

      <details className="more-block">
        <summary>More (optional)</summary>
        <Field label="Higher mission">
          <TextArea rows={2} value={scenario.situation.higherMission} onChange={(higherMission) => onChange({ ...scenario, situation: { ...scenario.situation, higherMission } })} />
        </Field>
        <Field label="Assessed enemy intent">
          <TextArea
            rows={2}
            value={scenario.situation.enemy.assessedIntent}
            onChange={(assessedIntent) =>
              onChange({ ...scenario, situation: { ...scenario.situation, enemy: { ...scenario.situation.enemy, assessedIntent } } })
            }
          />
        </Field>
        <Field label="Where you are standing">
          <TextArea rows={2} value={scenario.requirement.perspective} onChange={(perspective) => onChange({ ...scenario, requirement: { ...scenario.requirement, perspective } })} />
        </Field>
        <Field label="Attachments / detachments">
          <TextArea
            rows={2}
            value={scenario.situation.attachmentsDetachments}
            onChange={(attachmentsDetachments) => onChange({ ...scenario, situation: { ...scenario.situation, attachmentsDetachments } })}
          />
        </Field>
        <Field label="Weather">
          <TextInput
            value={scenario.situation.weatherLight.conditions}
            onChange={(conditions) => onChange({ ...scenario, situation: { ...scenario.situation, weatherLight: { ...scenario.situation.weatherLight, conditions } } })}
          />
        </Field>
        <div className="grid-3">
          <Field label="Region">
            <TextInput
              value={scenario.meta.setting.region}
              onChange={(region) => onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, region } } })}
            />
          </Field>
          <Field label="Season">
            <TextInput
              value={scenario.meta.setting.season}
              onChange={(season) => onChange({ ...scenario, meta: { ...scenario.meta, setting: { ...scenario.meta.setting, season } } })}
            />
          </Field>
          <Field label="Author">
            <TextInput value={scenario.meta.author} onChange={(author) => onChange({ ...scenario, meta: { ...scenario.meta, author } })} />
          </Field>
        </div>
      </details>
    </section>
  );
}
