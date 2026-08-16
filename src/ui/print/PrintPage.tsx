import { Link } from "react-router-dom";
import type { Audience, Scenario } from "../../schema/types";
import { useDocument } from "../../store/document";
import { TaskOrgDiagram, TaskOrgList } from "../forces";
import { MapView } from "../map/MapView";

const DELIVERABLE_LABEL: Record<string, string> = {
  frag_order: "Fragmentary order",
  sketch: "Sketch",
  rationale: "Rationale",
  task_organization: "Task organization",
  priority_of_work: "Priority of work",
  fire_support_plan: "Fire support plan",
  custom: "Custom",
};

export function PrintDocument({
  scenario,
  assets,
  audience,
}: {
  scenario: Scenario;
  assets?: Record<string, string>;
  audience: Audience;
}) {
  const map = scenario.maps[0];
  const imageRef = map && map.base.kind === "raster" ? map.base.imageRef : "";
  const terrain = scenario.terrain;
  const facilitator = audience === "facilitator";

  return (
    <article className="print-root">
      <div className="print-banner">
        <span>Tactical decision game</span>
        <span>{facilitator ? "Facilitator packet" : "Student handout"}</span>
        <span>{scenario.meta.setting.fictionalized ? "Fictionalized" : "Check provenance"}</span>
      </div>
      <h1 className="print-title">{scenario.title}</h1>
      <p>
        <strong>{scenario.meta.echelon}</strong> · {scenario.meta.missionType.replaceAll("_", " ")} · {scenario.meta.domain} ·{" "}
        {scenario.requirement.timeLimitMinutes} min time limit · est. {scenario.meta.estimatedMinutes} min
      </p>
      <p>
        <strong>Role.</strong> {scenario.requirement.role}
      </p>

      <h2>Situation</h2>
      <p>{scenario.situation.general}</p>
      <p>
        <strong>Enemy (known).</strong> {scenario.situation.enemy.known}
      </p>
      <p>
        <strong>Assessed intent.</strong> {scenario.situation.enemy.assessedIntent}
      </p>
      {facilitator ? (
        <p>
          <strong>Enemy ground truth.</strong> {scenario.situation.enemy.groundTruth}
        </p>
      ) : null}
      <p>
        <strong>Friendly.</strong> {scenario.situation.friendly}
      </p>
      <p>
        <strong>Weather / light.</strong> {scenario.situation.weatherLight.conditions}
        {scenario.situation.weatherLight.visibility ? ` · vis ${scenario.situation.weatherLight.visibility}` : ""}
        {scenario.situation.weatherLight.temperature ? ` · ${scenario.situation.weatherLight.temperature}` : ""}
      </p>

      <h2>Higher headquarters</h2>
      <p>
        <strong>Mission (one up).</strong> {scenario.situation.higherMission}
      </p>
      <p>
        <strong>Intent (one up).</strong> {scenario.situation.higherIntent}
      </p>
      <p>
        <strong>Intent (two up).</strong> {scenario.situation.higherIntentTwoUp}
      </p>
      <p>
        <strong>Attachments / detachments.</strong> {scenario.situation.attachmentsDetachments}
      </p>

      <h2>Task organization</h2>
      <TaskOrgList root={scenario.forces.taskOrg} overlay={scenario.forces.statusOverlay} />
      <div style={{ marginTop: 12 }}>
        <TaskOrgDiagram root={scenario.forces.taskOrg} overlay={scenario.forces.statusOverlay} />
      </div>
      {scenario.forces.supportingArms.length > 0 ? (
        <p>
          <strong>Supporting arms.</strong>{" "}
          {scenario.forces.supportingArms.map((asset) => `${asset.type} (${asset.availability})`).join("; ")}
        </p>
      ) : null}

      {map ? (
        <>
          <h2>Map</h2>
          <MapView
            map={map}
            imageUrl={imageRef ? assets?.[imageRef] : undefined}
            audience={facilitator ? "all" : "student"}
          />
        </>
      ) : null}

      {terrain ? (
        <>
          <h2>Terrain effects</h2>
          <div className="ocoka">
            <div><strong>O.</strong> {terrain.effects.observationAndFire}</div>
            <div><strong>C.</strong> {terrain.effects.coverAndConcealment}</div>
            <div><strong>O.</strong> {terrain.effects.obstacles}</div>
            <div><strong>K.</strong> {terrain.effects.keyTerrain}</div>
            <div><strong>A.</strong> {terrain.effects.avenuesOfApproach}</div>
            <div><strong>T.</strong> {terrain.effects.trafficability}</div>
            <div style={{ gridColumn: "1 / -1" }}><strong>Season.</strong> {terrain.effects.seasonalState}</div>
          </div>
        </>
      ) : null}

      <h2>Requirement</h2>
      <p>
        <strong>Perspective.</strong> {scenario.requirement.perspective}
      </p>
      <p>
        <strong>{scenario.requirement.prompt}</strong>
      </p>
      <p>
        Produce: {scenario.requirement.deliverables.map((item) => DELIVERABLE_LABEL[item] ?? item).join(", ")} in{" "}
        {scenario.requirement.timeLimitMinutes} minutes.
      </p>

      {facilitator ? (
        <>
          <h2>Outcome states</h2>
          {scenario.outcomeStates.map((state) => (
            <div key={state.id} style={{ marginBottom: 10 }}>
              <strong>{state.label}.</strong> {state.description}
              {state.stateDelta.enemyStateChanges ? ` Enemy: ${state.stateDelta.enemyStateChanges}` : ""}
              {state.discussionHook ? ` Hook: ${state.discussionHook}` : ""}
            </div>
          ))}
          <h2>Facilitator notes</h2>
          <p>
            <strong>Ground truth.</strong> {scenario.facilitatorNotes.groundTruth}
          </p>
          {scenario.facilitatorNotes.discussionPoints.length > 0 ? (
            <p>
              <strong>Discussion.</strong> {scenario.facilitatorNotes.discussionPoints.join(" · ")}
            </p>
          ) : null}
          {scenario.facilitatorNotes.teachingPoints.length > 0 ? (
            <p>
              <strong>Teaching points.</strong> {scenario.facilitatorNotes.teachingPoints.join(" · ")}
            </p>
          ) : null}
          {scenario.facilitatorNotes.commonErrors.length > 0 ? (
            <p>
              <strong>Common errors.</strong> {scenario.facilitatorNotes.commonErrors.join(" · ")}
            </p>
          ) : null}
          {scenario.facilitatorNotes.plausibleCOAs.map((coa) => (
            <p key={coa.label}>
              <strong>{coa.label}.</strong> {coa.summary} <em>Tradeoffs:</em> {coa.tradeoffs}
            </p>
          ))}
          {scenario.facilitatorNotes.historicalBasis ? (
            <p>
              <strong>Historical basis.</strong> {scenario.facilitatorNotes.historicalBasis}
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export function PrintPage({ audience }: { audience: Audience }) {
  const file = useDocument((state) => state.file);
  const scenario = "dilemma" in file.content ? file.content : null;
  if (!scenario) return <p>Open a scenario first.</p>;
  return (
    <>
      <div className="screen-only">
        <Link to="/edit">Back to editor</Link>
        {" · "}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <span className="hint"> Use the browser print dialog. Line weights are set for A4, not the screen.</span>
      </div>
      <PrintDocument scenario={scenario} assets={file.assets} audience={audience} />
    </>
  );
}
