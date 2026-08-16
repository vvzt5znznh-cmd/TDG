# TDG Builder

A local-first authoring tool for Tactical Decision Games. One authoring pass produces a student handout and a facilitator packet. There is no account, no server, and no score.

A shared scenario **is** a `.tdg.json` file. Save is the primary persistence model. The browser cache is only a convenience.

## Run

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Open the app, create or duplicate a shipped example, then **Save** a `.tdg.json` file. Print routes use the browser’s print dialog (Save as PDF) once the checker reports no errors.

## v1

- Scenario authoring: meta, dilemma, situation, requirement, outcomes, facilitator notes
- Mission-type presets for outcome states, always including time-expired / no-decision
- Task organization tree with a per-scenario status overlay (list + diagram)
- Raster base map with symbol and control-measure overlays, student/facilitator layers, greyscale preview
- Validator (errors block print; warnings do not)
- Student handout and facilitator packet
- Explicit file open/save (File System Access API where available; download / file-input fallback)
- Eight original fictionalized example scenarios

Not in v1: vector terrain editor, force-template library, campaigns, student timer, scoring.

## Schema

`schemaVersion` is `1.0.0`. Unknown top-level keys are preserved on round-trip. The format is additive-only; see `src/schema/`.
