import { ExtensionSettings, DEFAULT_SETTINGS } from "./types";

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve(result as ExtensionSettings);
    });
  });
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

export async function getActiveFolderId(): Promise<string> {
  const settings = await getSettings();
  return settings.activeFolderId;
}

export async function setActiveFolderId(id: string): Promise<void> {
  const settings = await getSettings();
  settings.activeFolderId = id;
  await saveSettings(settings);
}
