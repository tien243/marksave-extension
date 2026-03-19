/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./node_modules/idb-keyval/dist/index.js
function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        // @ts-ignore - file size hacks
        request.onabort = request.onerror = () => reject(request.error);
    });
}
function createStore(dbName, storeName) {
    let dbp;
    const getDB = () => {
        if (dbp)
            return dbp;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        dbp = promisifyRequest(request);
        dbp.then((db) => {
            // It seems like Safari sometimes likes to just close the connection.
            // It's supposed to fire this event when that happens. Let's hope it does!
            db.onclose = () => (dbp = undefined);
        }, () => { });
        return dbp;
    };
    return (txMode, callback) => getDB().then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
let defaultGetStoreFunc;
function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }
    return defaultGetStoreFunc;
}
/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function get(key, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}
/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}
/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function setMany(entries, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        entries.forEach((entry) => store.put(entry[1], entry[0]));
        return promisifyRequest(store.transaction);
    });
}
/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function getMany(keys, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => Promise.all(keys.map((key) => promisifyRequest(store.get(key)))));
}
/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function update(key, updater, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => 
    // Need to create the promise manually.
    // If I try to chain promises, the transaction closes in browsers
    // that use a promise polyfill (IE10/11).
    new Promise((resolve, reject) => {
        store.get(key).onsuccess = function () {
            try {
                store.put(updater(this.result), key);
                resolve(promisifyRequest(store.transaction));
            }
            catch (err) {
                reject(err);
            }
        };
    }));
}
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function del(key, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.delete(key);
        return promisifyRequest(store.transaction);
    });
}
/**
 * Delete multiple keys at once.
 *
 * @param keys List of keys to delete.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function delMany(keys, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        keys.forEach((key) => store.delete(key));
        return promisifyRequest(store.transaction);
    });
}
/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function clear(customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.clear();
        return promisifyRequest(store.transaction);
    });
}
function eachCursor(store, callback) {
    store.openCursor().onsuccess = function () {
        if (!this.result)
            return;
        callback(this.result);
        this.result.continue();
    };
    return promisifyRequest(store.transaction);
}
/**
 * Get all keys in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function keys(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        if (store.getAllKeys) {
            return promisifyRequest(store.getAllKeys());
        }
        const items = [];
        return eachCursor(store, (cursor) => items.push(cursor.key)).then(() => items);
    });
}
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function values(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        if (store.getAll) {
            return promisifyRequest(store.getAll());
        }
        const items = [];
        return eachCursor(store, (cursor) => items.push(cursor.value)).then(() => items);
    });
}
/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function entries(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        // (although, hopefully we'll get a simpler path some day)
        if (store.getAll && store.getAllKeys) {
            return Promise.all([
                promisifyRequest(store.getAllKeys()),
                promisifyRequest(store.getAll()),
            ]).then(([keys, values]) => keys.map((key, i) => [key, values[i]]));
        }
        const items = [];
        return customStore('readonly', (store) => eachCursor(store, (cursor) => items.push([cursor.key, cursor.value])).then(() => items));
    });
}



;// ./src/lib/types.ts
const DEFAULT_SETTINGS = {
    filenameTemplate: "{title}-{date}",
    dateFormat: "YYYY-MM-DD",
    addFrontmatter: true,
    includeSourceUrl: true,
    showNotification: true,
    activeFolderId: "",
    folders: [],
};

;// ./src/options/options.ts


const HANDLE_KEY_PREFIX = "folder-handle-";
// ─── State ────────────────────────────────────────────────────────────────────
let settings = { ...DEFAULT_SETTINGS };
// ─── DOM Helpers ──────────────────────────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
function showError(msg) {
    const el = $("folder-error");
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 4000);
}
// ─── Settings Load ────────────────────────────────────────────────────────────
async function loadSettings() {
    await new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
            settings = result;
            resolve();
        });
    });
    // Populate form fields
    document.getElementById("filename-template").value =
        settings.filenameTemplate;
    const dateRadios = document.querySelectorAll('input[name="date-format"]');
    dateRadios.forEach((r) => {
        r.checked = r.value === settings.dateFormat;
    });
    document.getElementById("add-frontmatter").checked =
        settings.addFrontmatter;
    document.getElementById("include-source-url").checked =
        settings.includeSourceUrl;
    document.getElementById("show-notification").checked =
        settings.showNotification;
    renderFolderTable();
}
// ─── Folder Table Render ──────────────────────────────────────────────────────
function renderFolderTable() {
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
    tbody.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === "set-active") {
                settings.activeFolderId = id;
                await persistSettings();
                renderFolderTable();
                updateContextMenus();
            }
            else if (action === "regrant") {
                // requestPermission MUST be called inside a click handler (user gesture)
                const handle = await get(HANDLE_KEY_PREFIX + id);
                if (!handle) {
                    showError("Không tìm thấy thư mục trong IndexedDB. Hãy xóa và thêm lại.");
                    return;
                }
                const result = await handle.requestPermission({ mode: "readwrite" });
                if (result === "granted") {
                    const badge = document.getElementById(`perm-${id}`);
                    if (badge)
                        badge.classList.add("hidden");
                    const pathEl = document.getElementById(`path-${id}`);
                    if (pathEl)
                        pathEl.style.color = "";
                }
                else {
                    showError("Không thể cấp quyền. Hãy thử xóa và thêm lại thư mục.");
                }
            }
            else if (action === "remove") {
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
async function loadFolderPath(id) {
    const handle = await get(HANDLE_KEY_PREFIX + id);
    const el = document.getElementById(`path-${id}`);
    const badge = document.getElementById(`perm-${id}`);
    if (handle) {
        if (el) {
            el.textContent = handle.name;
            el.title = handle.name;
        }
        // Check permission
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted" && badge) {
            badge.classList.remove("hidden");
        }
    }
    else if (el) {
        el.textContent = "(không tìm thấy — hãy xóa và thêm lại)";
        el.style.color = "#c0392b";
    }
}
// ─── Add Folder ───────────────────────────────────────────────────────────────
async function addFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: "readwrite" });
        const id = crypto.randomUUID();
        const name = handle.name;
        await set(HANDLE_KEY_PREFIX + id, handle);
        const newFolder = { id, name };
        settings.folders.push(newFolder);
        if (!settings.activeFolderId) {
            settings.activeFolderId = id;
        }
        await persistSettings();
        renderFolderTable();
        updateContextMenus();
    }
    catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            // User cancelled — do nothing
            return;
        }
        showError("Không thể chọn thư mục: " + (err instanceof Error ? err.message : String(err)));
    }
}
// ─── Save Settings ────────────────────────────────────────────────────────────
async function saveAllSettings() {
    settings.filenameTemplate =
        document.getElementById("filename-template").value.trim() ||
            "{title}-{date}";
    const selectedDateFormat = document.querySelector('input[name="date-format"]:checked');
    settings.dateFormat = (selectedDateFormat?.value ?? "YYYY-MM-DD");
    settings.addFrontmatter = document.getElementById("add-frontmatter").checked;
    settings.includeSourceUrl = document.getElementById("include-source-url").checked;
    settings.showNotification = document.getElementById("show-notification").checked;
    await persistSettings();
    const status = $("save-status");
    status.classList.remove("hidden");
    setTimeout(() => status.classList.add("hidden"), 2000);
}
async function persistSettings() {
    await new Promise((resolve) => {
        chrome.storage.sync.set(settings, resolve);
    });
}
function updateContextMenus() {
    chrome.runtime.sendMessage({ action: "REBUILD_MENUS" }).catch(() => {
        // Service worker may not be listening — ignore
    });
}
// ─── Utils ────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
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

/******/ })()
;