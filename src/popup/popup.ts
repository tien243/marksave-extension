import { get } from "idb-keyval";
import { ExtensionSettings, DEFAULT_SETTINGS } from "../lib/types";

const HANDLE_KEY_PREFIX = "folder-handle-";

async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve(result as ExtensionSettings);
    });
  });
}

async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

async function setActiveFolderId(id: string, settings: ExtensionSettings): Promise<void> {
  settings.activeFolderId = id;
  await saveSettings(settings);
  chrome.runtime.sendMessage({ action: "REBUILD_MENUS" }).catch(() => {});
}

async function checkPermission(id: string): Promise<boolean> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY_PREFIX + id);
    if (!handle) return false;
    const perm = await handle.queryPermission({ mode: "readwrite" });
    return perm === "granted";
  } catch {
    return false;
  }
}

// NOTE: showDirectoryPicker is NOT available in extension popups (not a top-level
// browsing context). Folder management must be done in the options page (full tab).
// regrantPermission also needs user gesture + top-level context — send to options page.

async function renderPopup(settings: ExtensionSettings): Promise<void> {
  const activeFolderName = document.getElementById("active-folder-name")!;
  const folderList = document.getElementById("folder-list")!;
  const folderListSection = document.getElementById("folder-list-section")!;
  const noFoldersMsg = document.getElementById("no-folders-msg")!;
  const permissionWarning = document.getElementById("permission-warning")!;

  permissionWarning.classList.add("hidden");

  if (settings.folders.length === 0) {
    activeFolderName.textContent = "Chưa cấu hình";
    folderListSection.classList.add("hidden");
    noFoldersMsg.classList.remove("hidden");
    return;
  }

  noFoldersMsg.classList.add("hidden");

  const activeFolder = settings.folders.find(f => f.id === settings.activeFolderId)
    ?? settings.folders[0];
  activeFolderName.textContent = activeFolder?.name ?? "—";

  // Check if active folder has permission
  if (activeFolder) {
    const hasPerm = await checkPermission(activeFolder.id);
    if (!hasPerm) {
      permissionWarning.classList.remove("hidden");
    }
  }

  // Render folder switcher list (only if more than 1 folder)
  if (settings.folders.length <= 1) {
    folderListSection.classList.add("hidden");
    return;
  }

  folderListSection.classList.remove("hidden");
  folderList.innerHTML = "";
  settings.folders.forEach((folder) => {
    const isActive = folder.id === (settings.activeFolderId || settings.folders[0]?.id);
    const li = document.createElement("li");
    li.className = isActive ? "active" : "";
    li.innerHTML = `
      <span class="check">${isActive ? "✓" : ""}</span>
      <span class="name">${escapeHtml(folder.name)}</span>
    `;
    li.addEventListener("click", async () => {
      if (!isActive) {
        await setActiveFolderId(folder.id, settings);
        const updated = await loadSettings();
        await renderPopup(updated);
      }
    });
    folderList.appendChild(li);
  });
}

function openOptions(): void {
  chrome.runtime.openOptionsPage();
  window.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();
  await renderPopup(settings);

  // "Thêm thư mục" → open options page (showDirectoryPicker only works in full tab)
  document.getElementById("add-folder-quick-btn")?.addEventListener("click", openOptions);

  // "Cấp lại quyền" → open options page (requestPermission also needs full tab context)
  document.getElementById("regrant-btn")?.addEventListener("click", openOptions);

  document.getElementById("open-settings-btn")!.addEventListener("click", openOptions);
});
