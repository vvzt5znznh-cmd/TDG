import type { IssueCode, ValidationResult } from "../validator/validate";

const PRINT_NEEDED: Partial<Record<IssueCode, string>> = {
  dilemma_statement_empty: "Write the dilemma",
  dilemma_dependencies_empty: "Fill “Why that matters”",
  higher_intent_two_up_empty: "Fill two-up intent",
  time_limit_missing: "Set a time limit",
  deliverables_empty: "Pick deliverables",
  no_time_expired_outcome: "Keep a no-decision outcome",
  too_few_outcome_states: "Need at least 3 outcomes",
  map_missing_scale_or_north: "Map needs scale and north",
};

export function ValidatorPanel({ result, compact }: { result: ValidationResult; compact?: boolean }) {
  if (compact) {
    if (result.ok) {
      return <span className="check-pill ok">Ready to print</span>;
    }
    const needed = result.errors
      .slice(0, 3)
      .map((issue) => PRINT_NEEDED[issue.code] ?? issue.message.split(".")[0])
      .join(" · ");
    return (
      <span className="check-pill" title={result.errors.map((issue) => issue.message).join("\n")}>
        Still need: {needed}
      </span>
    );
  }
  return (
    <aside className="panel">
      <div className="section-kicker">Checker</div>
      <h2>{result.ok ? "Ready to print" : "Export blocked"}</h2>
      {result.errors.map((issue) => (
        <div className="issue" key={`${issue.code}-${issue.path}`}>
          {issue.message}
        </div>
      ))}
      {result.warnings.map((issue) => (
        <div className="issue warn" key={`${issue.code}-${issue.path}`}>
          {issue.message}
        </div>
      ))}
    </aside>
  );
}
