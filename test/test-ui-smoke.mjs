import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function loadText(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

function buildMockChrome(syncOverrides = {}) {
  const syncStore = {
    autoAnalyze: false,
    sidebarWidth: 420,
    deepseekApiKey: "mock-key",
    deepseekBaseUrl: "https://api.deepseek.com",
    deepseekModel: "deepseek-v4-flash",
    visualScanIntervalSeconds: 45,
    outputLanguage: "zh-CN",
    noteTone: "study-handout",
    ...syncOverrides
  };

  const localStore = {
    localSaveDirectoryName: "MockSave",
    recentLectures: []
  };

  const syncListeners = [];
  const runtimeListeners = [];
  const messages = [];

  return {
    __messages: messages,
    __runtimeListeners: runtimeListeners,
    __emitRuntimeMessage(message) {
      for (const listener of runtimeListeners) {
        listener(message, { tab: { id: 1 } }, () => {});
      }
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        }
      },
      getURL(path) {
        return `chrome-extension://test-extension/${path}`;
      },
      async sendMessage(message) {
        messages.push(message);
        if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
          return {
            ok: true,
            result: {
              title: "模拟标题",
              outline: []
            }
          };
        }
        if (message?.type === "RUN_DEEPSEEK_VISUAL_TEXT_ANALYSIS") {
          return {
            ok: true,
            result: {
              title: "事件触发的 PPT 分析",
              visualType: "ppt",
              bullets: ["通过 timeupdate 或回前台补扫触发。"],
              relationToTranscript: "对应当前播放位置的字幕上下文。",
              tags: ["PPT", "事件触发"]
            }
          };
        }
        if (message?.type === "CAPTURE_VISIBLE_TAB") {
          return {
            ok: true,
            result: {
              dataUrl:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg=="
            }
          };
        }
        if (message?.type === "TEST_DEEPSEEK_CONNECTION") {
          return {
            ok: true,
            result: {
              status: "ok",
              model: syncStore.deepseekModel,
              message: "ok"
            }
          };
        }
        if (message?.type === "SAVE_LECTURE_LOCAL") {
          return {
            ok: true,
            result: {
              csvPath: "MockSave/lecture_library.csv",
              lecturePath: "MockSave/lectures/mock",
              rowCount: 1
            }
          };
        }
        return { ok: true };
      },
      openOptionsPage() {}
    },
    tabs: {
      create() {},
      async captureVisibleTab() {
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg==";
      }
    },
    storage: {
      onChanged: {
        addListener(listener) {
          syncListeners.push(listener);
        }
      },
      sync: {
        async get(keys) {
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, syncStore[key]]));
          }
          return { ...syncStore };
        },
        async set(payload) {
          for (const [key, value] of Object.entries(payload)) {
            syncStore[key] = value;
          }
          const changes = Object.fromEntries(
            Object.entries(payload).map(([key, value]) => [
              key,
              { oldValue: undefined, newValue: value }
            ])
          );
          for (const listener of syncListeners) {
            listener(changes, "sync");
          }
        }
      },
    local: {
        async get(key) {
          if (key === null) {
            return { ...localStore };
          }
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((entry) => [entry, localStore[entry]]));
          }
          if (typeof key === "string") {
            return { [key]: localStore[key] };
          }
          return { ...localStore };
        },
        async set(payload) {
          Object.assign(localStore, payload);
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete localStore[key];
          }
        }
      }
    }
  };
}

function installClipboardMock(window) {
  let clipboardText = "";
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      async writeText(text) {
        clipboardText = text;
      },
      async readText() {
        return clipboardText;
      }
    },
    configurable: true
  });
}

function installCanvasMock(window, options = {}) {
  const getPixelSeed = () => Math.max(1, Math.floor(Number(options.seed?.() || 80)));
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return {
      fillStyle: "#ffffff",
      fillRect() {},
      drawImage(source) {
        if (options.failVideoDraw?.() && source instanceof window.HTMLVideoElement) {
          throw new Error("hidden video frame unavailable");
        }
      },
      getImageData(_x, _y, width, height) {
        const data = new Uint8ClampedArray(Math.max(1, width * height * 4));
        const seed = getPixelSeed();
        for (let index = 0; index < data.length; index += 4) {
          data[index] = seed;
          data[index + 1] = Math.max(0, seed - 20);
          data[index + 2] = Math.max(0, seed - 40);
          data[index + 3] = 255;
        }
        return { data };
      }
    };
  };
  window.HTMLCanvasElement.prototype.toDataURL = () =>
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg==";
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function testPopup() {
  const html = await loadText("src/popup.html");
  const script = await loadText("src/popup.js");
  const dom = new JSDOM(html, {
    url: "https://extension-popup.test/",
    runScripts: "dangerously"
  });

  try {
    dom.window.chrome = buildMockChrome();
    installClipboardMock(dom.window);
    dom.window.eval(script);

    const title = dom.window.document.querySelector("h1")?.textContent || "";
    assert.match(title, /课程大纲学习工具/);
  } finally {
    dom.window.close();
  }
}

async function testOptions() {
  const html = await loadText("src/options.html");
  const script = await loadText("src/options.js");
  const dom = new JSDOM(html, {
    url: "https://extension-options.test/",
    runScripts: "dangerously"
  });

  try {
    dom.window.chrome = buildMockChrome();
    installClipboardMock(dom.window);
    dom.window.eval(script);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const heading = dom.window.document.querySelector("h1")?.textContent || "";
    assert.match(heading, /插件设置/);
    const modelInput = dom.window.document.querySelector('input[name="deepseekModel"]');
    assert.equal(modelInput?.value, "deepseek-v4-flash");
    const autoAnalyzeInput = dom.window.document.querySelector('input[name="autoAnalyze"]');
    assert.equal(autoAnalyzeInput?.checked, false);
    assert.match(dom.window.document.body.textContent || "", /自动分析课程视频/);
    assert.match(dom.window.document.body.textContent || "", /默认关闭/);
    const visualIntervalInput = dom.window.document.querySelector('input[name="visualScanIntervalSeconds"]');
    assert.equal(visualIntervalInput?.value, "45");
    const localSaveInput = dom.window.document.querySelector('input[name="localSaveDirectoryName"]');
    assert.equal(localSaveInput?.value, "MockSave");
    assert.match(dom.window.document.body.textContent || "", /本地保存目录/);
    assert.match(dom.window.document.body.textContent || "", /lecture_library\.csv/);
    assert.equal(dom.window.document.querySelector('button[id^="test-"][id$="vision"]'), null);
    assert.match(dom.window.document.body.textContent || "", /浏览器本地筛选关键帧/);
  } finally {
    dom.window.close();
  }
}

async function testAutoAnalyzeDisabledByDefault() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Entertainment Video - YouTube</title></head><body><h1 class="title">Entertainment Video</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=fun000",
      runScripts: "dangerously"
    }
  );

  const chrome = buildMockChrome();
  dom.window.chrome = chrome;
  installClipboardMock(dom.window);
  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 520));

  const summaryText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(summaryText, /自动分析已关闭/);
  assert.equal(chrome.__messages.some((message) => message?.type === "RUN_DEEPSEEK_ANALYSIS"), false);
  assert.equal(chrome.__messages.some((message) => message?.type === "CAPTURE_VISIBLE_TAB"), false);
  dom.window.close();
}

async function testSidebar() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke123",
      runScripts: "dangerously"
    }
  );

  dom.window.chrome = buildMockChrome({ autoAnalyze: true });
  installClipboardMock(dom.window);
  dom.window.ytInitialData = {
    engagementPanels: [
      {
        engagementPanelSectionListRenderer: {
          panelIdentifier: "engagement-panel-searchable-transcript",
          content: {
            transcriptRenderer: {
              content: {
                transcriptSearchPanelRenderer: {
                  body: {
                    transcriptSegmentListRenderer: {
                      initialSegments: [
                        {
                          transcriptSegmentRenderer: {
                            startMs: "0",
                            endMs: "2000",
                            snippet: {
                              runs: [{ text: "Direct transcript line." }]
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  };
  dom.window.ytInitialPlayerResponse = {
    videoDetails: { title: "MIT Sidebar Smoke" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: "https://www.youtube.com/api/timedtext?v=smoke123&lang=en",
            languageCode: "en"
          }
        ]
      }
    }
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);

  await new Promise((resolve) => setTimeout(resolve, 520));

  const sidebar = dom.window.document.getElementById("mit-study-sidebar-host");
  assert.ok(sidebar, "sidebar host should be injected");
  assert.match(sidebar.textContent || "", /MIT 课程学习/);

  const closeButton = dom.window.document.querySelector(".mit-study-close");
  closeButton.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sidebar.classList.contains("is-collapsed"), true);
  assert.equal(dom.window.getComputedStyle(sidebar).transform, "");
  const reopenButton = dom.window.document.querySelector(".mit-study-reopen");
  assert.match(reopenButton?.textContent || "", /打开大纲/);
  reopenButton.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sidebar.classList.contains("is-collapsed"), false);

  assert.equal(dom.window.document.querySelector('[data-action="toggle-diagnostics"]'), null);
  assert.equal(dom.window.document.querySelector(".mit-study-diagnostics-card"), null);
  assert.equal(dom.window.document.querySelector(".mit-study-history-card"), null);
  assert.equal(dom.window.document.querySelector('[data-action="fetch-captions"]'), null);
  assert.equal(dom.window.document.querySelector('[data-tab="transcript"]'), null);
  const summaryText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(summaryText, /已保存到本地目录|大纲已生成/);
  assert.equal(dom.window.chrome.__messages.some((message) => message?.type === "SAVE_LECTURE_LOCAL"), true);
  assert.equal(dom.window.chrome.__messages.some((message) => message?.type === "SAVE_LECTURE_CSV"), false);
  dom.window.close();
}

async function testSidebarDeepSeekFailureShowsError() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke456",
      runScripts: "dangerously"
    }
  );

  const chrome = buildMockChrome({ autoAnalyze: true });
  installClipboardMock(dom.window);
  chrome.runtime.sendMessage = async (message) => {
    chrome.__messages.push(message);
    if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
      return { ok: false, error: "mock DeepSeek outage" };
    }
    if (message?.type === "SAVE_LECTURE_LOCAL") {
      return { ok: true, result: { csvPath: "MockSave/lecture_library.csv", rowCount: 1 } };
    }
    return { ok: true };
  };

  dom.window.chrome = chrome;
  dom.window.ytInitialPlayerResponse = {
    videoDetails: { title: "MIT Sidebar Smoke" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: "data:application/json,%7B%22events%22%3A%5B%7B%22tStartMs%22%3A0,%22dDurationMs%22%3A3000,%22segs%22%3A%5B%7B%22utf8%22%3A%22Local%20fallback%20caption%20line.%22%7D%5D%7D%5D%7D",
            languageCode: "en"
          }
        ]
      }
    }
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 20));

  await chrome.storage.local.set({
    "studyPack:smoke456": {
      updatedAt: new Date().toISOString(),
      videoTitle: "MIT Sidebar Smoke",
      transcript: [
        {
          startMs: 0,
          durationMs: 3000,
          text: "Local fallback caption line."
        }
      ],
      studyPack: null
    }
  });

  dom.window.dispatchEvent(new dom.window.Event("yt-navigate-finish"));
  await new Promise((resolve) => setTimeout(resolve, 520));

  const summaryText = dom.window.document.querySelector(".mit-study-summary-card p")?.textContent || "";

  assert.match(summaryText, /DeepSeek 生成失败|mock DeepSeek outage/);
  assert.equal(chrome.__messages.some((message) => message?.type === "SAVE_LECTURE_CSV"), false);

  const libraryStored = await chrome.storage.local.get("lectureLibrary:index");
  assert.equal(libraryStored["lectureLibrary:index"]?.length || 0, 0);
  dom.window.close();
}

async function testCaptionTrackFallback() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke789",
      runScripts: "dangerously"
    }
  );

  dom.window.chrome = buildMockChrome({ autoAnalyze: true });
  dom.window.chrome.runtime.getURL = undefined;
  installClipboardMock(dom.window);
  dom.window.ytInitialPlayerResponse = {
    videoDetails: { title: "MIT Sidebar Smoke" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl:
              "https://www.youtube.com/api/timedtext?v=smoke789&lang=en&kind=asr&variant=gemini",
            languageCode: "en",
            kind: "asr",
            name: { simpleText: "English (auto-generated)" }
          },
          {
            baseUrl: "https://www.youtube.com/api/timedtext?v=smoke789&lang=en",
            languageCode: "en",
            name: { simpleText: "English" }
          }
        ]
      }
    }
  };

  const timedTextDeferred = createDeferred();
  dom.window.fetch = async (url) => {
    if (String(url).includes("variant=gemini")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html; charset=UTF-8" },
        text: async () => ""
      };
    }

    await timedTextDeferred.promise;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          events: [
            {
              tStartMs: 0,
              dDurationMs: 2000,
              segs: [{ utf8: "Recovered from fallback track." }]
            }
          ]
        })
    };
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(dom.window.document.querySelector('[data-action="fetch-captions"]'), null);
  assert.equal(dom.window.document.querySelector('[data-tab="transcript"]'), null);
  await new Promise((resolve) => setTimeout(resolve, 430));

  const loadingMetaText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(loadingMetaText, /正在读取课程内容|准备生成大纲|自动生成中文大纲/);

  timedTextDeferred.resolve();
  await new Promise((resolve) => setTimeout(resolve, 520));

  const captionsCardText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(captionsCardText, /生成完成|大纲已生成/);
  assert.equal(dom.window.document.querySelector(".mit-study-diagnostics-card"), null);
  dom.window.close();
}

async function testInnertubePlayerFallback() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke321",
      runScripts: "dangerously"
    }
  );

  dom.window.chrome = buildMockChrome({ autoAnalyze: true });
  dom.window.chrome.runtime.getURL = undefined;
  installClipboardMock(dom.window);
  dom.window.yt = {
    config_: {
      INNERTUBE_API_KEY: "mock-api-key",
      INNERTUBE_CONTEXT: {
        client: {
          hl: "en",
          gl: "US",
          clientName: "WEB",
          clientVersion: "2.20250101.00.00"
        }
      }
    }
  };
  dom.window.ytInitialPlayerResponse = {
    videoDetails: { title: "MIT Sidebar Smoke" }
  };

  let sawInnertubePlayerRequest = false;
  dom.window.fetch = async (url, init = {}) => {
    if (String(url).includes("/youtubei/v1/player")) {
      sawInnertubePlayerRequest = true;
      const body = JSON.parse(String(init.body || "{}"));
      assert.equal(body.videoId, "smoke321");
      assert.equal(body.context?.client?.clientName, "ANDROID");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            videoDetails: { title: "MIT Sidebar Smoke" },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: "https://www.youtube.com/api/timedtext?v=smoke321&lang=en",
                    languageCode: "en",
                    name: { simpleText: "English" }
                  }
                ]
              }
            }
          })
      };
    }

    if (String(url).includes("api/timedtext")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            events: [
              {
                tStartMs: 0,
                dDurationMs: 1500,
                segs: [{ utf8: "Recovered from innertube player." }]
              }
            ]
          })
      };
    }

    return {
      ok: false,
      status: 404,
      headers: { get: () => "text/plain" },
      text: async () => ""
    };
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 520));

  const captionsCardText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(captionsCardText, /生成完成|大纲已生成/);
  assert.equal(sawInnertubePlayerRequest, true);
  assert.equal(dom.window.document.querySelector(".mit-study-diagnostics-card"), null);
  dom.window.close();
}

async function testTranscriptApiUsesHtmlYtcfgFallback() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke654",
      runScripts: "dangerously"
    }
  );

  dom.window.chrome = buildMockChrome({ autoAnalyze: true });
  dom.window.chrome.runtime.getURL = undefined;
  installClipboardMock(dom.window);
  dom.window.ytInitialData = {
    engagementPanels: [
      {
        engagementPanelSectionListRenderer: {
          panelIdentifier: "engagement-panel-searchable-transcript",
          content: {
            continuationItemRenderer: {
              continuationEndpoint: {
                getTranscriptEndpoint: {
                  params: "mock-transcript-params"
                }
              }
            }
          }
        }
      }
    ]
  };

  let sawTranscriptApi = false;
  dom.window.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.youtube.com/watch")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <!doctype html><html><body><script>
            ytcfg.set({
              "INNERTUBE_API_KEY": "mock-html-key",
              "INNERTUBE_CONTEXT": {
                "client": {
                  "clientName": "WEB",
                  "clientVersion": "2.20250101.00.00",
                  "hl": "en",
                  "gl": "US"
                }
              }
            });
          </script></body></html>
        `
      };
    }

    if (String(url).includes("/youtubei/v1/get_transcript")) {
      sawTranscriptApi = true;
      const body = JSON.parse(String(init.body || "{}"));
      assert.equal(body.params, "mock-transcript-params");
      assert.equal(body.context?.client?.clientName, "WEB");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            actions: [
              {
                updateEngagementPanelAction: {
                  content: {
                    transcriptRenderer: {
                      content: {
                        transcriptSearchPanelRenderer: {
                          body: {
                            transcriptSegmentListRenderer: {
                              initialSegments: [
                                {
                                  transcriptSegmentRenderer: {
                                    startMs: "0",
                                    endMs: "2000",
                                    snippet: {
                                      runs: [{ text: "Recovered through get transcript." }]
                                    }
                                  }
                                }
                              ]
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          })
      };
    }

    return {
      ok: false,
      status: 404,
      headers: { get: () => "text/plain" },
      text: async () => ""
    };
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 520));

  const captionsCardText = dom.window.document.querySelector(".mit-study-summary-card")?.textContent || "";
  assert.match(captionsCardText, /生成完成|大纲已生成/);
  assert.equal(sawTranscriptApi, true);
  dom.window.close();
}

async function testDeepSeekModeWithoutApiKeyShowsPrompt() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke999",
      runScripts: "dangerously"
    }
  );

  const chrome = buildMockChrome({ autoAnalyze: true });
  chrome.storage.sync.set({
    deepseekApiKey: ""
  });
  installClipboardMock(dom.window);
  dom.window.chrome = chrome;
  await chrome.storage.local.set({
    "studyPack:smoke999": {
      updatedAt: new Date().toISOString(),
      videoTitle: "MIT Sidebar Smoke",
      transcript: [
        {
          startMs: 0,
          durationMs: 3000,
          text: "DeepSeek mode without key."
        }
      ],
      studyPack: null
    }
  });

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 520));

  const summaryText = dom.window.document.querySelector(".mit-study-summary-card p")?.textContent || "";

  assert.match(summaryText, /缺少 DeepSeek API Key/);
  assert.equal(chrome.__messages.some((message) => message?.type === "RUN_DEEPSEEK_ANALYSIS"), false);
  assert.equal(chrome.__messages.some((message) => message?.type === "SAVE_LECTURE_CSV"), false);
  assert.equal(dom.window.document.querySelector('[data-action="toggle-diagnostics"]'), null);
  assert.equal(dom.window.document.querySelector(".mit-study-diagnostics-card"), null);
  dom.window.close();
}

async function testProgressiveOutlineRendersPartialPack() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke777",
      runScripts: "dangerously"
    }
  );

  const chrome = buildMockChrome({ autoAnalyze: true });
  const deepSeekDeferred = createDeferred();
  chrome.runtime.sendMessage = async (message) => {
    chrome.__messages.push(message);
    if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
      return deepSeekDeferred.promise;
    }
    if (message?.type === "SAVE_LECTURE_LOCAL") {
      return { ok: true, result: { csvPath: "MockSave/lecture_library.csv", rowCount: 1 } };
    }
    return { ok: true };
  };
  installClipboardMock(dom.window);
  dom.window.chrome = chrome;
  dom.window.ytInitialData = {
    engagementPanels: [
      {
        engagementPanelSectionListRenderer: {
          panelIdentifier: "engagement-panel-searchable-transcript",
          content: {
            transcriptRenderer: {
              content: {
                transcriptSearchPanelRenderer: {
                  body: {
                    transcriptSegmentListRenderer: {
                      initialSegments: [
                        {
                          transcriptSegmentRenderer: {
                            startMs: "0",
                            endMs: "2000",
                            snippet: {
                              runs: [{ text: "Progressive transcript line one." }]
                            }
                          }
                        },
                        {
                          transcriptSegmentRenderer: {
                            startMs: "2000",
                            endMs: "4000",
                            snippet: {
                              runs: [{ text: "Progressive transcript line two." }]
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  };

  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 520));

  chrome.__emitRuntimeMessage({
    type: "DEEPSEEK_ANALYSIS_PROGRESS",
    videoId: "smoke777",
    percent: 55,
    label: "已生成第 1/3 段大纲",
    partialIndex: 1,
    partialTotal: 3,
    partialPack: {
      title: "模拟课程",
      outline: [
        {
          timestamp: "00:00",
          seconds: 0,
          heading: "第一段先显示",
          bullets: ["这段大纲不等待最终合并。"]
        }
      ]
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const sidebarText = dom.window.document.getElementById("mit-study-sidebar-host")?.textContent || "";
  assert.match(sidebarText, /第一段先显示/);
  assert.match(sidebarText, /这段大纲不等待最终合并/);
  assert.match(sidebarText, /55%/);
  assert.doesNotMatch(sidebarText, /大纲已生成/);

  deepSeekDeferred.resolve({
    ok: true,
    result: {
      title: "模拟课程",
      outline: [
        {
          timestamp: "00:00",
          seconds: 0,
          heading: "最终中文大纲",
          bullets: ["最终结果会替换临时分段内容。"]
        }
      ]
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(chrome.__messages.some((message) => message?.type === "SAVE_LECTURE_CSV"), false);
  dom.window.close();
}

async function testVisualAnalysisTabRendersSeparately() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke888",
      runScripts: "dangerously"
    }
  );

  const chrome = buildMockChrome();
  await chrome.storage.local.set({
    "studyPack:smoke888": {
      updatedAt: new Date().toISOString(),
      videoTitle: "MIT Sidebar Smoke",
      studyPackCacheVersion: "outline-zh-v1",
      transcript: [
        {
          startMs: 0,
          durationMs: 3000,
          text: "Visual frame context."
        }
      ],
      studyPack: {
        title: "模拟课程",
        outline: [
          {
            timestamp: "00:00",
            seconds: 0,
            heading: "字幕大纲",
            bullets: ["字幕内容。"]
          }
        ]
      },
      visualAnalysis: [
        {
          timestamp: "00:15",
          seconds: 15,
          title: "PPT 里的流程图",
          visualType: "slides",
          shouldKeep: true,
          bullets: ["流程图展示输入到输出的路径。"],
          visibleText: ["Input", "Output"],
          relationToTranscript: "对应老师正在解释的数据流。",
          framePreview:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg==",
          ocrRegionPreview:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg==",
          keyFrame: {
            score: 0.81,
            region: { name: "left" },
            candidateScores: [
              { name: "left", score: 0.81 },
              { name: "full", score: 0.62 }
            ]
          }
        },
        {
          timestamp: "00:49",
          seconds: 49,
          title: "线性代数基础",
          visualType: "ppt",
          shouldKeep: true,
          bullets: ["介绍课程内容和计划。"],
          visibleText: ["18.06 Linear Algebra"],
          rawVisibleText: "18.06 Linear Algebra",
          relationToTranscript: "对应老师开始介绍课程。",
          keyFrame: {
            source: "local-keyframe-detector-v1",
            score: 0.73,
            stats: {
              darkRatio: 0.62,
              brightRatio: 0.08,
              meanLuma: 0.28
            }
          }
        }
      ]
    }
  });

  installClipboardMock(dom.window);
  dom.window.chrome = chrome;
  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(dom.window.document.querySelector('[data-tab="visual"]')?.textContent, "画面");
  const outlinePaneText = dom.window.document.querySelector('[data-pane="outline"]')?.textContent || "";
  assert.match(outlinePaneText, /字幕大纲/);
  assert.doesNotMatch(outlinePaneText, /PPT 里的流程图/);

  dom.window.document.querySelector('[data-tab="visual"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const visualPaneText = dom.window.document.querySelector('[data-pane="visual"]')?.textContent || "";
  assert.match(visualPaneText, /画面自动扫描/);
  assert.match(visualPaneText, /自动分析关闭/);
  assert.match(visualPaneText, /下次扫描/);
  assert.match(visualPaneText, /PPT 里的流程图/);
  assert.match(visualPaneText, /流程图展示输入到输出的路径/);
  assert.match(visualPaneText, /PPT原文/);
  assert.match(visualPaneText, /线性代数基础/);
  assert.match(visualPaneText, /板书原文/);
  assert.match(visualPaneText, /关键帧截图/);
  assert.match(visualPaneText, /OCR 识别区域/);
  assert.match(visualPaneText, /关键帧信息/);
  assert.match(visualPaneText, /画面类型/);
  assert.equal(dom.window.document.querySelectorAll('[data-pane="visual"] img').length, 2);
  dom.window.close();
}

async function testVisualAnalysisSkipsYouTubeAds() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Sidebar Smoke - YouTube</title></head><body><h1 class="title">MIT Sidebar Smoke</h1><div id="movie_player" class="html5-video-player ad-showing"></div><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke889",
      runScripts: "dangerously",
      pretendToBeVisual: true
    }
  );

  const chrome = buildMockChrome({ autoAnalyze: true });
  await chrome.storage.local.set({
    "studyPack:smoke889": {
      updatedAt: new Date().toISOString(),
      videoTitle: "MIT Sidebar Smoke",
      studyPackCacheVersion: "outline-zh-v1",
      transcript: [
        {
          startMs: 0,
          durationMs: 3000,
          text: "Visual frame context."
        }
      ],
      studyPack: {
        title: "模拟课程",
        outline: [
          {
            timestamp: "00:00",
            seconds: 0,
            heading: "字幕大纲",
            bullets: ["字幕内容。"]
          }
        ]
      },
      visualAnalysis: []
    }
  });

  installClipboardMock(dom.window);
  dom.window.chrome = chrome;
  dom.window.eval(scriptUtils);
  dom.window.eval(contentScript);
  await new Promise((resolve) => setTimeout(resolve, 80));

  const video = dom.window.document.querySelector("video");
  Object.defineProperty(video, "readyState", { value: 2, configurable: true });
  Object.defineProperty(video, "currentTime", { value: 12, configurable: true });

  dom.window.document.querySelector('[data-tab="visual"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const visualPaneText = dom.window.document.querySelector('[data-pane="visual"]')?.textContent || "";
  assert.match(visualPaneText, /检测到广告，已暂停画面分析/);
  assert.match(visualPaneText, /广告播放中/);
  assert.equal(chrome.__messages.some((message) => message?.type === "CAPTURE_VISIBLE_TAB"), false);
  assert.equal(chrome.__messages.some((message) => message?.type === "RUN_DEEPSEEK_VISUAL_TEXT_ANALYSIS"), false);
  dom.window.close();
}

async function testVisualAnalysisRescansAfterHiddenTab() {
  const scriptUtils = await loadText("src/transcript-utils-content.js");
  const contentScript = await loadText("src/content.js");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>MIT Hidden Tab Smoke - YouTube</title></head><body><h1 class="title">MIT Hidden Tab Smoke</h1><video></video></body></html>`,
    {
      url: "https://www.youtube.com/watch?v=smoke890",
      runScripts: "dangerously",
      pretendToBeVisual: true
    }
  );

  const chrome = buildMockChrome({ autoAnalyze: true, visualScanIntervalSeconds: 5 });
  const localVisionStubUrl = pathToFileURL(path.join(rootDir, "test/harness/local-vision-stub.mjs")).href;
  chrome.runtime.getURL = (resourcePath) =>
    resourcePath === "src/local-vision.js" ? localVisionStubUrl : `chrome-extension://test-extension/${resourcePath}`;
  await chrome.storage.local.set({
    "studyPack:smoke890": {
      updatedAt: new Date().toISOString(),
      videoTitle: "MIT Hidden Tab Smoke",
      studyPackCacheVersion: "outline-zh-v1",
      transcript: [
        {
          startMs: 10000,
          durationMs: 6000,
          text: "CPU instruction context."
        }
      ],
      studyPack: {
        title: "模拟课程",
        outline: [
          {
            timestamp: "00:10",
            seconds: 10,
            heading: "字幕大纲",
            bullets: ["字幕内容。"]
          }
        ]
      },
      visualAnalysis: []
    }
  });

  try {
    Object.defineProperty(dom.window.document, "visibilityState", {
      value: "hidden",
      configurable: true
    });
    installCanvasMock(dom.window, {
      failVideoDraw: () => dom.window.document.visibilityState === "hidden",
      seed: () => 120
    });
    installClipboardMock(dom.window);
    dom.window.chrome = chrome;
    dom.window.eval(scriptUtils);
    dom.window.eval(contentScript);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const video = dom.window.document.querySelector("video");
    Object.defineProperty(video, "readyState", { value: 2, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 12, configurable: true });
    Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 360, configurable: true });
    video.getBoundingClientRect = () => ({ width: 640, height: 360, left: 0, top: 0 });

    video.dispatchEvent(new dom.window.Event("timeupdate"));
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(chrome.__messages.some((message) => message?.type === "CAPTURE_VISIBLE_TAB"), false);
    assert.equal(chrome.__messages.some((message) => message?.type === "RUN_DEEPSEEK_VISUAL_TEXT_ANALYSIS"), false);

    Object.defineProperty(dom.window.document, "visibilityState", {
      value: "visible",
      configurable: true
    });
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 120));

    assert.equal(chrome.__messages.some((message) => message?.type === "RUN_DEEPSEEK_VISUAL_TEXT_ANALYSIS"), true);
    dom.window.document.querySelector('[data-tab="visual"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const visualPaneText = dom.window.document.querySelector('[data-pane="visual"]')?.textContent || "";
    assert.match(visualPaneText, /事件触发的 PPT 分析/);
    assert.match(visualPaneText, /CPU Instructions/);
  } finally {
    dom.window.close();
  }
}

async function main() {
  await testPopup();
  await testOptions();
  await testAutoAnalyzeDisabledByDefault();
  await testSidebar();
  await testSidebarDeepSeekFailureShowsError();
  await testCaptionTrackFallback();
  await testInnertubePlayerFallback();
  await testTranscriptApiUsesHtmlYtcfgFallback();
  await testDeepSeekModeWithoutApiKeyShowsPrompt();
  await testProgressiveOutlineRendersPartialPack();
  await testVisualAnalysisTabRendersSeparately();
  await testVisualAnalysisSkipsYouTubeAds();
  await testVisualAnalysisRescansAfterHiddenTab();
  console.log("ui smoke tests passed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
