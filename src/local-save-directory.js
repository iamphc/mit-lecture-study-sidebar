const DB_NAME = "mit-lecture-study-sidebar";
const DB_VERSION = 1;
const STORE_NAME = "file-handles";
const DIRECTORY_HANDLE_KEY = "local-save-directory";

export async function setLocalSaveDirectoryHandle(handle) {
  const db = await openLocalSaveDatabase();
  await putValue(db, DIRECTORY_HANDLE_KEY, handle);
}

export async function getLocalSaveDirectoryHandle() {
  const db = await openLocalSaveDatabase();
  return getValue(db, DIRECTORY_HANDLE_KEY);
}

export async function clearLocalSaveDirectoryHandle() {
  const db = await openLocalSaveDatabase();
  await deleteValue(db, DIRECTORY_HANDLE_KEY);
}

export async function queryLocalSaveDirectoryPermission(handle) {
  if (!handle || typeof handle.queryPermission !== "function") {
    return "denied";
  }
  return handle.queryPermission({ mode: "readwrite" });
}

export async function requestLocalSaveDirectoryPermission(handle) {
  if (!handle || typeof handle.requestPermission !== "function") {
    return "denied";
  }
  return handle.requestPermission({ mode: "readwrite" });
}

function openLocalSaveDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地保存目录数据库打开失败。"));
  });
}

function putValue(db, key, value) {
  return runStoreRequest(db, "readwrite", (store) => store.put(value, key));
}

function getValue(db, key) {
  return runStoreRequest(db, "readonly", (store) => store.get(key));
}

function deleteValue(db, key) {
  return runStoreRequest(db, "readwrite", (store) => store.delete(key));
}

function runStoreRequest(db, mode, buildRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = buildRequest(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地保存目录数据库操作失败。"));
    transaction.onerror = () => reject(transaction.error || new Error("本地保存目录数据库事务失败。"));
  });
}
