import { create } from "zustand";
import { cacheDraft, loadDraft, rememberRecent } from "../io/cache";
import { downloadText, hasFilePicker, pickOpenFile, pickSaveFile, saveToHandle, suggestedFileName } from "../io/files";
import { createNewFile, duplicateScenarioFile } from "../schema/create";
import { nowIso } from "../schema/ids";
import { parseTDGFileText, serializeTDGFile } from "../schema/parse";
import { isScenario, type MissionType, type Scenario, type TDGFile } from "../schema/types";

export interface DocumentStore {
  file: TDGFile;
  fileName: string | null;
  handle: FileSystemFileHandle | null;
  dirty: boolean;
  status: string;
  cacheOnly: boolean;
  ready: boolean;
  loadError: string | null;
  newScenario: (missionType?: MissionType) => void;
  loadFromFile: (file: TDGFile, fileName?: string | null, handle?: FileSystemFileHandle | null) => void;
  openFromDisk: () => Promise<boolean>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  duplicate: () => void;
  updateScenario: (updater: (scenario: Scenario) => Scenario) => void;
  setAsset: (ref: string, dataUrl: string) => void;
  setStatus: (status: string) => void;
  hydrateFromCache: () => Promise<void>;
}

let cacheTimer: ReturnType<typeof setTimeout> | null = null;

function persistSoon(get: () => DocumentStore): void {
  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    const state = get();
    void cacheDraft(state.file, state.fileName, state.dirty);
    void rememberRecent(state.file, state.fileName);
  }, 400);
}

function touch(file: TDGFile): TDGFile {
  return { ...file, modified: nowIso() };
}

export const useDocument = create<DocumentStore>((set, get) => ({
  file: createNewFile(),
  fileName: null,
  handle: null,
  dirty: false,
  status: "Unsaved — cache is not a substitute for Save.",
  cacheOnly: true,
  ready: false,
  loadError: null,

  newScenario: (missionType) => {
    set({
      file: createNewFile({ missionType }),
      fileName: null,
      handle: null,
      dirty: true,
      cacheOnly: true,
      status: "New scenario. Save a file — the cache is only a convenience.",
      loadError: null,
    });
    persistSoon(get);
  },

  loadFromFile: (file, fileName = null, handle = null) => {
    set({
      file,
      fileName,
      handle,
      dirty: false,
      cacheOnly: !handle && !fileName,
      status: fileName ? `Opened ${fileName}` : "Loaded scenario",
      loadError: null,
    });
    persistSoon(get);
  },

  openFromDisk: async () => {
    try {
      const picked = await pickOpenFile();
      if (!picked) return false;
      const file = parseTDGFileText(picked.text);
      get().loadFromFile(file, picked.fileName, picked.handle);
      return true;
    } catch (error) {
      set({ loadError: error instanceof Error ? error.message : "Could not open file" });
      return false;
    }
  },

  save: async () => {
    const { file, handle, fileName } = get();
    const text = serializeTDGFile(file);
    const name = fileName ?? suggestedFileName(isScenario(file.content) ? file.content.title : "scenario");
    try {
      if (handle) {
        await saveToHandle(handle, text);
        set({ dirty: false, cacheOnly: false, fileName: name, status: `Saved ${name}` });
      } else if (hasFilePicker()) {
        await get().saveAs();
        return;
      } else {
        downloadText(text, name);
        set({ dirty: false, cacheOnly: false, fileName: name, status: `Downloaded ${name} — keep that file; the cache is not a backup.` });
      }
      persistSoon(get);
    } catch (error) {
      set({ loadError: error instanceof Error ? error.message : "Could not save file" });
    }
  },

  saveAs: async () => {
    const { file } = get();
    const name = suggestedFileName(isScenario(file.content) ? file.content.title : "scenario");
    try {
      const handle = await pickSaveFile(name, serializeTDGFile(file));
      set({
        handle,
        fileName: name,
        dirty: false,
        cacheOnly: handle == null,
        status: handle ? `Saved ${name}` : `Downloaded ${name} — that download is the file.`,
      });
      persistSoon(get);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      set({ loadError: error instanceof Error ? error.message : "Could not save file" });
    }
  },

  duplicate: () => {
    const copy = duplicateScenarioFile(get().file);
    set({
      file: copy,
      fileName: null,
      handle: null,
      dirty: true,
      cacheOnly: true,
      status: "Duplicated as a new scenario. Save a new file.",
    });
    persistSoon(get);
  },

  updateScenario: (updater) => {
    const { file } = get();
    if (!isScenario(file.content)) return;
    const content = updater(file.content);
    set({
      file: touch({ ...file, content }),
      dirty: true,
      status: "Unsaved changes. Save the file — cache is only a convenience.",
    });
    persistSoon(get);
  },

  setAsset: (ref, dataUrl) => {
    const { file } = get();
    set({
      file: touch({
        ...file,
        assets: { ...file.assets, [ref]: dataUrl },
      }),
      dirty: true,
      status: "Unsaved changes. Save the file — cache is only a convenience.",
    });
    persistSoon(get);
  },

  setStatus: (status) => set({ status }),

  hydrateFromCache: async () => {
    try {
      const draft = await loadDraft();
      if (draft) {
        set({
          file: draft.file,
          fileName: draft.fileName,
          dirty: draft.dirty,
          cacheOnly: true,
          ready: true,
          status: draft.dirty
            ? "Restored from local cache. This is not your file — use Save."
            : "Restored from local cache. Open or save a file to persist.",
        });
        return;
      }
    } catch {
      // IndexedDB may be unavailable; start with a blank file.
    }
    set({ ready: true });
  },
}));
