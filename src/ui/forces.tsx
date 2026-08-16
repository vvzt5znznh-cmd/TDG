import { formatDesignation, flattenTaskOrg, mapTaskOrg } from "../schema/taskOrg";
import { newId } from "../schema/ids";
import type { Scenario, SupplyLevel, TaskOrgModifier, TaskOrgNode, UnitStatus } from "../schema/types";
import { Field, NumberInput, Select, TextInput } from "./fields";

function statusFor(scenario: Scenario, id: string): UnitStatus | undefined {
  return scenario.forces.statusOverlay.find((item) => item.taskOrgNodeId === id);
}

function upsertStatus(scenario: Scenario, status: UnitStatus): Scenario {
  const existing = scenario.forces.statusOverlay.some((item) => item.taskOrgNodeId === status.taskOrgNodeId);
  return {
    ...scenario,
    forces: {
      ...scenario.forces,
      statusOverlay: existing
        ? scenario.forces.statusOverlay.map((item) => (item.taskOrgNodeId === status.taskOrgNodeId ? status : item))
        : [...scenario.forces.statusOverlay, status],
    },
  };
}

function defaultStatus(id: string): UnitStatus {
  return { taskOrgNodeId: id, strength: { assigned: 0, effective: 0 }, ammunition: "full" };
}

function removeNode(root: TaskOrgNode, id: string): TaskOrgNode | null {
  if (root.id === id) return null;
  return { ...root, children: root.children.map((child) => removeNode(child, id)).filter((child): child is TaskOrgNode => child !== null) };
}

export function TaskOrgList({ root, overlay }: { root: TaskOrgNode; overlay: UnitStatus[] }) {
  return (
    <div className="org-list">
      {flattenTaskOrg(root).map(({ node, depth }) => {
        const status = overlay.find((item) => item.taskOrgNodeId === node.id);
        const strength = status ? `${status.strength.effective}/${status.strength.assigned}` : "";
        const ammo = status ? ` ammo ${status.ammunition}` : "";
        return (
          <div key={node.id} style={{ paddingLeft: depth * 16 }}>
            {formatDesignation(node)}
            {strength ? `  ${strength}` : ""}
            {ammo}
            {status?.casualties ? `  ${status.casualties}` : ""}
          </div>
        );
      })}
    </div>
  );
}

export function TaskOrgDiagram({ root, overlay }: { root: TaskOrgNode; overlay: UnitStatus[] }) {
  function NodeView({ node }: { node: TaskOrgNode }) {
    const status = overlay.find((item) => item.taskOrgNodeId === node.id);
    return (
      <div className="org-node">
        <div className="org-box">
          <div>{formatDesignation(node)}</div>
          {status ? (
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {status.strength.effective}/{status.strength.assigned} · {status.ammunition}
            </div>
          ) : null}
        </div>
        {node.children.length > 0 ? (
          <div className="org-children">
            {node.children.map((child) => (
              <NodeView key={child.id} node={child} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="org-tree">
      <NodeView node={root} />
    </div>
  );
}

function NodeEditor({
  node,
  scenario,
  onChange,
}: {
  node: TaskOrgNode;
  scenario: Scenario;
  onChange: (scenario: Scenario) => void;
}) {
  const status = statusFor(scenario, node.id) ?? defaultStatus(node.id);
  const setNode = (patch: Partial<TaskOrgNode>) =>
    onChange({
      ...scenario,
      forces: {
        ...scenario.forces,
        taskOrg: mapTaskOrg(scenario.forces.taskOrg, (item) => (item.id === node.id ? { ...item, ...patch } : item)),
      },
    });

  return (
    <div className="card">
      <div className="grid-2">
        <Field label="Designation">
          <TextInput value={node.designation} onChange={(designation) => setNode({ designation })} />
        </Field>
        <Field label="Modifier">
          <Select
            value={node.modifier}
            options={[
              { value: "none", label: "none" },
              { value: "reinforced", label: "reinforced (+)" },
              { value: "reduced", label: "reduced (−)" },
            ] satisfies { value: TaskOrgModifier; label: string }[]}
            onChange={(modifier) => setNode({ modifier })}
          />
        </Field>
      </div>
      <Field label="Attached from">
        <TextInput value={node.attachedFrom ?? ""} onChange={(attachedFrom) => setNode({ attachedFrom })} />
      </Field>
      <div className="grid-3">
        <Field label="Assigned">
          <NumberInput
            min={0}
            value={status.strength.assigned}
            onChange={(assigned) => onChange(upsertStatus(scenario, { ...status, strength: { ...status.strength, assigned } }))}
          />
        </Field>
        <Field label="Effective">
          <NumberInput
            min={0}
            value={status.strength.effective}
            onChange={(effective) => onChange(upsertStatus(scenario, { ...status, strength: { ...status.strength, effective } }))}
          />
        </Field>
        <Field label="Ammunition">
          <Select
            value={status.ammunition}
            options={["full", "adequate", "low", "black"].map((value) => ({ value: value as SupplyLevel, label: value }))}
            onChange={(ammunition) => onChange(upsertStatus(scenario, { ...status, ammunition }))}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Fuel">
          <Select
            value={status.fuel ?? "full"}
            options={["full", "adequate", "low", "black"].map((value) => ({ value: value as SupplyLevel, label: value }))}
            onChange={(fuel) => onChange(upsertStatus(scenario, { ...status, fuel }))}
          />
        </Field>
        <Field label="Casualties / notes">
          <TextInput
            value={status.casualties ?? status.notes ?? ""}
            onChange={(casualties) => onChange(upsertStatus(scenario, { ...status, casualties }))}
          />
        </Field>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const child: TaskOrgNode = { id: newId(), designation: "New unit", modifier: "none", children: [] };
            onChange({
              ...upsertStatus(scenario, defaultStatus(child.id)),
              forces: {
                ...scenario.forces,
                taskOrg: mapTaskOrg(scenario.forces.taskOrg, (item) =>
                  item.id === node.id ? { ...item, children: [...item.children, child] } : item,
                ),
                statusOverlay: [...(upsertStatus(scenario, defaultStatus(child.id)).forces.statusOverlay)],
              },
            });
          }}
        >
          Add subordinate
        </button>
        {node.id !== scenario.forces.taskOrg.id ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const nextRoot = removeNode(scenario.forces.taskOrg, node.id);
              if (!nextRoot) return;
              onChange({
                ...scenario,
                forces: {
                  ...scenario.forces,
                  taskOrg: nextRoot,
                  statusOverlay: scenario.forces.statusOverlay.filter((item) => item.taskOrgNodeId !== node.id),
                },
              });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="task-node-editor">
        {node.children.map((child) => (
          <NodeEditor key={child.id} node={child} scenario={scenario} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

export function TaskOrgEditor({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  return (
    <section>
      <div className="section-kicker">Forces</div>
      <h2>Task organization</h2>
      <p className="hint">Status is a per-scenario overlay. It does not edit a force template.</p>
      <NodeEditor node={scenario.forces.taskOrg} scenario={scenario} onChange={onChange} />
      <h3>Indented list</h3>
      <TaskOrgList root={scenario.forces.taskOrg} overlay={scenario.forces.statusOverlay} />
      <h3>Diagram</h3>
      <TaskOrgDiagram root={scenario.forces.taskOrg} overlay={scenario.forces.statusOverlay} />
      <h3>Supporting arms</h3>
      {scenario.forces.supportingArms.map((asset, index) => (
        <div className="card" key={index}>
          <Field label="Type">
            <TextInput
              value={asset.type}
              onChange={(type) => {
                const supportingArms = [...scenario.forces.supportingArms];
                supportingArms[index] = { ...asset, type };
                onChange({ ...scenario, forces: { ...scenario.forces, supportingArms } });
              }}
            />
          </Field>
          <Field label="Availability">
            <TextInput
              value={asset.availability}
              onChange={(availability) => {
                const supportingArms = [...scenario.forces.supportingArms];
                supportingArms[index] = { ...asset, availability };
                onChange({ ...scenario, forces: { ...scenario.forces, supportingArms } });
              }}
            />
          </Field>
          <button
            type="button"
            className="btn"
            onClick={() =>
              onChange({
                ...scenario,
                forces: { ...scenario.forces, supportingArms: scenario.forces.supportingArms.filter((_, itemIndex) => itemIndex !== index) },
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
            forces: { ...scenario.forces, supportingArms: [...scenario.forces.supportingArms, { type: "", availability: "" }] },
          })
        }
      >
        Add supporting arm
      </button>
    </section>
  );
}
