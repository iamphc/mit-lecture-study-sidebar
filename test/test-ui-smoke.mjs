import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function loadText(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

function buildMockChrome() {
  const syncStore = {
    sidebarWidth: 420,
    deepseekApiKey: "mock-key",
    deepseekBaseUrl: "https://api.deepseek.com",
    deepseekModel: "deepseek-v4-flash",
    outputLanguage: "zh-CN",
    noteTone: "study-handout"
  };

  const localStore = {
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
        if (message?.type === "SAVE_LECTURE_CSV") {
          return {
            ok: true,
            result: {
              csvPath: "/tmp/lecture_library.csv",
              rowCount: 1
            }
          };
        }
        return { ok: true };
      },
      openOptionsPage() {}
    },
    tabs: {
      create() {}
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
  } finally {
    dom.window.close();
  }
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

  dom.window.chrome = buildMockChrome();
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
  assert.match(summaryText, /大纲已生成并保存到资料库|CSV 已保存/);
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

  const chrome = buildMockChrome();
  installClipboardMock(dom.window);
  chrome.runtime.sendMessage = async (message) => {
    chrome.__messages.push(message);
    if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
      return { ok: false, error: "mock DeepSeek outage" };
    }
    if (message?.type === "SAVE_LECTURE_CSV") {
      return { ok: true, result: { csvPath: "/tmp/lecture_library.csv", rowCount: 1 } };
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

  dom.window.chrome = buildMockChrome();
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
  assert.match(captionsCardText, /生成完成|大纲已生成|CSV 已保存/);
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

  dom.window.chrome = buildMockChrome();
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
  assert.match(captionsCardText, /生成完成|大纲已生成|CSV 已保存/);
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

  dom.window.chrome = buildMockChrome();
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
  assert.match(captionsCardText, /生成完成|大纲已生成|CSV 已保存/);
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

  const chrome = buildMockChrome();
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

  const chrome = buildMockChrome();
  const deepSeekDeferred = createDeferred();
  chrome.runtime.sendMessage = async (message) => {
    chrome.__messages.push(message);
    if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
      return deepSeekDeferred.promise;
    }
    if (message?.type === "SAVE_LECTURE_CSV") {
      return { ok: true, result: { csvPath: "/tmp/lecture_library.csv", rowCount: 1 } };
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
  assert.doesNotMatch(sidebarText, /大纲已生成并保存到资料库/);

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
  dom.window.close();
}

async function main() {
  await testPopup();
  await testOptions();
  await testSidebar();
  await testSidebarDeepSeekFailureShowsError();
  await testCaptionTrackFallback();
  await testInnertubePlayerFallback();
  await testTranscriptApiUsesHtmlYtcfgFallback();
  await testDeepSeekModeWithoutApiKeyShowsPrompt();
  await testProgressiveOutlineRendersPartialPack();
  console.log("ui smoke tests passed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
