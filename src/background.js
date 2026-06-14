import {
  chunkTranscript,
  formatTime,
  hasMostlyEnglishOutline,
  mergePartialStudyPacks,
  ModelJsonParseError,
  normalizeRemoteStudyPack,
  safeParseModelJson
} from "./background-utils.mjs";

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

const LOCAL_CSV_ENDPOINT = "http://127.0.0.1:45873/lecture";

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  await chrome.storage.sync.set(normalizeSettings(current));
});

function normalizeSettings(stored = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    outputLanguage: "zh-CN"
  };

  return settings;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_OPTIONS_PAGE") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "OPEN_YOUTUBE") {
    chrome.tabs.create({ url: "https://www.youtube.com/results?search_query=MIT+OpenCourseWare" });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "TEST_DEEPSEEK_CONNECTION") {
    testDeepSeekConnection()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "TEST_OLLAMA_CONNECTION") {
    testOllamaConnection()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "RUN_DEEPSEEK_ANALYSIS") {
    runDeepSeekAnalysis(message.payload, sender.tab?.id)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "CAPTURE_VISIBLE_TAB") {
    captureVisibleTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "RUN_OLLAMA_VISUAL_ANALYSIS") {
    runOllamaVisualAnalysis(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "SAVE_LECTURE_CSV") {
    saveLectureCsv(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  return false;
});

async function saveLectureCsv(payload) {
  const response = await fetch(LOCAL_CSV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `本地 CSV 服务保存失败，状态码 ${response.status}。`);
  }
  return result;
}

async function captureVisibleTab() {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
    format: "jpeg",
    quality: 72
  });
  if (!dataUrl) {
    throw new Error("没有截取到当前视频画面。");
  }
  return { dataUrl };
}

async function runDeepSeekAnalysis(payload, tabId) {
  const config = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  config.outputLanguage = "zh-CN";
  if (!config.deepseekApiKey) {
    throw new Error("缺少 DeepSeek API Key，请打开插件设置填写。");
  }

  const transcriptChunks = chunkTranscript(payload.transcript, 14000);
  const partialPacks = [];
  sendAnalysisProgress(tabId, payload.videoId, 42, "DeepSeek 正在准备分段分析");

  for (let index = 0; index < transcriptChunks.length; index += 1) {
    const chunk = transcriptChunks[index];
    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index, transcriptChunks.length),
      `DeepSeek 正在分析第 ${index + 1}/${transcriptChunks.length} 段`
    );
    const chunkResult = await generateChunkStudyPack({
      payload,
      config,
      chunk,
      index,
      total: transcriptChunks.length,
      tabId
    });
    if (!chunkResult?.outline?.length) {
      sendAnalysisProgress(
        tabId,
        payload.videoId,
        estimateChunkProgress(index + 1, transcriptChunks.length),
        `第 ${index + 1}/${transcriptChunks.length} 段模型输出异常，已跳过并继续`
      );
      continue;
    }
    partialPacks.push(chunkResult);
    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index + 1, transcriptChunks.length),
      `已生成第 ${index + 1}/${transcriptChunks.length} 段大纲`,
      {
        partialPack: buildPartialProgressPack(chunkResult, payload.videoTitle),
        partialIndex: index + 1,
        partialTotal: transcriptChunks.length
      }
    );
  }

  if (!partialPacks.length) {
    throw new Error("模型连续返回异常格式，没有生成出可用大纲。");
  }

  const finalPack =
    partialPacks.length === 1
      ? partialPacks[0]
      : mergePartialStudyPacks(partialPacks, payload.videoTitle);
  const chinesePack = await ensureChineseOutline(payload, config, finalPack);

  sendAnalysisProgress(tabId, payload.videoId, 90, "大纲已覆盖全片，正在整理保存");
  return normalizeRemoteStudyPack(chinesePack, payload.transcript, payload.videoTitle);
}

async function runOllamaVisualAnalysis(payload) {
  const config = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  config.outputLanguage = "zh-CN";

  const frame = payload?.frame;
  if (!frame?.imageDataUrl) {
    throw new Error("缺少可分析的视频画面。");
  }

  const result = await requestOllamaVisualJson(buildOllamaVisualPrompt(payload), frame.imageDataUrl, config);
  return normalizeVisualAnalysis(result, frame);
}

async function generateChunkStudyPack({ payload, config, chunk, index, total, tabId }) {
  try {
    const rawChunkResult = await requestDeepSeekJson(
      buildDeepSeekChunkMessages(payload, config, chunk, index, total),
      config
    );
    return ensureChineseOutline(payload, config, rawChunkResult);
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }

    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index, total),
      `第 ${index + 1}/${total} 段返回格式异常，正在自动修复`
    );
    try {
      const repaired = await repairDeepSeekJson(error.rawText, config);
      return ensureChineseOutline(payload, config, repaired);
    } catch (repairError) {
      console.warn("[MIT Study] deepseek-json-repair-failed", {
        chunk: index + 1,
        total,
        error: repairError instanceof Error ? repairError.message : String(repairError)
      });
      return null;
    }
  }
}

function estimateChunkProgress(completedChunks, totalChunks) {
  if (!totalChunks) {
    return 42;
  }
  return Math.min(80, 42 + Math.round((completedChunks / totalChunks) * 38));
}

function buildPartialProgressPack(pack, videoTitle) {
  return {
    title: pack?.title || videoTitle || "",
    outline: Array.isArray(pack?.outline) ? pack.outline : []
  };
}

function sendAnalysisProgress(tabId, videoId, percent, label, extra = {}) {
  if (!tabId) {
    return;
  }
  const message = {
      type: "DEEPSEEK_ANALYSIS_PROGRESS",
      videoId,
      percent,
      label,
      ...extra
    };
  try {
    const result = chrome.tabs.sendMessage(tabId, message);
    if (result?.catch) {
      result.catch(() => void 0);
    }
  } catch (_error) {
    // Progress updates are best-effort; analysis itself should not fail because UI progress failed.
  }
}

async function testDeepSeekConnection() {
  const config = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  config.outputLanguage = "zh-CN";
  if (!config.deepseekApiKey) {
    throw new Error("缺少 DeepSeek API Key。");
  }

  const result = await requestDeepSeekJson(
    [
      {
        role: "system",
        content: "Return valid json only."
      },
      {
        role: "user",
        content:
          'Reply with this exact json shape and short values: {"status":"ok","model":"string","message":"string"}'
      }
    ],
    config
  );

  return {
    status: result.status || "ok",
    model: config.deepseekModel,
    message: result.message || "DeepSeek 连接成功。"
  };
}

function buildDeepSeekChunkMessages(payload, config, transcriptChunk, chunkIndex, chunkCount) {
  const schemaExample = {
    title: "课程中文标题",
    outline: [
      {
        heading: "中文小节标题",
        timestamp: "00:00",
        seconds: 0,
        bullets: ["中文要点"]
      }
    ]
  };

  const transcriptText = transcriptChunk
    .map((entry) => `[${formatTime(entry.startMs)}] ${entry.text}`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "You are an expert lecture-study assistant. The user needs a study sidebar for MIT YouTube lectures. " +
        "Use the original English transcript as the primary source. Output valid json only. " +
        "Produce only a compact but useful lecture outline. Do not generate notes, concepts, tags, questions, quizzes, or summaries. " +
        "All user-facing fields must be written in Simplified Chinese. Translate and explain the English transcript in Chinese. " +
        "Do not copy English transcript phrases as headings or bullets unless the phrase is a necessary technical term."
    },
    {
      role: "user",
      content:
        `Transform this lecture transcript chunk into a partial study pack.\n` +
        `Requirements:\n` +
        `1. Keep the transcript as the source of truth and do not invent specific claims not supported by it.\n` +
        `2. Only generate outline sections with timestamp, seconds, heading, and bullets.\n` +
        `3. heading and bullets must be Simplified Chinese. Do not leave English sentences like "Introduction and Course Overview".\n` +
        `4. Return strict json matching this shape exactly: ${JSON.stringify(schemaExample)}\n` +
        `5. The word json must be honored: return json only.\n` +
        `6. Video title: ${payload.videoTitle}\n` +
        `7. This is chunk ${chunkIndex + 1} of ${chunkCount}. Keep timestamps from this chunk and do not claim to summarize the whole lecture.\n` +
        `8. Output language: 简体中文。Technical names may stay in English only inside Chinese explanations.\n\n` +
        `Transcript:\n${transcriptText}`
    }
  ];
}

function buildOllamaVisualPrompt(payload) {
  const frame = payload.frame || {};
  const schemaExample = {
    title: "画面中文标题",
    visualType: "slides",
    shouldKeep: true,
    bullets: ["中文要点"],
    visibleText: ["画面中的关键词"],
    relationToTranscript: "这张画面和当前讲解的关系"
  };

  const contextText = (payload.transcriptContext || [])
    .map((entry) => `[${formatTime(entry.startMs)}] ${entry.text}`)
    .join("\n");

  return (
    `你是一个课程视频画面分析助手。请分析这张视频帧里是否有 PPT、图示、公式或板书。\n` +
    `所有面向用户的内容必须用简体中文。只根据画面可见内容分析，不要编造。\n` +
    `返回严格 JSON，不要 markdown，格式必须匹配：${JSON.stringify(schemaExample)}\n\n` +
    `规则：\n` +
    `1. 如果画面不是有用的课程 PPT、图示、公式或板书，shouldKeep=false，bullets 保持很短。\n` +
    `2. 如果有用，请解释画面内容，并明确它是画面信息，不要和字幕大纲混在一起。\n` +
    `3. visibleText 只列出画面中重要的文字、公式或标签。\n` +
    `4. 附近字幕只能用于辅助理解，不要把字幕当成画面事实。\n` +
    `5. 视频标题：${payload.videoTitle || ""}\n` +
    `6. 画面时间：${formatTime((frame.seconds || 0) * 1000)}\n\n` +
    `附近字幕：\n${contextText || "-"}`
  );
}

function normalizeVisualAnalysis(result, frame) {
  const shouldKeep = result?.shouldKeep !== false;
  return {
    timestamp: formatTime((frame.seconds || 0) * 1000),
    seconds: Math.max(0, Math.round(Number(frame.seconds) || 0)),
    title: String(result?.title || "画面内容").trim(),
    visualType: String(result?.visualType || "visual").trim(),
    shouldKeep,
    bullets: Array.isArray(result?.bullets)
      ? result.bullets.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
      : [],
    visibleText: Array.isArray(result?.visibleText)
      ? result.visibleText.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12)
      : [],
    relationToTranscript: String(result?.relationToTranscript || "").trim()
  };
}

async function testOllamaConnection() {
  const config = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const baseUrl = trimTrailingSlash(config.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl);
  const model = config.ollamaVisionModel || DEFAULT_SETTINGS.ollamaVisionModel;
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama 连接失败，状态码 ${response.status}。请确认 ollama serve 已启动。`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.models) ? payload.models : [];
  const exists = models.some((item) => item?.name === model || item?.model === model);
  if (!exists) {
    throw new Error(`Ollama 已启动，但没有找到模型 ${model}。请执行：ollama pull ${model}`);
  }

  return {
    status: "ok",
    model,
    message: "本地 Ollama 视觉模型可用。"
  };
}

async function ensureChineseOutline(payload, config, pack) {
  if (!hasMostlyEnglishOutline(pack)) {
    return pack;
  }

  return requestDeepSeekJson(buildDeepSeekChineseRewriteMessages(payload, pack), config);
}

async function repairDeepSeekJson(rawText, config) {
  return requestDeepSeekJson(buildDeepSeekJsonRepairMessages(rawText), config, {
    allowRepair: false
  });
}

function buildDeepSeekJsonRepairMessages(rawText) {
  const schemaExample = {
    title: "课程中文标题",
    outline: [
      {
        heading: "中文小节标题",
        timestamp: "00:00",
        seconds: 0,
        bullets: ["中文要点"]
      }
    ]
  };

  return [
    {
      role: "system",
      content:
        "You repair malformed JSON from a lecture outline generator. Output valid JSON only. " +
        "Do not add new facts. Preserve the original Chinese content as much as possible."
    },
    {
      role: "user",
      content:
        `Repair this malformed JSON into strict JSON matching this schema exactly: ${JSON.stringify(schemaExample)}\n` +
        `Rules:\n` +
        `1. Return JSON only, no markdown.\n` +
        `2. Keep only title and outline.\n` +
        `3. Each outline item must have heading, timestamp, seconds, bullets.\n` +
        `4. If a broken bullet cannot be repaired, drop only that bullet, not the whole outline.\n\n` +
        `Malformed JSON:\n${String(rawText || "").slice(0, 12000)}`
    }
  ];
}

function buildDeepSeekChineseRewriteMessages(payload, pack) {
  const schemaExample = {
    title: "课程中文标题",
    outline: [{ heading: "中文小节标题", timestamp: "00:00", seconds: 0, bullets: ["中文要点"] }]
  };

  return [
    {
      role: "system",
      content:
        "You rewrite lecture outlines into Simplified Chinese. Output valid json only. " +
        "Keep timestamps and seconds unchanged. Translate headings and bullets into natural Chinese. " +
        "Only keep English for unavoidable technical names."
    },
    {
      role: "user",
      content:
        `Rewrite this outline into Simplified Chinese.\n` +
        `Return strict json matching this shape exactly: ${JSON.stringify(schemaExample)}\n` +
        `Do not add notes, concepts, tags, questions, quizzes, or summaries.\n` +
        `Video title: ${payload.videoTitle}\n\n` +
        `Outline json:\n${JSON.stringify(pack)}`
    }
  ];
}

async function requestDeepSeekJson(messages, config, options = {}) {
  const response = await fetch(`${trimTrailingSlash(config.deepseekBaseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      messages,
      response_format: { type: "json_object" },
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败，状态码 ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 返回了空响应。");
  }

  try {
    return safeParseModelJson(content);
  } catch (error) {
    if (options.allowRepair === false || !(error instanceof ModelJsonParseError)) {
      throw error;
    }
    return repairDeepSeekJson(error.rawText, config);
  }
}

async function requestOllamaVisualJson(prompt, imageDataUrl, config) {
  const baseUrl = trimTrailingSlash(config.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl);
  const model = config.ollamaVisionModel || DEFAULT_SETTINGS.ollamaVisionModel;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [stripDataUrlPrefix(imageDataUrl)]
        }
      ],
      format: "json",
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama 画面分析失败，状态码 ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const json = await response.json();
  const content = json?.message?.content;
  if (!content) {
    throw new Error("Ollama 返回了空响应。");
  }
  return safeParseModelJson(content);
}

function stripDataUrlPrefix(dataUrl) {
  return String(dataUrl || "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}

function trimTrailingSlash(text) {
  return String(text || "").replace(/\/+$/, "");
}
