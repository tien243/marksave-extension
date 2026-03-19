// Declarations for modules/APIs missing from current @types packages

declare module "turndown-plugin-gfm" {
  import TurndownService from "turndown";
  export function gfm(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}

// File System Access API extensions not yet in TypeScript DOM lib
interface FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | FileSystemHandle;
  }): Promise<FileSystemDirectoryHandle>;
}

declare function showDirectoryPicker(options?: {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | FileSystemHandle;
}): Promise<FileSystemDirectoryHandle>;
