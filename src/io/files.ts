export function suggestedFileName(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "scenario";
  return `${slug}.tdg.json`;
}

export const FILE_PICKER_TYPES = [
  {
    description: "TDG scenario",
    accept: {
      "application/json": [".tdg.json", ".json"],
    },
  },
];

export function hasFilePicker(): boolean {
  return typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";
}

export async function pickOpenFile(): Promise<{ text: string; fileName: string; handle: FileSystemFileHandle | null } | null> {
  if (hasFilePicker() && window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: FILE_PICKER_TYPES,
    });
    const file = await handle.getFile();
    return { text: await file.text(), fileName: file.name, handle };
  }
  return pickOpenFileFallback();
}

function pickOpenFileFallback(): Promise<{ text: string; fileName: string; handle: null } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".tdg.json,application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then((text) => resolve({ text, fileName: file.name, handle: null }));
    });
    input.click();
  });
}

export async function saveToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function pickSaveFile(suggestedName: string, text: string): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker === "function") {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: FILE_PICKER_TYPES,
    });
    await saveToHandle(handle, text);
    return handle;
  }
  downloadText(text, suggestedName);
  return null;
}

export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
