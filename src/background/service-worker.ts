import { getSettings } from "../lib/storage";
import { getFolderHandle, writeMarkdownFile } from "../lib/file-system";
import { buildFilename, buildFrontmatter } from "../lib/markdown-converter";
import { ExtensionSettings } from "../lib/types";

// ─── Context Menu Builder ─────────────────────────────────────────────────────
// Called at startup AND after folder config changes

async function rebuildContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();

  const settings = await getSettings();

  if (settings.folders.length === 0) {
    // No folders configured → single item that opens options
    chrome.contextMenus.create({
      id: "ms-open-settings",
      title: "MarkSave — Thêm thư mục để bắt đầu",
      contexts: ["selection", "page"],
    });
    return;
  }

  // Parent: save selection
  chrome.contextMenus.create({
    id: "ms-sel",
    title: "Lưu selection thành Markdown",
    contexts: ["selection"],
  });

  // Parent: save full page
  chrome.contextMenus.create({
    id: "ms-page",
    title: "Lưu trang thành Markdown",
    contexts: ["page"],
  });

  // Child: one item per folder under each parent
  settings.folders.forEach((folder) => {
    const isActive = folder.id === settings.activeFolderId;
    const label = isActive ? `★ ${folder.name}` : folder.name;

    chrome.contextMenus.create({
      id: `ms-sel-${folder.id}`,
      parentId: "ms-sel",
      title: label,
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: `ms-page-${folder.id}`,
      parentId: "ms-page",
      title: label,
      contexts: ["page"],
    });
  });
}

// ─── Startup: register menus immediately when service worker starts ───────────
// This ensures menus persist across extension reloads (onInstalled alone is not enough)

rebuildContextMenus();

// ─── On Install: open options page on first run ───────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
  rebuildContextMenus();
});

// ─── Context Menu Click Handler ───────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId as string;

  if (menuId === "ms-open-settings") {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (!tab?.id) return;

  if (menuId.startsWith("ms-sel-")) {
    const folderId = menuId.slice("ms-sel-".length);
    await handleSave(tab.id, "GET_SELECTION", "selection", folderId);
  } else if (menuId.startsWith("ms-page-")) {
    const folderId = menuId.slice("ms-page-".length);
    await handleSave(tab.id, "GET_FULL_PAGE", "full-page", folderId);
  }
});

// ─── Save Handler ─────────────────────────────────────────────────────────────

function buildFinalDocument(
  markdownBody: string,
  title: string,
  url: string,
  settings: ExtensionSettings
): string {
  if (!settings.addFrontmatter) return markdownBody;
  const frontmatter = buildFrontmatter(
    title,
    settings.includeSourceUrl ? url : "",
    settings.dateFormat
  );
  return frontmatter + markdownBody;
}

async function getContentFromTab(
  tabId: number,
  action: "GET_SELECTION" | "GET_FULL_PAGE"
): Promise<{ markdown: string; title: string; url: string } | null> {
  console.log("[MarkSave] getContentFromTab:", tabId, action);

  // Try messaging the existing content script
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { action });
    console.log("[MarkSave] sendMessage resp (direct):", resp);
    if (resp) return resp;
  } catch (e) {
    console.log("[MarkSave] sendMessage failed (will inject):", e);
  }

  try {
    console.log("[MarkSave] Injecting content script...");
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content-script.js"],
    });
    // Brief pause for script to register its listeners
    await new Promise<void>((r) => setTimeout(r, 300));
    const resp = await chrome.tabs.sendMessage(tabId, { action });
    console.log("[MarkSave] sendMessage resp (after inject):", resp);
    if (resp) return resp;
    console.log("[MarkSave] resp falsy after inject — returning null");
    showNotification("MarkSave — Lỗi", "Content script không phản hồi.");
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MarkSave] inject/sendMessage error:", msg);
    showNotification("MarkSave — Lỗi", `Không thể đọc trang: ${msg}`);
    return null;
  }
}

async function handleSave(
  tabId: number,
  action: "GET_SELECTION" | "GET_FULL_PAGE",
  selectionType: "selection" | "full-page",
  folderId: string
): Promise<void> {
  console.log("[MarkSave] handleSave:", { tabId, action, folderId });

  // 1. Get content from content script (with auto-inject fallback)
  // Note: Turndown conversion happens in content script (has DOM); SW has no document
  const response = await getContentFromTab(tabId, action);
  console.log("[MarkSave] response:", response ? { markdown: response.markdown?.slice(0, 50), title: response.title } : response);

  if (!response?.markdown) {
    const msg = response === null
      ? "(getContentFromTab returned null — already notified)"
      : "Không có nội dung để lưu (vui lòng bôi đen text trước).";
    console.log("[MarkSave] no markdown:", msg);
    if (response !== null) {
      showNotification("MarkSave", msg);
    }
    return;
  }

  const title = response.title || "Untitled";
  const url = response.url;

  // 2. Load settings
  const settings = await getSettings();
  const folderConfig = settings.folders.find(f => f.id === folderId);
  console.log("[MarkSave] folderConfig:", folderConfig);

  // 3. Get folder handle from IndexedDB
  const handle = await getFolderHandle(folderId);
  console.log("[MarkSave] handle:", handle ? `found: ${handle.name}` : "NOT FOUND");

  if (!handle) {
    showNotification("MarkSave — Lỗi", `Không tìm thấy thư mục "${folderConfig?.name ?? folderId}". Mở Cài đặt và thêm lại.`);
    chrome.runtime.openOptionsPage();
    return;
  }

  // 4. Build final document (frontmatter + markdown body) — no DOM needed
  const markdown = buildFinalDocument(response.markdown, title, url, settings);
  const filename = buildFilename(
    settings.filenameTemplate,
    title,
    url,
    settings.dateFormat
  );
  console.log("[MarkSave] writing file:", filename);

  // 5. Write file — try directly; catch permission errors explicitly
  try {
    await writeMarkdownFile(handle, filename, markdown);
    console.log("[MarkSave] file written OK");
    showNotification(
      "MarkSave ✓",
      `Đã lưu vào ${folderConfig?.name ?? "thư mục"}:\n${filename}`
    );
  } catch (err) {
    console.log("[MarkSave] writeMarkdownFile error:", err);
    const errName = err instanceof DOMException ? err.name : (err instanceof Error ? err.name : "");
    console.log("[MarkSave] errName:", errName);
    if (errName === "NotAllowedError" || errName === "SecurityError") {
      showNotification(
        "MarkSave — Cần cấp quyền",
        `Quyền truy cập thư mục "${folderConfig?.name}" đã hết hạn. Mở Cài đặt → click "Cấp quyền".`
      );
      chrome.runtime.openOptionsPage();
    } else {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      showNotification("MarkSave — Lỗi", `Không thể ghi file: ${message}`);
    }
  }
}

// ─── Notification Helper ──────────────────────────────────────────────────────

function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
  }
  if (message.action === "REBUILD_MENUS") {
    // Called from popup/options when folders change
    rebuildContextMenus();
  }
  return false;
});
