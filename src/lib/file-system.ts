import { get, set, del } from "idb-keyval";

const HANDLE_KEY_PREFIX = "folder-handle-";

export async function saveFolderHandle(
  id: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  await set(HANDLE_KEY_PREFIX + id, handle);
}

export async function getFolderHandle(
  id: string
): Promise<FileSystemDirectoryHandle | undefined> {
  return await get<FileSystemDirectoryHandle>(HANDLE_KEY_PREFIX + id);
}

export async function deleteFolderHandle(id: string): Promise<void> {
  await del(HANDLE_KEY_PREFIX + id);
}

// Use in service worker (no user gesture available)
export async function queryPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" });
    return perm === "granted";
  } catch {
    return false;
  }
}

// Use in options/popup page (has user gesture — call inside a click handler)
export async function requestPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return true;
    const result = await handle.requestPermission({ mode: "readwrite" });
    return result === "granted";
  } catch {
    return false;
  }
}

export async function writeMarkdownFile(
  handle: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
