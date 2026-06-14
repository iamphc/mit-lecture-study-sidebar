const DEFAULT_SETTINGS = {
  sidebarWidth: 420,
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaVisionModel: "qwen2.5vl:3b",
  outputLanguage: "zh-CN",
  noteTone: "study-handout"
};

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("settings-status");
const testButton = document.getElementById("test-connection");
const testOllamaButton = document.getElementById("test-ollama");

void init();

async function init() {
  const values = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const settings = normalizeSettings(values);
  await chrome.storage.sync.set({ outputLanguage: "zh-CN" });

  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
      continue;
    }
    field.value = String(value);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    deepseekApiKey: String(formData.get("deepseekApiKey") || ""),
    deepseekBaseUrl: String(formData.get("deepseekBaseUrl") || DEFAULT_SETTINGS.deepseekBaseUrl),
    deepseekModel: String(formData.get("deepseekModel") || DEFAULT_SETTINGS.deepseekModel),
    ollamaBaseUrl: String(formData.get("ollamaBaseUrl") || DEFAULT_SETTINGS.ollamaBaseUrl),
    ollamaVisionModel: String(formData.get("ollamaVisionModel") || DEFAULT_SETTINGS.ollamaVisionModel),
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

testOllamaButton.addEventListener("click", async () => {
  statusNode.textContent = "正在测试本地视觉模型...";
  await saveCurrentForm();

  try {
    const response = await chrome.runtime.sendMessage({ type: "TEST_OLLAMA_CONNECTION" });
    statusNode.textContent = response?.ok
      ? `本地视觉模型可用：${response.result.model}`
      : `本地视觉模型不可用：${response?.error || "未知错误"}`;
  } catch (error) {
    statusNode.textContent = `本地视觉模型不可用：${error instanceof Error ? error.message : String(error)}`;
  }
});

async function saveCurrentForm() {
  const formData = new FormData(form);
  const payload = {
    deepseekApiKey: String(formData.get("deepseekApiKey") || ""),
    deepseekBaseUrl: String(formData.get("deepseekBaseUrl") || DEFAULT_SETTINGS.deepseekBaseUrl),
    deepseekModel: String(formData.get("deepseekModel") || DEFAULT_SETTINGS.deepseekModel),
    ollamaBaseUrl: String(formData.get("ollamaBaseUrl") || DEFAULT_SETTINGS.ollamaBaseUrl),
    ollamaVisionModel: String(formData.get("ollamaVisionModel") || DEFAULT_SETTINGS.ollamaVisionModel),
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
    outputLanguage: "zh-CN"
  };

  return settings;
}
