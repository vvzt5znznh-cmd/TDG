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

- Three tabs: **Write** (the TDG), **Map**, **Packet** (facilitator-only). Optional fields stay folded away.
- APP-6 unit symbols via [milsymbol](https://github.com/spatialillusions/milsymbol): pick friend/foe, echelon, and type, then stamp the map
- Upload a sketch/scan, then draw OBJ / phase line / woods / road / swamp
- Mission-type outcome presets, always including time-expired / no-decision
- Student handout and facilitator packet (browser Print / Save as PDF)
- Explicit file open/save; the browser cache is not the file
- Eight original fictionalized example scenarios

Not in v1: vector terrain editor, force-template library, campaigns, student timer, scoring.

## Schema

`schemaVersion` is `1.0.0`. Unknown top-level keys are preserved on round-trip. The format is additive-only; see `src/schema/`.
