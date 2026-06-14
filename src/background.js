import {
  chunkTranscript,
  formatTime,
  hasMostlyEnglishOutline,
  mergePartialStudyPacks,
  ModelJsonParseError,
  normalizeRemoteStudyPack,
  normalizeVisualTextAnalysisResult,
  safeParseModelJson
} from "./background-utils.mjs";
import {
  getLocalSaveDirectoryHandle,
  queryLocalSaveDirectoryPermission
} from "./local-save-directory.js";
import {
  buildLocalLectureFiles,
  LECTURE_IMAGES_DIR,
  LECTURE_FILES_DIR,
  LECTURE_LIBRARY_CSV_FILE,
  prepareLocalLectureRecord,
  upsertCsvRecord
} from "./local-save-utils.mjs";

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

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  await chrome.storage.sync.set(normalizeSettings(current));
});

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

  if (message?.type === "RUN_DEEPSEEK_VISUAL_TEXT_ANALYSIS") {
    runDeepSeekVisualTextAnalysis(message.payload)
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

  if (message?.type === "SAVE_LECTURE_LOCAL") {
    saveLectureLocal(message.payload)
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

async function saveLectureLocal(payload) {
  const directoryHandle = await getLocalSaveDirectoryHandle();
  if (!directoryHandle) {
    throw new Error("还没有选择本地保存目录，请到设置里点击“选择目录”。");
  }

  const permission = await queryLocalSaveDirectoryPermission(directoryHandle);
  if (permission !== "granted") {
    throw new Error("本地保存目录权限已失效，请到设置里重新选择目录。");
  }

  const prepared = prepareLocalLectureRecord(payload);
  const csvFileHandle = await directoryHandle.getFileHandle(LECTURE_LIBRARY_CSV_FILE, { create: true });
  const existingCsvText = await readTextFile(csvFileHandle);
  const { csvText, rowCount } = upsertCsvRecord(existingCsvText, prepared.record);
  await writeTextFile(csvFileHandle, csvText);

  const files = buildLocalLectureFiles(prepared.record);
  const lecturesDirectory = await directoryHandle.getDirectoryHandle(LECTURE_FILES_DIR, { create: true });
  const lectureDirectory = await lecturesDirectory.getDirectoryHandle(files.folderName, { create: true });
  await writeTextFile(await lectureDirectory.getFileHandle(files.jsonFileName, { create: true }), files.jsonText);
  await writeTextFile(await lectureDirectory.getFileHandle(files.markdownFileName, { create: true }), files.markdownText);
  await writeLectureImageAssets(lectureDirectory, prepared.imageAssets);

  return {
    directoryName: directoryHandle.name || "",
    csvPath: `${directoryHandle.name || "所选目录"}/${LECTURE_LIBRARY_CSV_FILE}`,
    lecturePath: `${directoryHandle.name || "所选目录"}/${LECTURE_FILES_DIR}/${files.folderName}`,
    imageCount: prepared.imageAssets.length,
    rowCount,
    videoId: payload?.video_id || payload?.videoId || ""
  };
}

async function writeLectureImageAssets(lectureDirectory, imageAssets) {
  if (!Array.isArray(imageAssets) || !imageAssets.length) {
    return;
  }

  const imageDirectory = await lectureDirectory.getDirectoryHandle(LECTURE_IMAGES_DIR, { create: true });
  for (const asset of imageAssets) {
    const fileHandle = await imageDirectory.getFileHandle(asset.fileName, { create: true });
    await writeBlobFile(fileHandle, dataUrlToBlob(asset.dataUrl, asset.mimeType));
  }
}

async function readTextFile(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    return file.text();
  } catch (_error) {
    return "";
  }
}

async function writeTextFile(fileHandle, text) {
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}

async function writeBlobFile(fileHandle, blob) {
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

function dataUrlToBlob(dataUrl, fallbackMimeType = "application/octet-stream") {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error("图片数据格式无效，无法写入本地文件。");
  }

  const mimeType = match[1] || fallbackMimeType;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
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

async function runDeepSeekVisualTextAnalysis(payload) {
  const config = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  config.outputLanguage = "zh-CN";
  if (!config.deepseekApiKey) {
    throw new Error("缺少 DeepSeek API Key，请打开插件设置填写。");
  }

  const rawText = String(payload?.extraction?.rawVisibleText || "").trim();
  if (!rawText) {
    throw new Error("画面本地 OCR 没有提取到可分析文字。");
  }

  try {
    const result = await requestDeepSeekJson(buildDeepSeekVisualTextMessages(payload), config, {
      repairMessagesBuilder: buildDeepSeekVisualJsonRepairMessages
    });
    return normalizeVisualTextAnalysisResult(result, payload?.extraction || {}, payload?.videoTitle || "");
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }
    const repaired = await requestDeepSeekJson(buildDeepSeekVisualJsonRepairMessages(error.rawText), config, {
      allowRepair: false
    });
    return normalizeVisualTextAnalysisResult(repaired, payload?.extraction || {}, payload?.videoTitle || "");
  }
}

function buildDeepSeekVisualTextMessages(payload) {
  const extraction = payload?.extraction || {};
  const visualType = normalizeVisualType(extraction.visualType || extraction.keyFrame?.visualType);
  const visualTypeLabel = getVisualTypeLabel(visualType);
  const schemaExample = {
    title: "中文标题",
    bullets: ["中文要点"],
    relationToTranscript: "和当前讲解的关系",
    tags: ["标签"],
    visualType
  };
  const transcriptContext = Array.isArray(payload?.transcriptContext)
    ? payload.transcriptContext
        .map((entry) => `[${formatTime(entry.startMs || 0)}] ${entry.text}`)
        .join("\n")
    : "";

  return [
    {
      role: "system",
      content:
        "You analyze OCR text extracted locally from lecture visual frames such as slides, blackboards, whiteboards, or screen shares. Output valid JSON only. " +
        "The image itself was not sent to you. Do not claim visual details beyond the provided OCR text. " +
        "All user-facing fields must be Simplified Chinese. Keep technical terms in English only when necessary. " +
        "Do not call a blackboard or whiteboard a PPT."
    },
    {
      role: "user",
      content:
        `根据下面的本地 OCR 原文分析这张${visualTypeLabel}关键帧。\n` +
        `要求：\n` +
        `1. 只基于 OCR 原文和附近字幕，不要编造图像细节。\n` +
        `2. 输出中文标题、2-4 个中文要点、和当前讲解的关系、3-6 个中文检索标签。\n` +
        `3. 如果 OCR 原文很短，只做保守概括。\n` +
        `4. 返回严格 JSON，结构必须是：${JSON.stringify(schemaExample)}\n` +
        `5. visualType 必须保持为 "${visualType}"，不要改成其他类型。\n` +
        `6. video title: ${payload?.videoTitle || ""}\n` +
        `7. timestamp: ${extraction.timestamp || ""}\n\n` +
        `OCR 原文：\n${String(extraction.rawVisibleText || "").slice(0, 4000)}\n\n` +
        `附近字幕：\n${transcriptContext.slice(0, 3000)}`
    }
  ];
}

function buildDeepSeekVisualJsonRepairMessages(rawText) {
  const schemaExample = {
    title: "中文标题",
    bullets: ["中文要点"],
    relationToTranscript: "和当前讲解的关系",
    tags: ["标签"],
    visualType: "ppt"
  };

  return [
    {
      role: "system",
      content:
        "You repair malformed JSON from a lecture visual text analyzer. Output valid JSON only. " +
        "Do not add new facts. Preserve the Chinese meaning as much as possible."
    },
    {
      role: "user",
      content:
        `Repair this malformed JSON into strict JSON matching this schema exactly: ${JSON.stringify(schemaExample)}\n` +
        `Rules:\n` +
        `1. Return JSON only, no markdown.\n` +
        `2. Keep only title, bullets, relationToTranscript, tags, visualType.\n` +
        `3. User-facing text must be Simplified Chinese.\n` +
        `4. visualType must be one of: ppt, blackboard, whiteboard, screen, visual.\n\n` +
        `Malformed JSON:\n${String(rawText || "").slice(0, 8000)}`
    }
  ];
}

function normalizeVisualType(value) {
  const normalized = String(value || "visual").trim().toLowerCase();
  if (normalized === "slide" || normalized === "slides") {
    return "ppt";
  }
  if (normalized === "chalkboard") {
    return "blackboard";
  }
  if (["ppt", "blackboard", "whiteboard", "screen", "visual"].includes(normalized)) {
    return normalized;
  }
  return "visual";
}

function getVisualTypeLabel(value) {
  const visualType = normalizeVisualType(value);
  if (visualType === "ppt") {
    return "PPT";
  }
  if (visualType === "blackboard") {
    return "板书";
  }
  if (visualType === "whiteboard") {
    return "白板";
  }
  if (visualType === "screen") {
    return "屏幕";
  }
  return "画面";
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
    if (typeof options.repairMessagesBuilder === "function") {
      return requestDeepSeekJson(options.repairMessagesBuilder(error.rawText), config, {
        allowRepair: false
      });
    }
    return repairDeepSeekJson(error.rawText, config);
  }
}

function trimTrailingSlash(text) {
  return String(text || "").replace(/\/+$/, "");
}
