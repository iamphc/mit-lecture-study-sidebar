const DEFAULT_SETTINGS = {
  autoAnalyze: false,
  sidebarWidth: 420,
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  visualScanIntervalSeconds: 45,
  uiLanguage: "auto",
  outputLanguage: "auto",
  noteTone: "study-handout"
};

const {
  createTranslator,
  resolveUiLanguage,
  normalizeLanguage
} = globalThis.MitStudyI18n;

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("settings-status");
const testButton = document.getElementById("test-connection");
const chooseDirectoryButton = document.getElementById("choose-save-directory");
const clearDirectoryButton = document.getElementById("clear-save-directory");
const saveDirectoryStatus = document.getElementById("save-directory-status");
let currentSettings = { ...DEFAULT_SETTINGS };
let currentLanguage = resolveUiLanguage(currentSettings);
let t = createTranslator(currentLanguage);

void init();

async function init() {
  const values = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const settings = normalizeSettings(values);
  currentSettings = settings;
  applyLocale(settings);
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

form.elements.namedItem("uiLanguage")?.addEventListener("change", () => {
  currentSettings = {
    ...currentSettings,
    uiLanguage: String(form.elements.namedItem("uiLanguage")?.value || DEFAULT_SETTINGS.uiLanguage)
  };
  applyLocale(currentSettings);
  void updateLocalDirectoryFields(String(form.elements.namedItem("localSaveDirectoryName")?.value || ""));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    autoAnalyze: formData.get("autoAnalyze") === "on",
    deepseekApiKey: String(formData.get("deepseekApiKey") || ""),
    deepseekBaseUrl: String(formData.get("deepseekBaseUrl") || DEFAULT_SETTINGS.deepseekBaseUrl),
    deepseekModel: String(formData.get("deepseekModel") || DEFAULT_SETTINGS.deepseekModel),
    visualScanIntervalSeconds: normalizeVisualScanInterval(formData.get("visualScanIntervalSeconds")),
    uiLanguage: normalizeLanguageSetting(formData.get("uiLanguage"), DEFAULT_SETTINGS.uiLanguage),
    outputLanguage: normalizeOutputLanguage(formData.get("outputLanguage")),
    noteTone: String(formData.get("noteTone") || DEFAULT_SETTINGS.noteTone),
    sidebarWidth: Number(formData.get("sidebarWidth") || DEFAULT_SETTINGS.sidebarWidth)
  };

  await chrome.storage.sync.set(payload);
  currentSettings = normalizeSettings(payload);
  applyLocale(currentSettings);
  statusNode.textContent = t("settingsSaved");
  window.setTimeout(() => {
    statusNode.textContent = "";
  }, 1800);
});

chooseDirectoryButton.addEventListener("click", async () => {
  if (typeof window.showDirectoryPicker !== "function") {
    saveDirectoryStatus.textContent = t("directoryPickerUnsupported");
    return;
  }

  try {
    saveDirectoryStatus.textContent = t("directoryPickerOpening");
    const handle = await window.showDirectoryPicker({
      id: "mit-lecture-study-save-directory",
      mode: "readwrite"
    });
    const directoryApi = await loadLocalSaveDirectoryApi();
    const permission = await directoryApi.requestLocalSaveDirectoryPermission(handle);
    if (permission !== "granted") {
      saveDirectoryStatus.textContent = t("directoryPermissionDenied");
      return;
    }

    await directoryApi.setLocalSaveDirectoryHandle(handle);
    await chrome.storage.local.set({
      localSaveDirectoryName: handle.name || t("directorySelectedFallback"),
      localSaveDirectoryConfiguredAt: new Date().toISOString()
    });
    await updateLocalDirectoryFields(handle.name || t("directorySelectedFallback"));
  } catch (error) {
    if (error?.name === "AbortError") {
      saveDirectoryStatus.textContent = t("directoryPickCanceled");
      return;
    }
    saveDirectoryStatus.textContent = t("directoryPickFailed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

clearDirectoryButton.addEventListener("click", async () => {
  const directoryApi = await loadLocalSaveDirectoryApi();
  await directoryApi.clearLocalSaveDirectoryHandle();
  await chrome.storage.local.remove(["localSaveDirectoryName", "localSaveDirectoryConfiguredAt"]);
  await updateLocalDirectoryFields("");
});

testButton.addEventListener("click", async () => {
  statusNode.textContent = t("testingConnection");
  await saveCurrentForm();

  try {
    const response = await chrome.runtime.sendMessage({ type: "TEST_DEEPSEEK_CONNECTION" });
    statusNode.textContent = response?.ok
      ? t("connectionSuccess", { model: response.result.model })
      : t("connectionFailed", { message: response?.error || t("unknownError") });
  } catch (error) {
    statusNode.textContent = t("connectionFailed", {
      message: error instanceof Error ? error.message : String(error)
    });
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
    uiLanguage: normalizeLanguageSetting(formData.get("uiLanguage"), DEFAULT_SETTINGS.uiLanguage),
    outputLanguage: normalizeOutputLanguage(formData.get("outputLanguage")),
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
    uiLanguage: normalizeLanguageSetting(stored.uiLanguage, DEFAULT_SETTINGS.uiLanguage),
    outputLanguage: normalizeOutputLanguage(stored.outputLanguage)
  };

  return settings;
}

function normalizeLanguageSetting(value, fallback = "auto") {
  const text = String(value || fallback);
  return text === "auto" ? "auto" : normalizeLanguage(text);
}

function normalizeOutputLanguage(value) {
  return normalizeLanguageSetting(value, DEFAULT_SETTINGS.outputLanguage);
}

function applyLocale(settings) {
  currentLanguage = resolveUiLanguage(settings);
  t = createTranslator(currentLanguage);
  document.documentElement.lang = currentLanguage === "zh-CN" ? "zh-CN" : "en";
  document.title = t("optionsTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
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
    saveDirectoryStatus.textContent = t("directoryNotSelected");
    return;
  }

  saveDirectoryStatus.textContent = t("directorySelected", { directoryName });
  if (typeof window.showDirectoryPicker !== "function") {
    return;
  }

  try {
    const directoryApi = await loadLocalSaveDirectoryApi();
    const handlePermission = await directoryApi.queryLocalSaveDirectoryPermission(
      await directoryApi.getLocalSaveDirectoryHandle()
    );
    if (handlePermission && handlePermission !== "granted") {
      saveDirectoryStatus.textContent = t("directoryReauthNeeded", { directoryName });
    }
  } catch (_error) {
    // 状态提示不应阻断设置页加载。
  }
}

function loadLocalSaveDirectoryApi() {
  return import("./local-save-directory.js");
}
