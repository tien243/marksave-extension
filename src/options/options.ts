import { get, set, del } from "idb-keyval";
import { ExtensionSettings, FolderConfig, DEFAULT_SETTINGS, DateFormat } from "../lib/types";

const HANDLE_KEY_PREFIX = "folder-handle-";

// ─── State ────────────────────────────────────────────────────────────────────

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function showError(msg: string): void {
  const el = $("folder-error");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

// ─── Settings Load ────────────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      settings = result as ExtensionSettings;
      resolve();
    });
  });

  // Populate form fields
  (document.getElementById("filename-template") as HTMLInputElement).value =
    settings.filenameTemplate;

  const dateRadios = document.querySelectorAll<HTMLInputElement>(
    'input[name="date-format"]'
  );
  dateRadios.forEach((r) => {
    r.checked = r.value === settings.dateFormat;
  });

  (document.getElementById("add-frontmatter") as HTMLInputElement).checked =
    settings.addFrontmatter;
  (document.getElementById("include-source-url") as HTMLInputElement).checked =
    settings.includeSourceUrl;
  (document.getElementById("show-notification") as HTMLInputElement).checked =
    settings.showNotification;

  renderFolderTable();
}

// ─── Folder Table Render ──────────────────────────────────────────────────────

function renderFolderTable(): void {
  const tbody = $("folder-tbody");
  tbody.innerHTML = "";

  if (settings.folders.length === 0) {
    tbody.innerHTML = `<tr id="no-folders-row"><td colspan="3" class="empty-state">Chưa có thư mục nào. Hãy thêm thư mục bên dưới.</td></tr>`;
    return;
  }

  settings.folders.forEach((folder) => {
    const isActive = folder.id === settings.activeFolderId;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="folder-name">
          ${isActive ? '<span class="active-star">★</span>' : '<span style="width:18px;display:inline-block"></span>'}
          ${escapeHtml(folder.name)}
        </div>
      </td>
      <td><span class="folder-path" id="path-${folder.id}">...</span><span class="perm-badge hidden" id="perm-${folder.id}">⚠️ Cần cấp quyền</span></td>
      <td>
        <div class="action-btns">
          ${!isActive ? `<button class="btn btn-secondary btn-sm" data-action="set-active" data-id="${folder.id}">Mặc định</button>` : `<span style="color:#0d7377;font-size:12px">Đang dùng</span>`}
          <button class="btn btn-warning btn-sm" data-action="regrant" data-id="${folder.id}">Cấp quyền</button>
          <button class="btn btn-danger btn-sm" data-action="remove" data-id="${folder.id}">Xóa</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Load folder name and check permission asynchronously
    loadFolderPath(folder.id);
  });

  // Attach action listeners
  tbody.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action!;
      const id = btn.dataset.id!;
      if (action === "set-active") {
        settings.activeFolderId = id;
        await persistSettings();
        renderFolderTable();
        updateContextMenus();
      } else if (action === "regrant") {
        // requestPermission MUST be called inside a click handler (user gesture)
        const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY_PREFIX + id);
        if (!handle) { showError("Không tìm thấy thư mục trong IndexedDB. Hãy xóa và thêm lại."); return; }
        const result = await handle.requestPermission({ mode: "readwrite" });
        if (result === "granted") {
          const badge = document.getElementById(`perm-${id}`);
          if (badge) badge.classList.add("hidden");
          const pathEl = document.getElementById(`path-${id}`);
          if (pathEl) pathEl.style.color = "";
        } else {
          showError("Không thể cấp quyền. Hãy thử xóa và thêm lại thư mục.");
        }
      } else if (action === "remove") {
        settings.folders = settings.folders.filter((f) => f.id !== id);
        if (settings.activeFolderId === id) {
          settings.activeFolderId = settings.folders[0]?.id ?? "";
        }
        await del(HANDLE_KEY_PREFIX + id);
        await persistSettings();
        renderFolderTable();
        updateContextMenus();
      }
    });
  });
}

async function loadFolderPath(id: string): Promise<void> {
  const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY_PREFIX + id);
  const el = document.getElementById(`path-${id}`);
  const badge = document.getElementById(`perm-${id}`);

  if (handle) {
    if (el) { el.textContent = handle.name; el.title = handle.name; }
    // Check permission
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted" && badge) {
      badge.classList.remove("hidden");
    }
  } else if (el) {
    el.textContent = "(không tìm thấy — hãy xóa và thêm lại)";
    el.style.color = "#c0392b";
  }
}

// ─── Add Folder ───────────────────────────────────────────────────────────────

async function addFolder(): Promise<void> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });

    const id = crypto.randomUUID();
    const name = handle.name;

    await set(HANDLE_KEY_PREFIX + id, handle);

    const newFolder: FolderConfig = { id, name };
    settings.folders.push(newFolder);

    if (!settings.activeFolderId) {
      settings.activeFolderId = id;
    }

    await persistSettings();
    renderFolderTable();
    updateContextMenus();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // User cancelled — do nothing
      return;
    }
    showError("Không thể chọn thư mục: " + (err instanceof Error ? err.message : String(err)));
  }
}

// ─── Save Settings ────────────────────────────────────────────────────────────

async function saveAllSettings(): Promise<void> {
  settings.filenameTemplate =
    (document.getElementById("filename-template") as HTMLInputElement).value.trim() ||
    "{title}-{date}";

  const selectedDateFormat = document.querySelector<HTMLInputElement>(
    'input[name="date-format"]:checked'
  );
  settings.dateFormat = (selectedDateFormat?.value ?? "YYYY-MM-DD") as DateFormat;

  settings.addFrontmatter = (document.getElementById("add-frontmatter") as HTMLInputElement).checked;
  settings.includeSourceUrl = (document.getElementById("include-source-url") as HTMLInputElement).checked;
  settings.showNotification = (document.getElementById("show-notification") as HTMLInputElement).checked;

  await persistSettings();

  const status = $("save-status");
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 2000);
}

async function persistSettings(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

function updateContextMenus(): void {
  chrome.runtime.sendMessage({ action: "REBUILD_MENUS" }).catch(() => {
    // Service worker may not be listening — ignore
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();

  $("add-folder-btn").addEventListener("click", addFolder);
  $("save-btn").addEventListener("click", saveAllSettings);
});
