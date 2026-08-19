import { isTimeExpiredOutcome } from "../../schema/presets";
import type { Scenario } from "../../schema/types";
import { Field, TextArea, TextInput } from "../fields";
import { NotesForm, TerrainForm } from "../forms";
import { TaskOrgEditor } from "../forces";

export function PacketView({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  return (
    <section>
      <p className="lede">Facilitator-only material. Students never see this page.</p>
      <Field label="Enemy ground truth">
        <TextArea
          rows={4}
          value={scenario.situation.enemy.groundTruth}
          onChange={(groundTruth) =>
            onChange({ ...scenario, situation: { ...scenario.situation, enemy: { ...scenario.situation.enemy, groundTruth } } })
          }
        />
      </Field>

      <h2>Outcome states</h2>
      <p className="hint">Filled from the mission type. Edit labels; you do not need the deltas unless this will sit in a campaign later.</p>
      {scenario.outcomeStates.map((state, index) => (
        <div className="card" key={state.id}>
          <Field label={isTimeExpiredOutcome(state) ? "Time-expired (required)" : "Label"}>
            <TextInput
              value={state.label}
              onChange={(label) => {
                const outcomeStates = [...scenario.outcomeStates];
                const current = outcomeStates[index];
                if (!current) return;
                outcomeStates[index] = { ...current, label };
                onChange({ ...scenario, outcomeStates });
              }}
            />
          </Field>
          <Field label="What happens">
            <TextArea
              rows={2}
              value={state.description}
              onChange={(description) => {
                const outcomeStates = [...scenario.outcomeStates];
                const current = outcomeStates[index];
                if (!current) return;
                outcomeStates[index] = { ...current, description };
                onChange({ ...scenario, outcomeStates });
              }}
            />
          </Field>
        </div>
      ))}

      <details className="more-block">
        <summary>Facilitator notes (discussion, COAs, teaching points)</summary>
        <NotesForm scenario={scenario} onChange={onChange} />
      </details>

      <details className="more-block">
        <summary>Terrain effects (OCOKA)</summary>
        <TerrainForm scenario={scenario} onChange={onChange} />
      </details>
      <details className="more-block">
        <summary>Force status (strength, ammo)</summary>
        <TaskOrgEditor scenario={scenario} onChange={onChange} />
      </details>
    </section>
  );
}
