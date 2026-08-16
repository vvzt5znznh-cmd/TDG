# AGENTS.md

## Cursor Cloud specific instructions

TDG Builder is a single local-first frontend app (Vite + React 19 + TypeScript). There is no backend, database, or account system — a scenario is a `.tdg.json` file, and persistence is done through explicit file Save/Open plus an IndexedDB convenience cache.

Standard commands live in `package.json` (`README.md` documents `dev`/`test`/`build`). Notes that aren't obvious from those:

- Dependencies are installed by the startup update script (`npm ci`); you do not need to reinstall on a fresh cloud VM.
- Dev server: `npm run dev` serves on `http://localhost:5173/`. Run it as a long-lived process (e.g. a tmux terminal), not in `install`/`start`.
- Lint: `npm run lint` runs `oxlint`. It exits 0 with only `react(only-export-components)` warnings on the current tree — those are pre-existing and not a failure.
- Tests: `npm test` runs Vitest once (`vitest run`); `npm run test:watch` for watch mode. Tests are pure unit tests (`src/**/*.test.ts`), no server needed.
- Build: `npm run build` runs `tsc -b` then `vite build`.
- File System Access API (native Save/Open dialogs) is only available in some browsers; elsewhere the app falls back to download + file-input, so "Save" may trigger a file download rather than a native dialog.
