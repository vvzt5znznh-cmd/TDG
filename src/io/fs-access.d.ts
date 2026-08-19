export type FilePickerType = {
  description: string;
  accept: Record<string, string[]>;
};

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: FilePickerType[];
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: FilePickerType[];
    }) => Promise<FileSystemFileHandle>;
  }
}
