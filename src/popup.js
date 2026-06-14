const youtubeButton = document.getElementById("open-youtube");
const settingsButton = document.getElementById("open-settings");
const statusNode = document.getElementById("popup-status");

youtubeButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_YOUTUBE" });
  statusNode.textContent = "已打开 MIT YouTube 搜索。";
});

settingsButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
  statusNode.textContent = "已打开插件设置。";
});
