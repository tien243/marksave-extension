export interface FolderConfig {
  id: string;
  name: string;
}

export type DateFormat = "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";

export interface ExtensionSettings {
  filenameTemplate: string;
  dateFormat: DateFormat;
  addFrontmatter: boolean;
  includeSourceUrl: boolean;
  showNotification: boolean;
  activeFolderId: string;
  folders: FolderConfig[];
}

export interface ClipData {
  html: string;
  title: string;
  url: string;
  selectionType: "selection" | "full-page";
}

export interface SaveResult {
  success: boolean;
  filename?: string;
  folderName?: string;
  error?: string;
}

export type MessageAction =
  | "GET_SELECTION"
  | "GET_FULL_PAGE"
  | "OPEN_OPTIONS"
  | "SAVE_COMPLETE"
  | "PERMISSION_NEEDED";

export interface Message {
  action: MessageAction;
  payload?: unknown;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  filenameTemplate: "{title}-{date}",
  dateFormat: "YYYY-MM-DD",
  addFrontmatter: true,
  includeSourceUrl: true,
  showNotification: true,
  activeFolderId: "",
  folders: [],
};
