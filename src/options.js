const DEFAULT_SETTINGS = {
  autoAnalyze: false,
  sidebarWidth: 420,
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  visualScanIntervalSeconds: 45,
  outputLanguage: "zh-CN",
  noteTone: "study-handout"
};

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("settings-status");
const testButton = document.getElementById("test-connection");
const chooseDirectoryButton = document.getElementById("choose-save-directory");
const clearDirectoryButton = document.getElementById("clear-save-directory");
const saveDirectoryStatus = document.getElementById("save-directory-status");

void init();

async function init() {
  const values = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const settings = normalizeSettings(values);
  await chrome.storage.sync.set({ outputLanguage: "zh-CN" });
  const localValues = await chrome.storage.local.get(["localSaveDirectoryName", "localSaveDirectoryConfiguredAt"]);

  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
      continue;
    }
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = Boolean(value);
      continue;
    }
    field.value = String(value);
  }

  await updateLocalDirectoryFields(localValues.localSaveDirectoryName || "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    autoAnalyze: formData.get("autoAnalyze") === "on",
    deepseekApiKey: String(formData.get("deepseekApiKey") || ""),
    deepseekBaseUrl: String(formData.get("deepseekBaseUrl") || DEFAULT_SETTINGS.deepseekBaseUrl),
    deepseekModel: String(formData.get("deepseekModel") || DEFAULT_SETTINGS.deepseekModel),
    visualScanIntervalSeconds: normalizeVisualScanInterval(formData.get("visualScanIntervalSeconds")),
    outputLanguage: "zh-CN",
    noteTone: String(formData.get("noteTone") || DEFAULT_SETTINGS.noteTone),
    sidebarWidth: Number(formData.get("sidebarWidth") || DEFAULT_SETTINGS.sidebarWidth)
  };

  await chrome.storage.sync.set(payload);
  statusNode.textContent = "已保存";
  window.setTimeout(() => {
    statusNode.textContent = "";
  }, 1800);
});

chooseDirectoryButton.addEventListener("click", async () => {
  if (typeof window.showDirectoryPicker !== "function") {
    saveDirectoryStatus.textContent = "当前浏览器不支持目录选择，请使用新版 Chrome。";
    return;
  }

  try {
    saveDirectoryStatus.textContent = "正在打开目录选择器...";
    const handle = await window.showDirectoryPicker({
      id: "mit-lecture-study-save-directory",
      mode: "readwrite"
    });
    const directoryApi = await loadLocalSaveDirectoryApi();
    const permission = await directoryApi.requestLocalSaveDirectoryPermission(handle);
    if (permission !== "granted") {
      saveDirectoryStatus.textContent = "目录没有写入权限，请重新选择并允许写入。";
      return;
    }

    await directoryApi.setLocalSaveDirectoryHandle(handle);
    await chrome.storage.local.set({
      localSaveDirectoryName: handle.name || "已选择目录",
      localSaveDirectoryConfiguredAt: new Date().toISOString()
    });
    await updateLocalDirectoryFields(handle.name || "已选择目录");
  } catch (error) {
    if (error?.name === "AbortError") {
      saveDirectoryStatus.textContent = "已取消选择目录。";
      return;
    }
    saveDirectoryStatus.textContent = `选择目录失败：${error instanceof Error ? error.message : String(error)}`;
  }
});

clearDirectoryButton.addEventListener("click", async () => {
  const directoryApi = await loadLocalSaveDirectoryApi();
  await directoryApi.clearLocalSaveDirectoryHandle();
  await chrome.storage.local.remove(["localSaveDirectoryName", "localSaveDirectoryConfiguredAt"]);
  await updateLocalDirectoryFields("");
});

testButton.addEventListener("click", async () => {
  statusNode.textContent = "正在测试...";
  await saveCurrentForm();

  try {
    const response = await chrome.runtime.sendMessage({ type: "TEST_DEEPSEEK_CONNECTION" });
    statusNode.textContent = response?.ok
      ? `连接成功：${response.result.model}`
      : `连接失败：${response?.error || "未知错误"}`;
  } catch (error) {
    statusNode.textContent = `连接失败：${error instanceof Error ? error.message : String(error)}`;
  }
});

async function saveCurrentForm() {
  const formData = new FormData(form);
  const payload = {
    autoAnalyze: formData.get("autoAnalyze") === "on",
    deepseekApiKey: String(formData.get("deepseekApiKey") || ""),
    deepseekBaseUrl: String(formData.get("deepseekBaseUrl") || DEFAULT_SETTINGS.deepseekBaseUrl),
    deepseekModel: String(formData.get("deepseekModel") || DEFAULT_SETTINGS.deepseekModel),
    visualScanIntervalSeconds: normalizeVisualScanInterval(formData.get("visualScanIntervalSeconds")),
    outputLanguage: "zh-CN",
    noteTone: String(formData.get("noteTone") || DEFAULT_SETTINGS.noteTone),
    sidebarWidth: Number(formData.get("sidebarWidth") || DEFAULT_SETTINGS.sidebarWidth)
  };

  await chrome.storage.sync.set(payload);
}

function normalizeSettings(stored = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    autoAnalyze: Boolean(stored.autoAnalyze),
    visualScanIntervalSeconds: normalizeVisualScanInterval(stored.visualScanIntervalSeconds),
    outputLanguage: "zh-CN"
  };

  return settings;
}

function normalizeVisualScanInterval(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return DEFAULT_SETTINGS.visualScanIntervalSeconds;
  }
  return Math.max(5, Math.min(300, Math.round(seconds)));
}

async function updateLocalDirectoryFields(directoryName) {
  const field = form.elements.namedItem("localSaveDirectoryName");
  if (field instanceof HTMLInputElement) {
    field.value = directoryName || "";
  }

  if (!directoryName) {
    saveDirectoryStatus.textContent = "还没有选择目录";
    return;
  }

  saveDirectoryStatus.textContent = `已选择：${directoryName}`;
  if (typeof window.showDirectoryPicker !== "function") {
    return;
  }

  try {
    const directoryApi = await loadLocalSaveDirectoryApi();
    const handlePermission = await directoryApi.queryLocalSaveDirectoryPermission(
      await directoryApi.getLocalSaveDirectoryHandle()
    );
    if (handlePermission && handlePermission !== "granted") {
      saveDirectoryStatus.textContent = `已选择：${directoryName}，但权限需要重新授权`;
    }
  } catch (_error) {
    // 状态提示不应阻断设置页加载。
  }
}

function loadLocalSaveDirectoryApi() {
  return import("./local-save-directory.js");
}
