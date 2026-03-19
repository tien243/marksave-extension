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

;// ./src/popup/popup.ts


const HANDLE_KEY_PREFIX = "folder-handle-";
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
            resolve(result);
        });
    });
}
async function saveSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.sync.set(settings, resolve);
    });
}
async function setActiveFolderId(id, settings) {
    settings.activeFolderId = id;
    await saveSettings(settings);
    chrome.runtime.sendMessage({ action: "REBUILD_MENUS" }).catch(() => { });
}
async function checkPermission(id) {
    try {
        const handle = await get(HANDLE_KEY_PREFIX + id);
        if (!handle)
            return false;
        const perm = await handle.queryPermission({ mode: "readwrite" });
        return perm === "granted";
    }
    catch {
        return false;
    }
}
// NOTE: showDirectoryPicker is NOT available in extension popups (not a top-level
// browsing context). Folder management must be done in the options page (full tab).
// regrantPermission also needs user gesture + top-level context — send to options page.
async function renderPopup(settings) {
    const activeFolderName = document.getElementById("active-folder-name");
    const folderList = document.getElementById("folder-list");
    const folderListSection = document.getElementById("folder-list-section");
    const noFoldersMsg = document.getElementById("no-folders-msg");
    const permissionWarning = document.getElementById("permission-warning");
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
function openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
}
function escapeHtml(str) {
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
    document.getElementById("open-settings-btn").addEventListener("click", openOptions);
});

/******/ })()
;