const { createTranslator, resolveUiLanguage } = globalThis.MitStudyI18n;
const youtubeButton = document.getElementById("open-youtube");
const settingsButton = document.getElementById("open-settings");
const statusNode = document.getElementById("popup-status");
const t = createTranslator(resolveUiLanguage({ uiLanguage: "auto" }));

document.documentElement.lang = resolveUiLanguage({ uiLanguage: "auto" }) === "zh-CN" ? "zh-CN" : "en";
document.title = t("appName");
document.querySelectorAll("[data-i18n]").forEach((node) => {
  node.textContent = t(node.dataset.i18n);
});

youtubeButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_YOUTUBE" });
  statusNode.textContent = t("youtubeOpened");
});

settingsButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
  statusNode.textContent = t("settingsOpened");
});
