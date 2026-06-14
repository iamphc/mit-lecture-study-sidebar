const SIDEBAR_HOST_ID = "mit-study-sidebar-host";
const APP_ROOT_ID = "mit-study-sidebar-root";
const LIBRARY_INDEX_KEY = "lectureLibrary:index";
const LIBRARY_SEARCH_TEXT_LIMIT = 60000;
const STUDY_PACK_CACHE_VERSION = "outline-zh-v1";
const VISIBLE_TABS = new Set(["outline", "visual", "library"]);
const DEFAULT_SETTINGS = {
  sidebarWidth: 420,
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  outputLanguage: "zh-CN",
  noteTone: "study-handout"
};

const PAGE_BRIDGE_REQUEST_TIMEOUT_MS = 8000;
const PAGE_BRIDGE_LOAD_TIMEOUT_MS = 3000;
const AUTO_STUDY_PACK_DELAY_MS = 400;
const VISUAL_SAMPLE_START_DELAY_MS = 6000;
const VISUAL_SAMPLE_INTERVAL_MS = 45000;
const VISUAL_MIN_SECONDS_BETWEEN_FRAMES = 35;
const VISUAL_FRAME_MAX_WIDTH = 720;
const VISUAL_FRAME_JPEG_QUALITY = 0.72;
const VISUAL_SIGNATURE_WIDTH = 12;
const VISUAL_SIGNATURE_HEIGHT = 7;
const VISUAL_SIGNATURE_DIFF_THRESHOLD = 0.12;
const VISUAL_MAX_ANALYSIS_ITEMS = 32;
const INNERTUBE_ANDROID_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "20.10.38",
  userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
  osName: "Android",
  osVersion: "11"
};

const UI_TEXT = {
  brand: "MIT 课程学习",
  openLectureTitle: "打开一个课程视频",
  readyState: "准备状态",
  readyCopy: "打开 YouTube 上的 MIT 课程视频，然后自动生成中文大纲。",
  title: "课程大纲侧边栏",
  loadingCaptions: "正在读取课程内容...",
  generateStudyPack: "重新生成",
  generating: "正在生成...",
  progressIdle: "等待开始",
  progressPreparing: "准备生成大纲",
  progressCaptionFetching: "正在读取课程内容",
  progressCaptionInitialData: "正在检查页面里的课程文字记录",
  progressCaptionTranscriptApi: "正在读取 YouTube 文字记录接口",
  progressCaptionPlayer: "正在读取播放器课程内容",
  progressCaptionTrack: (current, total) => `正在解析字幕轨道 ${current}/${total}`,
  progressCaptionAndroidPlayer: "正在尝试备用播放器课程内容",
  progressCaptionReady: "课程内容已准备",
  progressDeepSeekPreparing: "正在准备 DeepSeek 分析",
  progressDeepSeekChunk: (current, total) => `DeepSeek 正在分析第 ${current}/${total} 段`,
  progressDeepSeekMerging: "正在整理分段大纲",
  progressSaving: "正在保存大纲到资料库和 CSV",
  progressDone: "生成完成",
  exportMd: "导出 MD",
  copy: "复制",
  settings: "设置",
  video: "视频",
  captions: "课程内容",
  workflow: "工作流",
  diagnostics: "诊断",
  hide: "隐藏",
  show: "显示",
  openDiagnostics: "打开诊断信息，检查当前测试状态。",
  toggleSidebar: "展开或收起侧边栏",
  reopenOutline: "打开大纲",
  studyViews: "学习视图",
  recentLectures: "最近课程",
  clear: "清空",
  outline: "大纲",
  visual: "画面",
  visualAnalysis: "画面分析",
  visualStatusIdle: "播放课程时会自动分析 PPT、板书和图示画面。",
  visualStatusWaiting: "等待可分析的视频画面。",
  visualStatusCapturing: "正在截取当前画面...",
  visualStatusAnalyzing: "正在分析画面...",
  visualStatusReady: "画面分析已更新",
  visualStatusSkipped: "当前画面变化不明显，已跳过。",
  visualStatusModelFailed: "画面分析失败，请确认当前 DeepSeek 模型支持图片输入。",
  visualVisibleText: "画面文字",
  visualRelation: "和讲解的关系",
  lectureNotes: "",
  concepts: "",
  tags: "",
  questions: "",
  library: "资料库",
  waitingForLecture: "等待课程视频...",
  statusNotLoaded: "未加载",
  statusAutoStarting: "已进入视频，正在自动生成中文大纲...",
  statusStudyPackReady: "大纲已生成并保存到资料库",
  statusDeepSeekKeyMissing: "缺少 DeepSeek API Key，请到设置里填写后重新生成。",
  statusMarkdownExported: "Markdown 已导出",
  statusStudyPackCopied: "大纲已复制",
  statusDiagnosticsCopied: "诊断信息已复制",
  statusRestoredStudyPack: "已恢复缓存大纲",
  statusRestoredTranscript: "已恢复课程内容，正在生成中文大纲",
  statusRestoredTranscriptOutdatedPack: "旧版英文大纲已失效，正在重新生成中文大纲",
  statusRecentHistoryCleared: "最近课程记录已清空",
  statusLibraryItemLoaded: "已从资料库加载这节课",
  statusLibraryItemMissing: "资料库里的完整记录丢失了，请重新生成一次大纲。",
  statusLibraryItemOutdated: "资料库里的大纲版本过旧，请重新生成一次中文大纲。",
  statusCsvSaved: "CSV 已保存到项目目录",
  statusCsvSaveSkipped: "CSV 本地服务未启动，仅保存到插件资料库",
  noStudyPackExport: "还没有可导出的大纲。",
  noStudyPackCopy: "还没有可复制的大纲。",
  captionLoadFailed: "课程内容读取失败",
  studyPackFailed: "大纲生成失败",
  deepSeekUnavailable: "DeepSeek 生成失败",
  summaryDefault: "进入视频后会自动生成中文大纲。",
  rawPreview: "原始预览",
  recentDebugLog: "最近调试日志",
  recentDebugLogCopy: "最近调试日志：",
  rawPreviewCopy: "原始预览",
  noRecentLectures: "还没有保存的课程记录。",
  librarySearchPlaceholder: "搜索已保存课程或大纲...",
  libraryEmpty: "资料库还没有内容。生成大纲后会自动保存到这里。",
  libraryNoResults: "没有匹配的资料库记录。",
  libraryOpenVideo: "打开视频",
  libraryLoad: "查看",
  libraryQuestions: () => "",
  emptyOutline: "正在等待自动生成的大纲。",
  emptyOutlineGenerating: "正在生成大纲，完成一段会先显示在这里。",
  emptyVisual: "播放课程时会自动收集 PPT、板书和图示画面分析。",
  partialOutlineReady: (count, current, total) => `已生成 ${count} 个大纲小节，正在继续处理第 ${current}/${total} 段`,
  jump: "跳转",
  saved: "已保存",
  justNow: "刚刚",
  minAgo: "分钟前",
  hoursAgo: "小时前",
  daysAgo: "天前",
  captionLines: (count) => `课程内容已准备`,
  diagVideoId: "视频 ID",
  diagCaptionsLoaded: "课程内容行数",
  diagCaptionTrack: "内容来源",
  diagCache: "缓存",
  diagDeepSeekModel: "DeepSeek 模型",
  diagDeepSeekKey: "DeepSeek Key",
  diagStatus: "状态",
  diagCaptionUrl: "内容 URL",
  diagHttp: "HTTP",
  diagParseMode: "解析模式",
  diagEventCount: "事件数量",
  diagTrackKind: "轨道类型",
  diagTrackName: "轨道名称",
  valueUnknown: "未知",
  valueNone: "无",
  valuePresent: "存在",
  valueTranscriptOnly: "仅课程内容",
  valueEmpty: "空",
  valueConfigured: "已配置",
  valueMissing: "缺失",
  valueUnset: "未设置",
  valueYes: "是",
  valueNo: "否",
  markdownFallbackTitle: "MIT 课程大纲",
  markdownOutline: "大纲",
  markdownVisual: "画面分析",
  markdownTags: "",
  markdownLectureNotes: "",
  markdownConcepts: "",
  markdownQuestions: ""
};

function sidebarWidthCssValue() {
  return `min(${Number(state.settings.sidebarWidth || DEFAULT_SETTINGS.sidebarWidth)}px, 100vw)`;
}

function uiText(key) {
  const value = UI_TEXT[key] ?? key;
  return typeof value === "function" ? value : String(value);
}

function uiCaptionLines(count) {
  return UI_TEXT.captionLines(count);
}

function uiProgressCaptionTrack(current, total) {
  return UI_TEXT.progressCaptionTrack(current, total);
}

function uiPartialOutlineReady(count, current, total) {
  return UI_TEXT.partialOutlineReady(count, current, total);
}

function uiLibraryQuestions(count) {
  return UI_TEXT.libraryQuestions(count);
}

function uiError(prefixKey, error) {
  return `${uiText(prefixKey)}: ${error instanceof Error ? error.message : String(error)}`;
}

const state = {
  initialized: false,
  sidebarOpen: true,
  settings: { ...DEFAULT_SETTINGS },
  transcript: [],
  studyPack: null,
  studyPackFinal: false,
  visualAnalysis: [],
  visualAnalysisStatus: uiText("visualStatusIdle"),
  visualAnalysisError: "",
  videoId: "",
  videoTitle: "",
  activeTab: "outline",
  isBusy: false,
  busyAction: "",
  statusText: uiText("statusNotLoaded"),
  statusError: false,
  currentVideoTime: 0,
  timerId: null,
  visualTimerId: null,
  visualAnalysisInFlight: false,
  visualLastSampleSeconds: -Infinity,
  visualLastSignature: "",
  recentLectures: [],
  libraryIndex: [],
  librarySearchQuery: "",
  lastNonFullscreenParent: null,
  usedFallback: false,
  lastCaptionTrackLanguage: "",
  diagnosticsOpen: false,
  debugLog: [],
  lastCaptionDebug: null,
  pageBridgeReady: false,
  pageBridgeLoadPromise: null,
  autoRunVideoId: "",
  autoRunPromise: null,
  progress: {
    visible: false,
    percent: 0,
    label: uiText("progressIdle")
  }
};

void boot();

async function boot() {
  if (window.top !== window || state.initialized) {
    return;
  }

  state.initialized = true;
  ensurePageBridge();
  await loadSettings();
  createSidebar();
  observePageTransitions();
  bindGlobalEvents();
  startPlaybackSync();
  startVisualSampling();
  void syncVideoContext();
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  state.settings = normalizeSettings(stored);
  if (stored.outputLanguage !== "zh-CN") {
    await chrome.storage.sync.set({ outputLanguage: "zh-CN" });
  }
  await loadRecentLectures();
  await loadLibraryIndex();
}

function normalizeSettings(stored = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    outputLanguage: "zh-CN"
  };

  return settings;
}

function createSidebar() {
  if (document.getElementById(SIDEBAR_HOST_ID)) {
    return;
  }

  const host = document.createElement("aside");
  host.id = SIDEBAR_HOST_ID;
  host.setAttribute("aria-label", "MIT 课程学习侧边栏");
  host.style.width = sidebarWidthCssValue();

  const root = document.createElement("div");
  root.id = APP_ROOT_ID;
  host.appendChild(root);

  state.lastNonFullscreenParent = document.documentElement;
  document.documentElement.appendChild(host);
  bindSidebarEvents(root, host);
  render();
}

function bindGlobalEvents() {
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  chrome.storage.onChanged.addListener(handleStorageChanges);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "DEEPSEEK_ANALYSIS_PROGRESS") {
      return false;
    }
    if (message.videoId && message.videoId !== state.videoId) {
      return false;
    }
    if (message.partialPack?.outline?.length) {
      applyPartialStudyPack(message.partialPack, message.partialIndex, message.partialTotal);
    }
    setProgress(message.percent, message.label, true, true);
    return false;
  });
}

function bindSidebarEvents(root, host) {
  host.addEventListener(
    "wheel",
    (event) => {
      const shell = host.querySelector(".mit-study-shell");
      if (shell instanceof HTMLElement) {
        shell.scrollTop += event.deltaY;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true, passive: false }
  );
  host.addEventListener(
    "touchmove",
    (event) => {
      event.stopPropagation();
    },
    { capture: true, passive: true }
  );

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action || "";
    const allowWhileBusy = new Set(["open-settings", "jump", "clear-history", "load-library-item"]);
    if (state.isBusy && action && !allowWhileBusy.has(action) && !target.dataset.tab) {
      return;
    }

    if (target.matches(".mit-study-close, .mit-study-reopen")) {
      state.sidebarOpen = !state.sidebarOpen;
      host.classList.toggle("is-collapsed", !state.sidebarOpen);
      render();
      return;
    }

    if (target.dataset.action === "generate") {
      await generateStudyPack();
      return;
    }

    if (target.dataset.action === "open-settings") {
      await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
      return;
    }

    if (target.dataset.action === "export-markdown") {
      exportMarkdown();
      return;
    }

    if (target.dataset.action === "copy-pack") {
      await copyStudyPack();
      return;
    }

    if (target.dataset.action === "clear-history") {
      await clearRecentLectures();
      return;
    }

    if (target.dataset.action === "load-library-item" && target.dataset.videoId) {
      await loadLibraryItem(target.dataset.videoId);
      return;
    }

    if (target.dataset.action === "jump" && target.dataset.seconds) {
      jumpToTime(Number(target.dataset.seconds));
      return;
    }

    if (target.dataset.tab) {
      state.activeTab = target.dataset.tab;
      render();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset.action !== "search-library") {
      return;
    }
    state.librarySearchQuery = target.value;
    render();
    const searchInput = document.querySelector('[data-action="search-library"]');
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  });
}

function observePageTransitions() {
  window.addEventListener("yt-navigate-finish", syncVideoContext);

  const observer = new MutationObserver(() => {
    const nextVideoId = extractVideoId();
    if (nextVideoId && nextVideoId !== state.videoId) {
      syncVideoContext();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function handleFullscreenChange() {
  const host = document.getElementById(SIDEBAR_HOST_ID);
  if (!(host instanceof HTMLElement)) {
    return;
  }

  const fullscreenElement = document.fullscreenElement;
  if (fullscreenElement instanceof HTMLElement) {
    fullscreenElement.appendChild(host);
    host.classList.add("is-inside-fullscreen");
    return;
  }

  const fallbackParent = state.lastNonFullscreenParent || document.documentElement;
  fallbackParent.appendChild(host);
  host.classList.remove("is-inside-fullscreen");
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== "sync") {
    return;
  }

  let shouldRender = false;
  for (const [key, change] of Object.entries(changes)) {
    if (!(key in DEFAULT_SETTINGS)) {
      continue;
    }
    state.settings[key] = key === "outputLanguage" ? "zh-CN" : change.newValue;
    shouldRender = true;
  }

  if (shouldRender) {
    render();
  }
}

function startPlaybackSync() {
  state.timerId = window.setInterval(() => {
    const player = document.querySelector("video");
    if (player instanceof HTMLVideoElement) {
      state.currentVideoTime = player.currentTime || 0;
      highlightCurrentTranscript();
    }
  }, 1000);
}

function startVisualSampling() {
  if (state.visualTimerId) {
    window.clearInterval(state.visualTimerId);
  }
  window.setTimeout(sampleVisualFrame, VISUAL_SAMPLE_START_DELAY_MS);
  state.visualTimerId = window.setInterval(sampleVisualFrame, VISUAL_SAMPLE_INTERVAL_MS);
}

function highlightCurrentTranscript() {
  const root = document.getElementById(APP_ROOT_ID);
  if (!root) {
    return;
  }

  root.querySelectorAll("[data-transcript-start]").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const start = Number(node.dataset.transcriptStart || 0);
    const end = Number(node.dataset.transcriptEnd || start + 5);
    const isActive = state.currentVideoTime >= start && state.currentVideoTime < end;
    node.classList.toggle("is-playing", isActive);
  });
}

async function syncVideoContext() {
  const nextVideoId = extractVideoId();
  const nextVideoTitle = extractVideoTitle();
  const isSameVideo = nextVideoId && nextVideoId === state.videoId;
  if (isSameVideo && (state.isBusy || state.studyPack || state.autoRunPromise)) {
    state.videoTitle = nextVideoTitle || state.videoTitle;
    render();
    return;
  }

  state.videoId = nextVideoId;
  state.videoTitle = nextVideoTitle;
  state.transcript = [];
  state.studyPack = null;
  state.studyPackFinal = false;
  state.visualAnalysis = [];
  state.visualAnalysisStatus = uiText("visualStatusIdle");
  state.visualAnalysisError = "";
  state.activeTab = "outline";
  state.visualAnalysisInFlight = false;
  state.visualLastSampleSeconds = -Infinity;
  state.visualLastSignature = "";
  state.usedFallback = false;
  state.lastCaptionTrackLanguage = "";
  state.autoRunVideoId = "";
  state.autoRunPromise = null;
  setStatus(state.videoId ? uiText("statusAutoStarting") : uiText("statusNotLoaded"));
  await hydrateVideoCache();
  render();
  scheduleAutoStudyPack();
}

function extractVideoId() {
  try {
    return new URL(window.location.href).searchParams.get("v") || "";
  } catch (_error) {
    return "";
  }
}

function extractVideoTitle() {
  const titleNode =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
    document.querySelector("h1.title") ||
    document.querySelector("title");
  return titleNode?.textContent?.trim().replace(/\s+-\s+YouTube$/, "") || "";
}

function scheduleAutoStudyPack() {
  window.setTimeout(startAutoStudyPack, AUTO_STUDY_PACK_DELAY_MS);
}

function startAutoStudyPack() {
  if (!state.videoId || state.studyPackFinal || state.isBusy || state.autoRunPromise) {
    return;
  }

  const videoId = state.videoId;
  state.autoRunVideoId = videoId;
  state.autoRunPromise = (async () => {
    await generateStudyPack();
  })().finally(() => {
    if (state.autoRunVideoId === videoId) {
      state.autoRunPromise = null;
    }
  });
}

async function loadTranscript() {
  const videoIdAtStart = state.videoId;
  clearCaptionDebug();
  setProgress(8, uiText("progressCaptionFetching"), true);
  setBusy(true, uiText("loadingCaptions"), "captions", true);

  try {
    const transcript = await fetchTranscript();
    if (state.videoId !== videoIdAtStart) {
      return;
    }
    state.transcript = transcript;
    setProgress(35, uiText("progressCaptionReady"), true);
    setStatus(uiCaptionLines(transcript.length));
  } catch (error) {
    if (state.videoId === videoIdAtStart) {
      setStatus(uiError("captionLoadFailed", error), true);
    }
  } finally {
    if (state.videoId === videoIdAtStart) {
      setBusy(false);
      render();
    }
  }
}

async function sampleVisualFrame() {
  if (!state.videoId || state.visualAnalysisInFlight || !state.settings.deepseekApiKey) {
    return;
  }

  const video = document.querySelector("video");
  if (!(video instanceof HTMLVideoElement) || video.readyState < 2) {
    state.visualAnalysisStatus = uiText("visualStatusWaiting");
    return;
  }

  const seconds = Math.floor(video.currentTime || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return;
  }
  if (seconds - state.visualLastSampleSeconds < VISUAL_MIN_SECONDS_BETWEEN_FRAMES) {
    return;
  }

  const videoIdAtStart = state.videoId;
  state.visualAnalysisInFlight = true;
  state.visualAnalysisStatus = uiText("visualStatusCapturing");
  state.visualAnalysisError = "";
  render();

  try {
    const frame = await captureCurrentVideoFrame(video, seconds);
    if (!frame || state.videoId !== videoIdAtStart) {
      return;
    }

    if (state.visualLastSignature && signatureDistance(state.visualLastSignature, frame.signature) < VISUAL_SIGNATURE_DIFF_THRESHOLD) {
      state.visualAnalysisStatus = uiText("visualStatusSkipped");
      return;
    }

    state.visualAnalysisStatus = uiText("visualStatusAnalyzing");
    render();
    const analysis = await analyzeVisualFrame(frame);
    if (state.videoId !== videoIdAtStart || !analysis?.shouldKeep) {
      state.visualLastSignature = frame.signature;
      state.visualLastSampleSeconds = seconds;
      return;
    }

    state.visualLastSignature = frame.signature;
    state.visualLastSampleSeconds = seconds;
    state.visualAnalysis = mergeVisualAnalysisItems(state.visualAnalysis, [analysis]).slice(0, VISUAL_MAX_ANALYSIS_ITEMS);
    state.visualAnalysisStatus = uiText("visualStatusReady");
    await persistVideoCache({ skipCsv: true });
  } catch (error) {
    state.visualAnalysisError = error instanceof Error ? error.message : String(error);
    state.visualAnalysisStatus = uiText("visualStatusModelFailed");
    writeDebug("visual-analysis-failed", {
      message: state.visualAnalysisError
    });
  } finally {
    state.visualAnalysisInFlight = false;
    render();
  }
}

async function captureCurrentVideoFrame(video, seconds) {
  const directFrame = captureVideoElementFrame(video, seconds);
  if (directFrame) {
    return directFrame;
  }

  const response = await captureVisibleTabWithoutSidebar();
  if (!response?.ok || !response.result?.dataUrl) {
    throw new Error(response?.error || "当前标签页截图失败。");
  }

  const crop = getVideoCropRect(video);
  const image = await loadImage(response.result.dataUrl);
  const scaleX = image.naturalWidth / Math.max(window.innerWidth || 1, 1);
  const scaleY = image.naturalHeight / Math.max(window.innerHeight || 1, 1);
  const sourceX = Math.max(0, Math.round(crop.left * scaleX));
  const sourceY = Math.max(0, Math.round(crop.top * scaleY));
  const sourceWidth = Math.max(1, Math.min(image.naturalWidth - sourceX, Math.round(crop.width * scaleX)));
  const sourceHeight = Math.max(1, Math.min(image.naturalHeight - sourceY, Math.round(crop.height * scaleY)));
  const targetWidth = Math.min(VISUAL_FRAME_MAX_WIDTH, sourceWidth);
  const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器无法处理视频画面。");
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

  return {
    seconds,
    timestamp: formatTime(seconds * 1000),
    imageDataUrl: canvas.toDataURL("image/jpeg", VISUAL_FRAME_JPEG_QUALITY),
    signature: buildFrameSignature(context, targetWidth, targetHeight)
  };
}

function captureVideoElementFrame(video, seconds) {
  const width = Math.max(1, Number(video.videoWidth) || Math.round(video.getBoundingClientRect().width) || 1);
  const height = Math.max(1, Number(video.videoHeight) || Math.round(video.getBoundingClientRect().height) || 1);
  const targetWidth = Math.min(VISUAL_FRAME_MAX_WIDTH, width);
  const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  try {
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    return {
      seconds,
      timestamp: formatTime(seconds * 1000),
      imageDataUrl: canvas.toDataURL("image/jpeg", VISUAL_FRAME_JPEG_QUALITY),
      signature: buildFrameSignature(context, targetWidth, targetHeight)
    };
  } catch (error) {
    writeDebug("visual-direct-frame-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function captureVisibleTabWithoutSidebar() {
  const host = document.getElementById(SIDEBAR_HOST_ID);
  const previousVisibility = host instanceof HTMLElement ? host.style.visibility : "";
  if (host instanceof HTMLElement) {
    host.style.visibility = "hidden";
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  try {
    return await chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" });
  } finally {
    if (host instanceof HTMLElement) {
      host.style.visibility = previousVisibility;
    }
  }
}

function getVideoCropRect(video) {
  const rect = video.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.width;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.height;
  return {
    left: Math.max(0, rect.left),
    top: Math.max(0, rect.top),
    width: Math.max(1, Math.min(rect.width, viewportWidth - Math.max(0, rect.left))),
    height: Math.max(1, Math.min(rect.height, viewportHeight - Math.max(0, rect.top)))
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("截图图片加载失败。"));
    image.src = src;
  });
}

function buildFrameSignature(context, width, height) {
  const signature = [];
  for (let y = 0; y < VISUAL_SIGNATURE_HEIGHT; y += 1) {
    for (let x = 0; x < VISUAL_SIGNATURE_WIDTH; x += 1) {
      const px = Math.min(width - 1, Math.floor(((x + 0.5) / VISUAL_SIGNATURE_WIDTH) * width));
      const py = Math.min(height - 1, Math.floor(((y + 0.5) / VISUAL_SIGNATURE_HEIGHT) * height));
      const data = context.getImageData(px, py, 1, 1).data;
      signature.push(Math.round((data[0] + data[1] + data[2]) / 3 / 16).toString(16));
    }
  }
  return signature.join("");
}

function signatureDistance(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) {
    return 1;
  }
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(parseInt(left[index], 16) - parseInt(right[index], 16)) / 15;
  }
  return total / length;
}

async function analyzeVisualFrame(frame) {
  const response = await chrome.runtime.sendMessage({
    type: "RUN_DEEPSEEK_VISUAL_ANALYSIS",
    payload: {
      videoId: state.videoId,
      videoTitle: state.videoTitle,
      frame,
      transcriptContext: getTranscriptContext(frame.seconds)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "DeepSeek 画面分析失败。");
  }
  return normalizeVisualAnalysisItem(response.result || frame);
}

function getTranscriptContext(seconds) {
  const startMs = Math.max(0, (seconds - 25) * 1000);
  const endMs = (seconds + 25) * 1000;
  return state.transcript
    .filter((entry) => entry.startMs >= startMs && entry.startMs <= endMs)
    .slice(0, 12);
}

function normalizeVisualAnalysisItem(item) {
  const seconds = Number(item?.seconds);
  const startMs = Number.isFinite(seconds) ? seconds * 1000 : parseTimestampToMs(item?.timestamp);
  return {
    timestamp: item?.timestamp || formatTime(startMs),
    seconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : Math.floor(startMs / 1000),
    title: String(item?.title || "").trim(),
    visualType: String(item?.visualType || "visual").trim(),
    shouldKeep: item?.shouldKeep !== false,
    bullets: Array.isArray(item?.bullets)
      ? item.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
      : [],
    visibleText: Array.isArray(item?.visibleText)
      ? item.visibleText.map((text) => String(text || "").trim()).filter(Boolean)
      : [],
    relationToTranscript: String(item?.relationToTranscript || "").trim()
  };
}

function mergeVisualAnalysisItems(existingItems, nextItems) {
  const seen = new Set();
  return [...(existingItems || []), ...(nextItems || [])]
    .map(normalizeVisualAnalysisItem)
    .filter((item) => item.shouldKeep && (item.title || item.bullets.length || item.visibleText.length))
    .filter((item) => {
      const bucket = Math.round((item.seconds || 0) / 15);
      const key = `${bucket}|${item.title}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => Number(left.seconds || 0) - Number(right.seconds || 0));
}

async function fetchTranscript() {
  setProgress(10, uiText("progressCaptionInitialData"), true, true);
  const initialData = await getInitialData();
  const initialTranscript = extractTranscriptEntriesFromInitialData(initialData);
  if (initialTranscript.length) {
    recordCaptionDebug({
      source: "ytInitialData",
      parseMode: "engagement-panels",
      eventCount: initialTranscript.length
    });
    writeDebug("transcript-initial-data-success", {
      eventCount: initialTranscript.length
    });
    return normalizeTranscriptEntries(initialTranscript);
  }

  const transcriptParams = findTranscriptParams(initialData);
  if (transcriptParams) {
    setProgress(18, uiText("progressCaptionTranscriptApi"), true, true);
    writeDebug("transcript-params-found", {
      paramsLength: transcriptParams.length
    });
    try {
      const transcriptFromApi = await fetchTranscriptViaInnertube(transcriptParams);
      if (transcriptFromApi.length) {
        recordCaptionDebug({
          source: "youtubei/get_transcript",
          parseMode: "transcript-api",
          eventCount: transcriptFromApi.length
        });
        writeDebug("transcript-api-success", {
          eventCount: transcriptFromApi.length
        });
        return normalizeTranscriptEntries(transcriptFromApi);
      }
    } catch (error) {
      writeDebug("transcript-api-failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    writeDebug("transcript-params-missing", {});
  }

  setProgress(24, uiText("progressCaptionPlayer"), true, true);
  const playerResponse = await getBestPlayerResponse();
  const tracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  writeDebug("player-response", {
    hasCaptions: Boolean(playerResponse?.captions),
    trackCount: tracks.length,
    videoTitle: playerResponse?.videoDetails?.title || ""
  });

  if (!tracks.length) {
    throw new Error("这个视频没有暴露可用的课程内容。");
  }

  const failures = [];
  const pageTrackResult = await tryCaptionTracks({
    tracks,
    source: "page-player",
    failures,
    progressStart: 28,
    progressEnd: 32
  });
  if (pageTrackResult) {
    return pageTrackResult;
  }

  setProgress(32, uiText("progressCaptionAndroidPlayer"), true, true);
  const androidPlayerResponse = await fetchPlayerResponseViaInnertube().catch((error) => {
    writeDebug("player-response-android-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  });
  const androidTracks =
    androidPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  writeDebug("player-response-android", {
    hasCaptions: Boolean(androidPlayerResponse?.captions),
    trackCount: androidTracks.length,
    videoTitle: androidPlayerResponse?.videoDetails?.title || ""
  });
  if (androidTracks.length) {
    const androidTrackResult = await tryCaptionTracks({
      tracks: androidTracks,
      source: "android-player",
      failures,
      progressStart: 32,
      progressEnd: 34
    });
    if (androidTrackResult) {
      return androidTrackResult;
    }
  }

  recordCaptionDebug({
    parseMode: "failed"
  });
  throw new Error(`没有获取到可解析的字幕内容。尝试记录：${failures.join(" | ")}`);
}

async function tryCaptionTracks({ tracks, source, failures, progressStart = 28, progressEnd = 34 }) {
  const attempts = buildCaptionAttemptQueue(tracks);
  recordCaptionDebug({
    source,
    availableTracks: tracks.slice(0, 5).map(summarizeCaptionTrack),
    attemptCount: attempts.length
  });
  writeDebug("caption-attempt-queue", {
    source,
    attemptCount: attempts.length,
    attempts: attempts.slice(0, 8).map((attempt) => ({
      track: summarizeCaptionTrack(attempt.track),
      requestUrl: attempt.requestUrl,
      label: attempt.label
    }))
  });

  for (const [index, attempt] of attempts.entries()) {
    const percent =
      progressStart +
      Math.round((index / Math.max(attempts.length, 1)) * Math.max(progressEnd - progressStart, 0));
    setProgress(percent, uiProgressCaptionTrack(index + 1, attempts.length), true, true);
    state.lastCaptionTrackLanguage = attempt.track?.languageCode || "";
    recordCaptionDebug({
      attemptIndex: index + 1,
      baseUrl: attempt.track?.baseUrl || "",
      requestUrl: attempt.requestUrl,
      track: summarizeCaptionTrack(attempt.track)
    });
    writeDebug("caption-track", {
      source,
      attempt: index + 1,
      total: attempts.length,
      label: attempt.label,
      ...state.lastCaptionDebug
    });

    const result = await tryCaptionRequest(attempt.requestUrl);
    if (result.ok) {
      recordCaptionDebug({
        httpStatus: result.status,
        contentType: result.contentType,
        rawPreview: result.rawPreview,
        rawLength: result.rawLength,
        parseMode: result.parseMode,
        eventCount: result.eventCount
      });
      writeDebug("caption-parse-success", {
        source,
        attempt: index + 1,
        parseMode: result.parseMode,
        eventCount: result.eventCount
      });
      return result.transcript;
    }

    failures.push(
      `${attempt.track?.languageCode || "unknown"}:${attempt.track?.kind || "manual"}:${attempt.label}:${result.reason}`
    );
    recordCaptionDebug({
      httpStatus: result.status,
      contentType: result.contentType,
      rawPreview: result.rawPreview,
      rawLength: result.rawLength,
      parseMode: "failed"
    });
    writeDebug("caption-attempt-failed", {
      source,
      attempt: index + 1,
      total: attempts.length,
      label: attempt.label,
      reason: result.reason,
      status: result.status,
      contentType: result.contentType,
      rawPreview: result.rawPreview
    });
  }

  return null;
}

async function getBestPlayerResponse() {
  const pageResponse = await getPlayerResponse().catch((error) => {
    writeDebug("player-response-page-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  });

  const pageTracks = pageResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (pageTracks.length) {
    return pageResponse;
  }

  const innertubeResponse = await fetchPlayerResponseViaInnertube().catch((error) => {
    writeDebug("player-response-innertube-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  });

  const innertubeTracks =
    innertubeResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (innertubeTracks.length) {
    writeDebug("player-response-innertube-success", {
      trackCount: innertubeTracks.length
    });
    return innertubeResponse;
  }

  if (pageResponse) {
    return pageResponse;
  }

  throw new Error("当前页面没有找到播放器元数据。");
}

async function getPlayerResponse() {
  const inlineResponse = readPlayerResponseFromWindow();
  if (inlineResponse) {
    return inlineResponse;
  }

  const response = await fetch(window.location.href, { credentials: "include" });
  if (!response.ok) {
    throw new Error("无法读取当前 YouTube 视频页面。");
  }

  const html = await response.text();
  const parsedFromHtml = readPlayerResponseFromHtml(html);
  if (parsedFromHtml) {
    return parsedFromHtml;
  }

  throw new Error("当前页面没有找到播放器元数据。");
}

function readPlayerResponseFromWindow() {
  const candidates = [
    window.ytInitialPlayerResponse,
    window.ytplayer?.config?.args?.raw_player_response
      ? safeParseJson(window.ytplayer.config.args.raw_player_response)
      : null,
    window.ytplayer?.config?.args?.player_response
      ? safeParseJson(window.ytplayer.config.args.player_response)
      : null,
    window.ytplayer?.bootstrapWebPlayerContextConfig?.jsUrl ? window.ytInitialPlayerResponse : null
  ];

  return candidates.find((candidate) => candidate?.captions) || null;
}

async function getInitialData() {
  const inlineData = readInitialDataFromWindow();
  if (inlineData) {
    return inlineData;
  }

  const response = await fetch(window.location.href, { credentials: "include" });
  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  return readInitialDataFromHtml(html);
}

function readInitialDataFromWindow() {
  return window.ytInitialData && typeof window.ytInitialData === "object" ? window.ytInitialData : null;
}

async function fetchPlayerResponseViaInnertube() {
  const videoId = extractVideoId();
  if (!videoId) {
    throw new Error("缺少视频 ID。");
  }

  const config = await getInnertubeConfigFromPage().catch((error) => {
    writeDebug("innertube-config-optional-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return { context: null };
  });

  const context = buildInnertubePlayerContext(config.context);
  const response = await fetchPageResource(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": INNERTUBE_ANDROID_CLIENT.clientVersion
      },
      body: JSON.stringify({
        context,
        videoId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: "HTML5_PREF_WANTS",
            signatureTimestamp: 0
          }
        },
        contentCheckOk: true,
        racyCheckOk: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(response.error || `播放器 API 请求失败，状态码 ${response.status}。`);
  }

  const payload = safeParseJsonText(response.body || "");
  if (!payload) {
    throw new Error("播放器 API 没有返回有效 JSON。");
  }

  return payload;
}

function buildInnertubePlayerContext(pageContext) {
  const pageClient = pageContext?.client || {};
  const client = {
    hl: pageClient.hl || "en",
    gl: pageClient.gl || "US",
    clientName: INNERTUBE_ANDROID_CLIENT.clientName,
    clientVersion: INNERTUBE_ANDROID_CLIENT.clientVersion,
    userAgent: INNERTUBE_ANDROID_CLIENT.userAgent,
    osName: INNERTUBE_ANDROID_CLIENT.osName,
    osVersion: INNERTUBE_ANDROID_CLIENT.osVersion
  };
  if (pageClient.visitorData) {
    client.visitorData = pageClient.visitorData;
  }

  return {
    ...pageContext,
    client
  };
}

const {
  readInitialDataFromHtml,
  readPlayerResponseFromHtml,
  readYtcfgFromHtml,
  safeParseJson,
  safeParseJsonText,
  parseCaptionXml
} = window.__mitStudyTranscriptUtils;

function pickCaptionTrack(tracks) {
  return rankCaptionTracks(tracks)[0] || tracks[0];
}

function normalizeCaptionUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  return url.toString();
}

function stripCaptionFormat(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.delete("fmt");
  return url.toString();
}

function buildCaptionAttemptQueue(tracks) {
  return rankCaptionTracks(tracks).flatMap((track) => {
    const baseUrl = track?.baseUrl;
    if (!baseUrl) {
      return [];
    }

    const urls = [
      ["json3", normalizeCaptionUrl(baseUrl)],
      ["native", stripCaptionFormat(baseUrl)]
    ];

    return dedupeAttempts(urls).map(([label, requestUrl]) => ({
      track,
      label,
      requestUrl
    }));
  });
}

function dedupeAttempts(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry[1];
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function rankCaptionTracks(tracks) {
  return [...tracks].sort((left, right) => scoreCaptionTrack(right) - scoreCaptionTrack(left));
}

function scoreCaptionTrack(track) {
  const languageCode = track?.languageCode || "";
  const name = track?.name?.simpleText || "";
  const kind = track?.kind || "";
  const baseUrl = track?.baseUrl || "";

  let score = 0;
  if (/en(-|$)/i.test(languageCode) || /english/i.test(name)) {
    score += 100;
  }
  if (!kind) {
    score += 40;
  }
  if (kind && !/asr/i.test(kind)) {
    score += 20;
  }
  if (/asr/i.test(kind)) {
    score -= 40;
  }
  if (/variant=gemini/i.test(baseUrl)) {
    score -= 80;
  }
  if (/variant=/i.test(baseUrl) && !/variant=gemini/i.test(baseUrl)) {
    score -= 10;
  }

  return score;
}

async function tryCaptionRequest(requestUrl) {
  const response = await fetchPageResource(requestUrl);
  const contentType = response.contentType || "";
  writeDebug("caption-response-meta", {
    status: response.status,
    ok: response.ok,
    contentType,
    requestUrl
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: response.error ? `fetch-error:${response.error}` : `http-${response.status}`,
      status: response.status,
      contentType,
      rawLength: 0,
      rawPreview: ""
    };
  }

  const rawText = response.body || "";
  const rawPreview = rawText.slice(0, 400);
  writeDebug("caption-response-preview", {
    rawLength: rawText.length,
    rawPreview,
    requestUrl
  });

  const payload = safeParseJsonText(rawText);
  if (payload?.events) {
    return {
      ok: true,
      status: response.status,
      contentType,
      rawLength: rawText.length,
      rawPreview,
      parseMode: "json3",
      eventCount: payload.events.length,
      transcript: normalizeTranscriptPayload(payload.events || [])
    };
  }

  const xmlTranscript = parseCaptionXml(rawText);
  if (xmlTranscript?.length) {
    return {
      ok: true,
      status: response.status,
      contentType,
      rawLength: rawText.length,
      rawPreview,
      parseMode: "xml",
      eventCount: xmlTranscript.length,
      transcript: normalizeTranscriptEntries(xmlTranscript)
    };
  }

  return {
    ok: false,
    reason: rawText ? "unrecognized-payload" : "empty-body",
    status: response.status,
    contentType,
    rawLength: rawText.length,
    rawPreview
  };
}

async function fetchPageResource(requestUrl, requestInit = {}) {
  const pageContextResult = await fetchViaPageContext(requestUrl, requestInit);
  if (pageContextResult) {
    writeDebug("page-bridge-result", {
      requestUrl,
      status: pageContextResult.status,
      ok: pageContextResult.ok,
      contentType: pageContextResult.contentType,
      bodyLength: String(pageContextResult.body || "").length
    });
    return pageContextResult;
  }

  writeDebug("page-bridge-fallback", {
    requestUrl,
    reason: "bridge-unavailable-or-timeout"
  });
  const response = await fetch(requestUrl, requestInit);
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: await response.text(),
    error: ""
  };
}

function ensurePageBridge() {
  if (state.pageBridgeLoadPromise) {
    return state.pageBridgeLoadPromise;
  }

  const runtimeGetUrl = chrome?.runtime?.getURL;
  if (typeof runtimeGetUrl !== "function") {
    writeDebug("page-bridge-disabled", {
      reason: "runtime-geturl-missing"
    });
    return Promise.resolve(false);
  }

  const existing = document.getElementById("mit-study-page-bridge");
  if (existing) {
    state.pageBridgeLoadPromise = Promise.resolve(true);
    state.pageBridgeReady = true;
    return state.pageBridgeLoadPromise;
  }

  state.pageBridgeLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      writeDebug("page-bridge-timeout", {
        src: script.src
      });
      resolve(false);
    }, PAGE_BRIDGE_LOAD_TIMEOUT_MS);

    script.id = "mit-study-page-bridge";
    script.src = runtimeGetUrl("src/page-bridge.js");
    script.async = false;
    script.onload = () => {
      window.clearTimeout(timeoutId);
      state.pageBridgeReady = true;
      writeDebug("page-bridge-loaded", {
        src: script.src
      });
      resolve(true);
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      writeDebug("page-bridge-load-error", {
        src: script.src
      });
      resolve(false);
    };

    writeDebug("page-bridge-inject", {
      src: script.src
    });
    (document.head || document.documentElement).appendChild(script);
  });

  return state.pageBridgeLoadPromise;
}

async function fetchCaptionViaPageContext(requestUrl) {
  return fetchViaPageContext(requestUrl, {});
}

async function fetchViaPageContext(requestUrl, requestInit = {}) {
  if (typeof chrome?.runtime?.getURL !== "function") {
    return null;
  }

  const bridgeReady = await ensurePageBridge();
  if (!bridgeReady) {
    writeDebug("page-bridge-unavailable", {
      requestUrl
    });
    return null;
  }

  const requestId = `mit-study-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeDebug("page-bridge-request", {
    requestId,
    requestUrl
  });

  return new Promise((resolve) => {
    let settled = false;
    const timerId = window.setTimeout(() => {
      cleanup();
      writeDebug("page-bridge-request-timeout", {
        requestId,
        requestUrl
      });
      resolve(null);
    }, PAGE_BRIDGE_REQUEST_TIMEOUT_MS);

    function cleanup() {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timerId);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event) {
      if (event.source !== window) {
        return;
      }
      const data = event.data;
      if (!data || data.source !== "mit-study-page") {
        return;
      }
      if (data.type !== "MIT_STUDY_FETCH_CAPTION_RESULT" || data.requestId !== requestId) {
        return;
      }

      cleanup();
      writeDebug("page-bridge-response", {
        requestId,
        requestUrl,
        status: Number(data.status || 0),
        ok: Boolean(data.ok),
        contentType: String(data.contentType || ""),
        bodyLength: String(data.body || "").length,
        error: String(data.error || "")
      });
      resolve({
        ok: Boolean(data.ok),
        status: Number(data.status || 0),
        contentType: String(data.contentType || ""),
        body: String(data.body || ""),
        error: String(data.error || "")
      });
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: "mit-study-content",
        type: "MIT_STUDY_FETCH_RESOURCE",
        requestId,
        requestUrl,
        requestInit
      },
      "*"
    );
  });
}

function findTranscriptPanel(initialData) {
  return findFirstObject(
    initialData,
    (value) =>
      value?.engagementPanelSectionListRenderer?.panelIdentifier ===
      "engagement-panel-searchable-transcript"
  )?.engagementPanelSectionListRenderer || null;
}

function extractTranscriptEntriesFromInitialData(initialData) {
  const panel = findTranscriptPanel(initialData);
  if (!panel) {
    return [];
  }
  return extractTranscriptEntriesFromNode(panel);
}

function findTranscriptParams(initialData) {
  const panel = findTranscriptPanel(initialData);
  if (!panel) {
    return "";
  }

  const holder = findFirstObject(
    panel,
    (value) => typeof value?.continuationEndpoint?.getTranscriptEndpoint?.params === "string"
  );
  if (holder?.continuationEndpoint?.getTranscriptEndpoint?.params) {
    return holder.continuationEndpoint.getTranscriptEndpoint.params;
  }

  const directHolder = findFirstObject(
    panel,
    (value) => typeof value?.getTranscriptEndpoint?.params === "string"
  );
  return directHolder?.getTranscriptEndpoint?.params || "";
}

async function fetchTranscriptViaInnertube(params) {
  const config = await getInnertubeConfigFromPage();
  if (!config.apiKey || !config.context) {
    throw new Error("页面里缺少 Innertube 配置。");
  }

  const response = await fetchPageResource(
    `https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        context: config.context,
        params
      })
    }
  );

  if (!response.ok) {
    throw new Error(response.error || `字幕 API 请求失败，状态码 ${response.status}。`);
  }

  const payload = safeParseJsonText(response.body || "");
  if (!payload) {
    throw new Error("字幕 API 没有返回有效 JSON。");
  }

  return extractTranscriptEntriesFromNode(payload);
}

function getInnertubeConfig() {
  return {
    apiKey:
      window.yt?.config_?.INNERTUBE_API_KEY ||
      window.ytcfg?.data_?.INNERTUBE_API_KEY ||
      window.ytcfg?.get?.("INNERTUBE_API_KEY") ||
      "",
    context:
      window.yt?.config_?.INNERTUBE_CONTEXT ||
      window.ytcfg?.data_?.INNERTUBE_CONTEXT ||
      window.ytcfg?.get?.("INNERTUBE_CONTEXT") ||
      null
  };
}

async function getInnertubeConfigFromPage() {
  const inlineConfig = getInnertubeConfig();
  if (inlineConfig.apiKey && inlineConfig.context) {
    return inlineConfig;
  }

  try {
    const response = await fetch(window.location.href, { credentials: "include" });
    if (!response.ok) {
      return inlineConfig;
    }
    const html = await response.text();
    const ytcfg = readYtcfgFromHtml(html);
    const htmlConfig = {
      apiKey: ytcfg?.INNERTUBE_API_KEY || "",
      context: ytcfg?.INNERTUBE_CONTEXT || null
    };
    writeDebug("innertube-config-html", {
      hasApiKey: Boolean(htmlConfig.apiKey),
      hasContext: Boolean(htmlConfig.context)
    });
    return {
      apiKey: inlineConfig.apiKey || htmlConfig.apiKey,
      context: inlineConfig.context || htmlConfig.context
    };
  } catch (error) {
    writeDebug("innertube-config-html-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return inlineConfig;
  }
}

function extractTranscriptEntriesFromNode(root) {
  const segmentRenderers = collectObjects(root, (value) => value?.transcriptSegmentRenderer).map(
    (value) => value.transcriptSegmentRenderer
  );

  return segmentRenderers
    .map((segment) => ({
      startMs: Number(segment.startMs || 0),
      durationMs:
        Number(segment.endMs || 0) > Number(segment.startMs || 0)
          ? Number(segment.endMs || 0) - Number(segment.startMs || 0)
          : 4000,
      text: readRunsText(segment.snippet) || readRunsText(segment.cue) || ""
    }))
    .filter((entry) => entry.text);
}

function readRunsText(node) {
  if (!node) {
    return "";
  }
  if (typeof node.simpleText === "string") {
    return node.simpleText.trim();
  }
  if (Array.isArray(node.runs)) {
    return node.runs
      .map((run) => run?.text || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function findFirstObject(root, predicate) {
  const queue = [root];
  const seen = new Set();

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (predicate(value)) {
      return value;
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        queue.push(child);
      }
    }
  }

  return null;
}

function collectObjects(root, predicate) {
  const queue = [root];
  const seen = new Set();
  const results = [];

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (predicate(value)) {
      results.push(value);
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        queue.push(child);
      }
    }
  }

  return results;
}

function summarizeCaptionTrack(track) {
  if (!track) {
    return null;
  }

  return {
    languageCode: track.languageCode || "",
    vssId: track.vssId || "",
    kind: track.kind || "",
    name: track.name?.simpleText || "",
    baseUrl: track.baseUrl || ""
  };
}

function normalizeTranscriptPayload(events) {
  return events
    .filter((event) => Array.isArray(event.segs))
    .map((event) => {
      const text = event.segs
        .map((seg) => seg.utf8 || "")
        .join("")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        startMs: event.tStartMs || 0,
        durationMs: event.dDurationMs || 4000,
        text
      };
    })
    .filter((entry) => entry.text && !/^\[.*\]$/.test(entry.text))
    .filter((entry, index, array) => index === 0 || entry.text !== array[index - 1].text);
}

function normalizeTranscriptEntries(entries) {
  return entries
    .map((entry) => ({
      startMs: entry.startMs || 0,
      durationMs: entry.durationMs || 4000,
      text: String(entry.text || "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }))
    .filter((entry) => entry.text && !/^\[.*\]$/.test(entry.text))
    .filter((entry, index, array) => index === 0 || entry.text !== array[index - 1].text);
}

function applyPartialStudyPack(partialPack, partialIndex = 1, partialTotal = 1) {
  const partialOutline = normalizeOutlineItems(partialPack?.outline || []);
  if (!partialOutline.length) {
    return;
  }

  const currentPack = state.studyPack || createEmptyStudyPack(partialPack?.title);
  state.studyPackFinal = false;
  state.studyPack = {
    ...currentPack,
    title: currentPack.title || partialPack?.title || state.videoTitle || "",
    summary: "",
    outline: mergeOutlineItems(currentPack.outline || [], partialOutline),
    lectureNotes: [],
    concepts: [],
    tags: [],
    questions: [],
    transcript: state.transcript
  };
  state.activeTab = "outline";
  setStatus(uiPartialOutlineReady(state.studyPack.outline.length, partialIndex, partialTotal));
}

function createEmptyStudyPack(title = "") {
  return {
    title: title || state.videoTitle || "",
    summary: "",
    outline: [],
    lectureNotes: [],
    concepts: [],
    tags: [],
    questions: [],
    transcript: state.transcript
  };
}

function mergeOutlineItems(existingItems, nextItems) {
  const seen = new Set();
  return [...normalizeOutlineItems(existingItems), ...normalizeOutlineItems(nextItems)]
    .filter((item) => {
      const key = `${item.timestamp || ""}|${item.heading || ""}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => Number(left.seconds || 0) - Number(right.seconds || 0));
}

function normalizeOutlineItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const seconds = Number(item?.seconds);
      const startMs = Number.isFinite(seconds) ? seconds * 1000 : parseTimestampToMs(item?.timestamp);
      return {
        timestamp: item?.timestamp || formatTime(startMs),
        seconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : Math.floor(startMs / 1000),
        heading: String(item?.heading || "").trim(),
        bullets: Array.isArray(item?.bullets)
          ? item.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
          : []
      };
    })
    .filter((item) => item.heading || item.bullets.length);
}

function parseTimestampToMs(timestamp) {
  const parts = String(timestamp || "")
    .split(":")
    .map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Math.max(0, seconds * 1000);
}

async function generateStudyPack() {
  const videoIdAtStart = state.videoId;
  state.settings.outputLanguage = "zh-CN";
  setProgress(state.transcript.length ? 35 : 5, uiText("progressPreparing"), true);
  if (!state.transcript.length) {
    await loadTranscript();
  }

  if (!state.transcript.length || state.videoId !== videoIdAtStart) {
    return;
  }

  setBusy(true, uiText("generating"), "generate", true);

  try {
    state.usedFallback = false;
    if (!state.settings.deepseekApiKey) {
      setProgress(100, uiText("statusDeepSeekKeyMissing"), true);
      setStatus(uiText("statusDeepSeekKeyMissing"), true);
      return;
    }

    try {
      setProgress(40, uiText("progressDeepSeekPreparing"), true);
      state.studyPack = createEmptyStudyPack();
      state.studyPackFinal = false;
      render();
      state.studyPack = await runDeepSeekStudyPack();
      state.studyPackFinal = true;
      setProgress(90, uiText("progressSaving"), true);
      setStatus(uiText("statusStudyPackReady"));
    } catch (error) {
      const message = uiError("deepSeekUnavailable", error);
      setProgress(100, message, true);
      setStatus(message, true);
      return;
    }
    if (state.videoId === videoIdAtStart) {
      await persistVideoCache();
      setProgress(100, uiText("progressDone"), true);
    }
  } catch (error) {
    setStatus(uiError("studyPackFailed", error), true);
  } finally {
    setBusy(false);
    render();
  }
}

async function runDeepSeekStudyPack() {
  const response = await chrome.runtime.sendMessage({
    type: "RUN_DEEPSEEK_ANALYSIS",
    payload: {
      transcript: state.transcript,
      videoTitle: state.videoTitle,
      videoId: state.videoId,
      settings: state.settings
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "DeepSeek 分析失败。");
  }

  return {
    ...response.result,
    summary: "",
    lectureNotes: [],
    concepts: [],
    tags: [],
    questions: []
  };
}

function exportMarkdown() {
  if (!state.studyPackFinal || !state.studyPack) {
    setStatus(uiText("noStudyPackExport"), true);
    render();
    return;
  }

  const markdown = buildMarkdown(state.studyPack);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(state.videoTitle || "mit-lecture-study-pack")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(uiText("statusMarkdownExported"));
  render();
}

async function copyStudyPack() {
  if (!state.studyPackFinal || !state.studyPack) {
    setStatus(uiText("noStudyPackCopy"), true);
    render();
    return;
  }

  await navigator.clipboard.writeText(buildMarkdown(state.studyPack));
  setStatus(uiText("statusStudyPackCopied"));
  render();
}

async function hydrateVideoCache() {
  if (!state.videoId) {
    return;
  }

  const cacheKey = getVideoCacheKey(state.videoId);
  const stored = await chrome.storage.local.get(cacheKey);
  const cached = stored[cacheKey];
  if (!cached) {
    return;
  }

  state.transcript = Array.isArray(cached.transcript) ? cached.transcript : [];
  state.studyPack = isCurrentStudyPackCache(cached) ? cached.studyPack : null;
  state.studyPackFinal = Boolean(state.studyPack);
  state.visualAnalysis = Array.isArray(cached.visualAnalysis)
    ? mergeVisualAnalysisItems([], cached.visualAnalysis)
    : [];
  if (state.visualAnalysis.length) {
    state.visualAnalysisStatus = uiText("visualStatusReady");
  }
  setStatus(
    state.studyPack
      ? uiText("statusRestoredStudyPack")
      : cached.studyPack
        ? uiText("statusRestoredTranscriptOutdatedPack")
        : uiText("statusRestoredTranscript")
  );
}

async function persistVideoCache(options = {}) {
  if (!state.videoId || !state.studyPackFinal) {
    return;
  }

  const cacheKey = getVideoCacheKey(state.videoId);
  const updatedAt = new Date().toISOString();
  await chrome.storage.local.set({
    [cacheKey]: {
      updatedAt,
      videoTitle: state.videoTitle,
      videoUrl: getVideoUrl(),
      publishedAt: getVideoPublishedAt(),
      watchTimeSeconds: getCurrentWatchTimeSeconds(),
      durationSeconds: getVideoDurationSeconds(),
      studyPackCacheVersion: STUDY_PACK_CACHE_VERSION,
      transcript: state.transcript,
      studyPack: state.studyPack,
      visualAnalysis: state.visualAnalysis
    }
  });
  await saveLibraryIndexEntry(updatedAt);
  await pushRecentLecture(updatedAt);
  if (!options.skipCsv) {
    await saveLectureCsv(updatedAt);
  }
}

function getVideoCacheKey(videoId) {
  return `studyPack:${videoId}`;
}

async function loadRecentLectures() {
  const stored = await chrome.storage.local.get("recentLectures");
  state.recentLectures = Array.isArray(stored.recentLectures) ? stored.recentLectures : [];
}

async function clearRecentLectures() {
  state.recentLectures = [];
  await chrome.storage.local.remove("recentLectures");
  setStatus(uiText("statusRecentHistoryCleared"));
  render();
}

async function pushRecentLecture(updatedAt = new Date().toISOString()) {
  if (!state.videoId || !state.videoTitle) {
    return;
  }

  const nextItem = {
    videoId: state.videoId,
    videoTitle: state.videoTitle,
    updatedAt
  };

  const deduped = state.recentLectures.filter((item) => item.videoId !== state.videoId);
  state.recentLectures = [nextItem, ...deduped].slice(0, 8);
  await chrome.storage.local.set({ recentLectures: state.recentLectures });
}

async function loadLibraryIndex() {
  const stored = await chrome.storage.local.get(LIBRARY_INDEX_KEY);
  state.libraryIndex = normalizeLibraryIndex(stored[LIBRARY_INDEX_KEY]);
}

function normalizeLibraryIndex(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => item?.videoId)
        .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    : [];
}

async function saveLibraryIndexEntry(updatedAt) {
  if (!state.videoId || !state.studyPackFinal || !state.studyPack) {
    return;
  }

  const nextEntry = buildLibraryIndexEntry(updatedAt);
  const deduped = state.libraryIndex.filter((item) => item.videoId !== state.videoId);
  state.libraryIndex = [nextEntry, ...deduped].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
  await chrome.storage.local.set({ [LIBRARY_INDEX_KEY]: state.libraryIndex });
}

function buildLibraryIndexEntry(updatedAt) {
  const pack = state.studyPack || {};

  return {
    videoId: state.videoId,
    videoTitle: state.videoTitle || pack.title || "",
    updatedAt,
    summary: "",
    tags: [],
    conceptTerms: [],
    questionCount: 0,
    visualCount: state.visualAnalysis.length,
    searchText: buildLibrarySearchText(pack, state.transcript, state.visualAnalysis)
  };
}

async function saveLectureCsv(savedAt) {
  if (!state.studyPackFinal || !state.studyPack) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_LECTURE_CSV",
      payload: buildLectureCsvRecord(savedAt)
    });

    if (response?.ok) {
      writeDebug("lecture-csv-saved", response.result || {});
      setStatus(uiText("statusCsvSaved"));
      return;
    }

    writeDebug("lecture-csv-save-skipped", {
      error: response?.error || "csv-service-unavailable"
    });
  } catch (error) {
    writeDebug("lecture-csv-save-skipped", {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  setStatus(uiText("statusCsvSaveSkipped"), true);
}

function buildLectureCsvRecord(savedAt) {
  const pack = state.studyPack || {};
  return {
    video_id: state.videoId,
    video_url: getVideoUrl(),
    video_title: state.videoTitle || pack.title || "",
    published_at: getVideoPublishedAt(),
    watched_at: new Date().toISOString(),
    watch_time_seconds: String(getCurrentWatchTimeSeconds()),
    duration_seconds: String(getVideoDurationSeconds()),
    saved_at: savedAt,
    transcript_line_count: String(state.transcript.length),
    transcript_text: buildTranscriptText(state.transcript),
    transcript_json: JSON.stringify(state.transcript || []),
    visual_analysis_json: JSON.stringify(state.visualAnalysis || []),
    summary: "",
    tags: "",
    tags_json: "[]",
    outline_json: JSON.stringify(pack.outline || []),
    lecture_notes_json: "[]",
    concepts_json: "[]",
    questions_json: "[]",
    study_pack_markdown: buildMarkdown(pack)
  };
}

function getVideoUrl() {
  return state.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(state.videoId)}` : window.location.href;
}

function getVideoPublishedAt() {
  return (
    window.ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer?.publishDate ||
    window.ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer?.uploadDate ||
    findPublishedDateInInitialData() ||
    readPublishedDateFromDom()
  );
}

function findPublishedDateInInitialData() {
  const initialData = readInitialDataFromWindow();
  const holder = findFirstObject(
    initialData,
    (value) =>
      typeof value?.dateText?.simpleText === "string" ||
      typeof value?.publishedTimeText?.simpleText === "string"
  );
  return holder?.dateText?.simpleText || holder?.publishedTimeText?.simpleText || "";
}

function readPublishedDateFromDom() {
  const candidates = [
    ...document.querySelectorAll("#info-strings yt-formatted-string, ytd-watch-info-text span, ytd-video-primary-info-renderer #info-strings yt-formatted-string")
  ]
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);
  return candidates.find((text) => /\d{4}|年|月|日|ago|Premiered|Published/i.test(text)) || "";
}

function getCurrentWatchTimeSeconds() {
  const player = document.querySelector("video");
  return player instanceof HTMLVideoElement ? Math.floor(player.currentTime || 0) : 0;
}

function getVideoDurationSeconds() {
  const player = document.querySelector("video");
  return player instanceof HTMLVideoElement && Number.isFinite(player.duration)
    ? Math.floor(player.duration || 0)
    : 0;
}

function buildTranscriptText(transcript) {
  return (transcript || [])
    .map((entry) => `[${formatTime(entry.startMs)}] ${entry.text}`)
    .join("\n");
}

function buildLibrarySearchText(pack, transcript, visualAnalysis = []) {
  const chunks = [
    pack.title,
    state.videoTitle,
    ...(pack.outline || []).flatMap((item) => [item.heading, ...(item.bullets || [])]),
    ...(transcript || []).map((item) => item.text),
    ...(visualAnalysis || []).flatMap((item) => [
      item.title,
      item.relationToTranscript,
      ...(item.bullets || []),
      ...(item.visibleText || [])
    ])
  ];

  return chunks
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIBRARY_SEARCH_TEXT_LIMIT)
    .toLowerCase();
}

async function loadLibraryItem(videoId) {
  const stored = await chrome.storage.local.get(getVideoCacheKey(videoId));
  const cached = stored[getVideoCacheKey(videoId)];
  if (!cached?.studyPack) {
    setStatus(uiText("statusLibraryItemMissing"), true);
    render();
    return;
  }
  if (!isCurrentStudyPackCache(cached)) {
    setStatus(uiText("statusLibraryItemOutdated"), true);
    render();
    return;
  }

  state.videoId = videoId;
  state.videoTitle = cached.videoTitle || cached.studyPack.title || state.videoTitle;
  state.transcript = Array.isArray(cached.transcript) ? cached.transcript : [];
  state.studyPack = cached.studyPack;
  state.visualAnalysis = Array.isArray(cached.visualAnalysis)
    ? mergeVisualAnalysisItems([], cached.visualAnalysis)
    : [];
  state.studyPackFinal = true;
  state.activeTab = "outline";
  state.usedFallback = false;
  setStatus(uiText("statusLibraryItemLoaded"));
  await pushRecentLecture(cached.updatedAt || new Date().toISOString());
  render();
}

function isCurrentStudyPackCache(cached) {
  return cached?.studyPackCacheVersion === STUDY_PACK_CACHE_VERSION && Boolean(cached?.studyPack);
}

function buildMarkdown(pack) {
  const lines = [
    `# ${pack.title || state.videoTitle || uiText("markdownFallbackTitle")}`,
    ""
  ];

  lines.push(`## ${uiText("markdownOutline")}`, "");
  for (const item of pack.outline || []) {
    lines.push(`### ${item.timestamp} ${item.heading}`);
    for (const bullet of item.bullets || []) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  if (state.visualAnalysis.length) {
    lines.push(`## ${uiText("markdownVisual")}`, "");
    for (const item of state.visualAnalysis) {
      lines.push(`### ${item.timestamp} ${item.title || uiText("visualAnalysis")}`);
      for (const bullet of item.bullets || []) {
        lines.push(`- ${bullet}`);
      }
      if (item.visibleText?.length) {
        lines.push(`- ${uiText("visualVisibleText")}：${item.visibleText.join("；")}`);
      }
      if (item.relationToTranscript) {
        lines.push(`- ${uiText("visualRelation")}：${item.relationToTranscript}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function jumpToTime(seconds) {
  const player = document.querySelector("video");
  if (!(player instanceof HTMLVideoElement)) {
    return;
  }
  player.currentTime = seconds;
  player.play().catch(() => void 0);
}

function setBusy(isBusy, statusText = state.statusText, busyAction = "", shouldRender = false) {
  state.isBusy = isBusy;
  state.busyAction = isBusy ? busyAction : "";
  if (isBusy) {
    setStatus(statusText, false);
  }
  if (shouldRender) {
    render();
  }
}

function setProgress(percent, label, visible = true, shouldRender = false) {
  state.progress = {
    visible,
    percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
    label: label || uiText("progressIdle")
  };
  writeDebug("progress", state.progress);
  if (shouldRender) {
    render();
  }
}

function setStatus(text, isError = false) {
  state.statusText = text;
  state.statusError = isError;
  writeDebug("status", {
    text,
    isError
  });
}

function clearCaptionDebug() {
  state.lastCaptionDebug = null;
  state.debugLog = [];
}

function recordCaptionDebug(partial) {
  state.lastCaptionDebug = {
    ...(state.lastCaptionDebug || {}),
    ...partial
  };
}

function writeDebug(event, payload = null) {
  const entry = {
    at: new Date().toISOString(),
    event,
    payload
  };

  state.debugLog = [...state.debugLog.slice(-39), entry];
  console.log("[MIT Study]", event, payload);
}

function render() {
  const root = document.getElementById(APP_ROOT_ID);
  const host = document.getElementById(SIDEBAR_HOST_ID);
  if (!(root instanceof HTMLElement) || !(host instanceof HTMLElement)) {
    return;
  }

  normalizeActiveTab();
  host.style.width = sidebarWidthCssValue();
  host.classList.toggle("is-collapsed", !state.sidebarOpen);
  root.innerHTML = getPanelMarkup();
}

function normalizeActiveTab() {
  if (!VISIBLE_TABS.has(state.activeTab)) {
    state.activeTab = "outline";
  }
}

function getPanelMarkup() {
  if (!state.videoId) {
    return `
      <button class="mit-study-reopen" type="button" aria-label="${escapeHtml(uiText("toggleSidebar"))}">${escapeHtml(uiText("reopenOutline"))}</button>
      <section class="mit-study-shell">
        <header class="mit-study-header">
          <div>
            <p class="mit-study-kicker">${escapeHtml(uiText("brand"))}</p>
            <h1>${escapeHtml(uiText("openLectureTitle"))}</h1>
          </div>
          <button class="mit-study-close" type="button" aria-label="${escapeHtml(uiText("toggleSidebar"))}">${state.sidebarOpen ? "×" : "≡"}</button>
        </header>
        <section class="mit-study-summary-card">
          <span class="mit-study-label">${escapeHtml(uiText("readyState"))}</span>
          <p>${escapeHtml(uiText("readyCopy"))}</p>
        </section>
        <section class="mit-study-toolbar">
          <button data-action="open-settings" class="mit-study-button">${escapeHtml(uiText("settings"))}</button>
        </section>
      </section>
    `;
  }

  const closeLabel = state.sidebarOpen ? "×" : "≡";
  const isGeneratingStudyPack = state.isBusy && state.busyAction === "generate";
  const statusLabel = state.studyPackFinal ? uiText("statusStudyPackReady") : state.statusText;

  return `
    <button class="mit-study-reopen" type="button" aria-label="${escapeHtml(uiText("toggleSidebar"))}">${escapeHtml(uiText("reopenOutline"))}</button>
    <section class="mit-study-shell">
      <header class="mit-study-header">
        <div>
          <p class="mit-study-kicker">${escapeHtml(uiText("brand"))}</p>
          <h1>${escapeHtml(uiText("title"))}</h1>
        </div>
        <button class="mit-study-close" type="button" aria-label="${escapeHtml(uiText("toggleSidebar"))}">${closeLabel}</button>
      </header>

      <section class="mit-study-toolbar">
        <button data-action="generate" class="mit-study-button ${isGeneratingStudyPack ? "is-loading" : ""}" ${state.isBusy ? "disabled" : ""}>${escapeHtml(isGeneratingStudyPack ? uiText("generating") : uiText("generateStudyPack"))}</button>
        <button data-action="export-markdown" class="mit-study-button">${escapeHtml(uiText("exportMd"))}</button>
        <button data-action="copy-pack" class="mit-study-button">${escapeHtml(uiText("copy"))}</button>
      </section>

      <section class="mit-study-summary-card">
        <div class="mit-study-compact-meta">
          <strong data-slot="title">${escapeHtml(state.videoTitle || uiText("waitingForLecture"))}</strong>
          <span class="${state.statusError ? "mit-study-warning" : ""}">${escapeHtml(statusLabel)}</span>
        </div>
        <p>${escapeHtml(getSummaryText())}</p>
        ${renderProgressBar()}
      </section>

      <nav class="mit-study-tabs" aria-label="${escapeHtml(uiText("studyViews"))}">
        ${renderTabButton("outline", uiText("outline"))}
        ${renderTabButton("visual", uiText("visual"))}
        ${renderTabButton("library", uiText("library"))}
      </nav>

      <main class="mit-study-content">
        <section class="mit-study-pane ${state.activeTab === "outline" ? "is-active" : ""}" data-pane="outline">
          ${renderOutline()}
        </section>
        <section class="mit-study-pane ${state.activeTab === "visual" ? "is-active" : ""}" data-pane="visual">
          ${renderVisualAnalysis()}
        </section>
        <section class="mit-study-pane ${state.activeTab === "library" ? "is-active" : ""}" data-pane="library">
          ${renderLibrary()}
        </section>
      </main>
    </section>
  `;
}

function getSummaryText() {
  if (state.isBusy) {
    return state.statusText;
  }
  if (state.statusError && state.statusText) {
    return state.statusText;
  }
  if (state.studyPackFinal) {
    return uiText("statusStudyPackReady");
  }
  return uiText("summaryDefault");
}

function renderProgressBar() {
  if (!state.progress.visible && !state.isBusy) {
    return "";
  }

  const percent = Math.max(0, Math.min(100, Number(state.progress.percent) || 0));
  return `
    <div class="mit-study-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <div class="mit-study-progress-topline">
        <span>${escapeHtml(state.progress.label || uiText("progressIdle"))}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="mit-study-progress-track">
        <span style="width: ${percent}%"></span>
      </div>
    </div>
  `;
}

function renderTabButton(tab, label) {
  return `<button data-tab="${tab}" class="${state.activeTab === tab ? "is-active" : ""}">${label}</button>`;
}

function renderDiagnostics() {
  const lines = getDiagnosticsEntries();
  const debug = state.lastCaptionDebug || {};
  const debugLogText = state.debugLog
    .slice(-8)
    .map((entry) => `${entry.at} | ${entry.event} | ${JSON.stringify(entry.payload || {})}`)
    .join("\n");

  return `
    <div class="mit-study-diagnostics-grid">
      ${lines
        .map(
          ([label, value]) => `
            <div class="mit-study-diagnostic-row">
              <span class="mit-study-diagnostic-label">${escapeHtml(label)}</span>
              <strong class="mit-study-diagnostic-value">${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="mit-study-debug-block">
      <span class="mit-study-label">${escapeHtml(uiText("rawPreview"))}</span>
      <pre>${escapeHtml(debug.rawPreview || "-")}</pre>
    </div>
    <div class="mit-study-debug-block">
      <span class="mit-study-label">${escapeHtml(uiText("recentDebugLog"))}</span>
      <pre>${escapeHtml(debugLogText || "-")}</pre>
    </div>
  `;
}

function getDiagnosticsEntries() {
  const debug = state.lastCaptionDebug || {};

  return [
    [uiText("diagVideoId"), state.videoId || uiText("valueNone")],
    [uiText("diagCaptionsLoaded"), String(state.transcript.length)],
    [uiText("diagCaptionTrack"), state.lastCaptionTrackLanguage || uiText("valueUnknown")],
    [
      uiText("diagCache"),
      state.studyPack
        ? uiText("valuePresent")
        : state.transcript.length
          ? uiText("valueTranscriptOnly")
          : uiText("valueEmpty")
    ],
    [uiText("diagDeepSeekModel"), state.settings.deepseekModel || uiText("valueUnset")],
    [uiText("diagDeepSeekKey"), state.settings.deepseekApiKey ? uiText("valueConfigured") : uiText("valueMissing")],
    [uiText("diagStatus"), state.statusText],
    [uiText("diagCaptionUrl"), debug.requestUrl || uiText("valueNone")],
    [
      uiText("diagHttp"),
      debug.httpStatus ? `${debug.httpStatus}${debug.contentType ? ` ${debug.contentType}` : ""}` : uiText("valueNone")
    ],
    [uiText("diagParseMode"), debug.parseMode || uiText("valueUnknown")],
    [uiText("diagEventCount"), String(debug.eventCount ?? "-")],
    [uiText("diagTrackKind"), debug.track?.kind || uiText("valueNone")],
    [uiText("diagTrackName"), debug.track?.name || uiText("valueNone")]
  ];
}

async function copyDiagnostics() {
  const debug = state.lastCaptionDebug || {};
  const text = [
    ...getDiagnosticsEntries().map(([label, value]) => `${label}: ${value}`),
    `${uiText("rawPreviewCopy")}: ${debug.rawPreview || "-"}`,
    "",
    uiText("recentDebugLogCopy"),
    ...state.debugLog
      .slice(-8)
      .map((entry) => `${entry.at} | ${entry.event} | ${JSON.stringify(entry.payload || {})}`)
  ].join("\n");
  await navigator.clipboard.writeText(text);
  setStatus(uiText("statusDiagnosticsCopied"));
  render();
}

function renderLibrary() {
  const query = state.librarySearchQuery.trim().toLowerCase();
  const items = getFilteredLibraryItems(query);

  return `
    <section class="mit-study-library-tools">
      <input
        class="mit-study-search"
        data-action="search-library"
        type="search"
        value="${escapeHtml(state.librarySearchQuery)}"
        placeholder="${escapeHtml(uiText("librarySearchPlaceholder"))}"
      />
    </section>
    ${renderLibraryResults(items, Boolean(query))}
  `;
}

function getFilteredLibraryItems(query) {
  if (!query) {
    return state.libraryIndex;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  return state.libraryIndex.filter((item) => {
    const haystack = [
      item.videoTitle,
      item.summary,
      ...(item.tags || []),
      ...(item.conceptTerms || []),
      item.searchText
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

function renderLibraryResults(items, hasQuery) {
  if (!state.libraryIndex.length) {
    return renderEmpty(uiText("libraryEmpty"));
  }
  if (!items.length) {
    return renderEmpty(hasQuery ? uiText("libraryNoResults") : uiText("libraryEmpty"));
  }

  return items
    .map((item) => {
      const href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
      return `
        <article class="mit-study-library-item">
          <div class="mit-study-item-topline">
            <small>${escapeHtml(formatRelativeDate(item.updatedAt))}</small>
            <div class="mit-study-inline-actions">
              <button class="mit-study-link" data-action="load-library-item" data-video-id="${escapeHtml(item.videoId)}" type="button">${escapeHtml(uiText("libraryLoad"))}</button>
              <a class="mit-study-link" href="${href}">${escapeHtml(uiText("libraryOpenVideo"))}</a>
            </div>
          </div>
          <h3>${escapeHtml(item.videoTitle || item.videoId)}</h3>
          ${item.visualCount ? `<div class="mit-study-library-meta"><span>${escapeHtml(uiText("visualAnalysis"))} ${item.visualCount}</span></div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderOutline() {
  if (!state.studyPack?.outline?.length) {
    return renderEmpty(state.isBusy ? uiText("emptyOutlineGenerating") : uiText("emptyOutline"));
  }

  return state.studyPack.outline
    .map(
      (item) => `
        <article class="mit-study-item">
          <div class="mit-study-item-topline">
            <span class="mit-study-time">${escapeHtml(item.timestamp)}</span>
            <button class="mit-study-link" data-action="jump" data-seconds="${item.seconds || 0}">${escapeHtml(uiText("jump"))}</button>
          </div>
          <h3>${escapeHtml(item.heading)}</h3>
          <ul>${(item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        </article>
      `
    )
    .join("");
}

function renderVisualAnalysis() {
  const statusClass = state.visualAnalysisError ? " mit-study-warning" : "";
  const status = `
    <section class="mit-study-visual-status${statusClass}">
      ${escapeHtml(state.visualAnalysisStatus || uiText("visualStatusIdle"))}
      ${state.visualAnalysisError ? `<small>${escapeHtml(state.visualAnalysisError)}</small>` : ""}
    </section>
  `;

  if (!state.visualAnalysis.length) {
    return `${status}${renderEmpty(uiText("emptyVisual"))}`;
  }

  return (
    status +
    state.visualAnalysis
      .map(
        (item) => `
          <article class="mit-study-item mit-study-visual-item">
            <div class="mit-study-item-topline">
              <span class="mit-study-time">${escapeHtml(item.timestamp)}</span>
              <button class="mit-study-link" data-action="jump" data-seconds="${item.seconds || 0}">${escapeHtml(uiText("jump"))}</button>
            </div>
            <h3>${escapeHtml(item.title || uiText("visualAnalysis"))}</h3>
            ${item.bullets?.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
            ${item.visibleText?.length ? `<p><strong>${escapeHtml(uiText("visualVisibleText"))}：</strong>${escapeHtml(item.visibleText.join("；"))}</p>` : ""}
            ${item.relationToTranscript ? `<p><strong>${escapeHtml(uiText("visualRelation"))}：</strong>${escapeHtml(item.relationToTranscript)}</p>` : ""}
          </article>
        `
      )
      .join("")
  );
}

function renderEmpty(message) {
  return `<div class="mit-study-empty">${escapeHtml(message)}</div>`;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatRelativeDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return uiText("saved");
  }

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) {
    return uiText("justNow");
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} ${uiText("minAgo")}`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${uiText("hoursAgo")}`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ${uiText("daysAgo")}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
