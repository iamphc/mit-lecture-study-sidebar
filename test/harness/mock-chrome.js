const syncStore = {
  sidebarWidth: 420,
  deepseekApiKey: "mock-key",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  outputLanguage: "zh-CN",
  noteTone: "study-handout"
};

const localStore = {
  recentLectures: [
    {
      videoId: "fixture-001",
      videoTitle: "MIT Fixture Lecture",
      updatedAt: new Date().toISOString()
    }
  ]
};

const syncListeners = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function selectKeys(store, keys) {
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, clone(store[key])]));
  }
  if (keys && typeof keys === "object") {
    return Object.fromEntries(
      Object.keys(keys).map((key) => [key, key in store ? clone(store[key]) : keys[key]])
    );
  }
  if (typeof keys === "string") {
    return { [keys]: clone(store[keys]) };
  }
  return clone(store);
}

function applySet(store, payload, areaName) {
  const changes = {};
  for (const [key, value] of Object.entries(payload)) {
    changes[key] = {
      oldValue: clone(store[key]),
      newValue: clone(value)
    };
    store[key] = clone(value);
  }
  for (const listener of syncListeners) {
    listener(changes, areaName);
  }
}

window.chrome = {
  runtime: {
    onMessage: {
      addListener() {}
    },
    async sendMessage(message) {
      if (message?.type === "OPEN_OPTIONS_PAGE") {
        window.__harnessLog("openOptionsPage");
        return { ok: true };
      }
      if (message?.type === "OPEN_YOUTUBE") {
        window.__harnessLog("openYouTube");
        return { ok: true };
      }
      if (message?.type === "TEST_DEEPSEEK_CONNECTION") {
        return {
          ok: true,
          result: {
            status: "ok",
            model: syncStore.deepseekModel,
            message: "Mock DeepSeek connection succeeded."
          }
        };
      }
      if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
        return {
          ok: true,
          result: {
            title: message.payload.videoTitle,
            outline: [
              {
                heading: "模拟大纲小节",
                timestamp: "00:00",
                seconds: 0,
                bullets: ["模拟要点一", "模拟要点二"]
              }
            ]
          }
        };
      }
      return { ok: true };
    },
    openOptionsPage() {
      window.__harnessLog("openOptionsPageDirect");
    }
  },
  tabs: {
    create({ url }) {
      window.__harnessLog(`openTab:${url}`);
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
        return selectKeys(syncStore, keys);
      },
      async set(payload) {
        applySet(syncStore, payload, "sync");
      }
    },
    local: {
      async get(keys) {
        return selectKeys(localStore, keys);
      },
      async set(payload) {
        applySet(localStore, payload, "local");
      },
      async remove(keys) {
        const normalized = Array.isArray(keys) ? keys : [keys];
        for (const key of normalized) {
          delete localStore[key];
        }
      }
    }
  }
};
