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
import "./i18n.js";
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
  uiLanguage: "auto",
  outputLanguage: "auto",
  noteTone: "study-handout"
};

const {
  createTranslator,
  normalizeLanguage,
  resolveOutputLanguage,
  resolveUiLanguage
} = globalThis.MitStudyI18n;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  await chrome.storage.sync.set(normalizeSettings(current));
  await injectIntoOpenYouTubeTabs();
});

async function injectIntoOpenYouTubeTabs() {
  if (typeof chrome?.tabs?.query !== "function" || typeof chrome?.scripting?.executeScript !== "function") {
    return;
  }

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  } catch (error) {
    console.warn("[MIT Study] query-open-youtube-tabs-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  await Promise.all(
    tabs
      .filter((tab) => Number.isInteger(tab?.id))
      .map(async (tab) => {
        try {
          if (typeof chrome.scripting.insertCSS === "function") {
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ["src/sidebar.css"]
            });
          }
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/i18n.js", "src/transcript-utils-content.js", "src/content.js"]
          });
        } catch (error) {
          console.warn("[MIT Study] inject-open-youtube-tab-failed", {
            tabId: tab.id,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      })
  );
}

function normalizeSettings(stored = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    autoAnalyze: Boolean(stored.autoAnalyze),
    visualScanIntervalSeconds: normalizeVisualScanInterval(stored.visualScanIntervalSeconds),
    uiLanguage: normalizeLanguageSetting(stored.uiLanguage, DEFAULT_SETTINGS.uiLanguage),
    outputLanguage: normalizeLanguageSetting(stored.outputLanguage, DEFAULT_SETTINGS.outputLanguage)
  };

  return settings;
}

function normalizeLanguageSetting(value, fallback = "auto") {
  const text = String(value || fallback);
  return text === "auto" ? "auto" : normalizeLanguage(text);
}

function normalizeDeepSeekConfig(stored = {}, payloadSettings = {}) {
  const config = normalizeSettings({
    ...stored,
    ...payloadSettings
  });
  config.uiLanguage = resolveUiLanguage(config);
  config.outputLanguage = resolveOutputLanguage(config);
  config.t = createTranslator(config.outputLanguage);
  return config;
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

  if (message?.type === "RUN_DEEPSEEK_QA") {
    runDeepSeekQa(message.payload)
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
  const t = createTranslator(resolveUiLanguage(payload?.settings || {}));
  const directoryHandle = await getLocalSaveDirectoryHandle();
  if (!directoryHandle) {
    throw new Error(t("errorLocalSaveDirectoryMissing"));
  }

  const permission = await queryLocalSaveDirectoryPermission(directoryHandle);
  if (permission !== "granted") {
    throw new Error(t("errorLocalSaveDirectoryPermission"));
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
    csvPath: `${directoryHandle.name || t("errorSelectedDirectory")}/${LECTURE_LIBRARY_CSV_FILE}`,
    lecturePath: `${directoryHandle.name || t("errorSelectedDirectory")}/${LECTURE_FILES_DIR}/${files.folderName}`,
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
    throw new Error(createTranslator("zh-CN")("errorInvalidImageData"));
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
    throw new Error(createTranslator("zh-CN")("errorNoVisibleTabFrame"));
  }
  return { dataUrl };
}

async function runDeepSeekAnalysis(payload, tabId) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const config = normalizeDeepSeekConfig(stored, payload?.settings);
  const t = config.t;
  if (!config.deepseekApiKey) {
    throw new Error(t("errorMissingApiKey"));
  }

  const transcriptChunks = chunkTranscript(payload.transcript, 14000);
  const partialPacks = [];
  sendAnalysisProgress(tabId, payload.videoId, 42, t("progressDeepSeekPreparing"));

  for (let index = 0; index < transcriptChunks.length; index += 1) {
    const chunk = transcriptChunks[index];
    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index, transcriptChunks.length),
      t("progressDeepSeekChunk", { current: index + 1, total: transcriptChunks.length })
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
        t("progressDeepSeekChunkSkipped", { current: index + 1, total: transcriptChunks.length })
      );
      continue;
    }
    partialPacks.push(chunkResult);
    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index + 1, transcriptChunks.length),
      t("progressDeepSeekChunkReady", { current: index + 1, total: transcriptChunks.length }),
      {
        partialPack: buildPartialProgressPack(chunkResult, payload.videoTitle),
        partialIndex: index + 1,
        partialTotal: transcriptChunks.length
      }
    );
  }

  if (!partialPacks.length) {
    throw new Error(t("errorNoUsableOutline"));
  }

  const finalPack =
    partialPacks.length === 1
      ? partialPacks[0]
      : mergePartialStudyPacks(partialPacks, payload.videoTitle);
  const localizedPack = await ensureOutputLanguageOutline(payload, config, finalPack);

  sendAnalysisProgress(tabId, payload.videoId, 90, t("progressDeepSeekFinalizing"));
  return normalizeRemoteStudyPack(localizedPack, payload.transcript, payload.videoTitle);
}

async function generateChunkStudyPack({ payload, config, chunk, index, total, tabId }) {
  try {
    const rawChunkResult = await requestDeepSeekJson(
      buildDeepSeekChunkMessages(payload, config, chunk, index, total),
      config
    );
    return ensureOutputLanguageOutline(payload, config, rawChunkResult);
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }

    sendAnalysisProgress(
      tabId,
      payload.videoId,
      estimateChunkProgress(index, total),
      config.t("progressDeepSeekChunkRepairing", { current: index + 1, total })
    );
    try {
      const repaired = await repairDeepSeekJson(error.rawText, config);
      return ensureOutputLanguageOutline(payload, config, repaired);
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
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const config = normalizeDeepSeekConfig(stored);
  if (!config.deepseekApiKey) {
    throw new Error(config.t("errorMissingApiKeyShort"));
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
    message: result.message || config.t("connectionSuccess", { model: config.deepseekModel })
  };
}

function buildDeepSeekChunkMessages(payload, config, transcriptChunk, chunkIndex, chunkCount) {
  const t = config.t;
  const schemaExample = {
    title: t("promptTitleExample"),
    outline: [
      {
        heading: t("promptHeadingExample"),
        timestamp: "00:00",
        seconds: 0,
        bullets: [t("promptBulletExample")]
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
        t("promptOutputLanguageInstruction")
    },
    {
      role: "user",
      content:
        `Transform this lecture transcript chunk into a partial study pack.\n` +
        `Requirements:\n` +
        `1. Keep the transcript as the source of truth and do not invent specific claims not supported by it.\n` +
        `2. Only generate outline sections with timestamp, seconds, heading, and bullets.\n` +
        `3. ${t("promptHeadingBulletsInstruction")}\n` +
        `4. Return strict json matching this shape exactly: ${JSON.stringify(schemaExample)}\n` +
        `5. The word json must be honored: return json only.\n` +
        `6. Video title: ${payload.videoTitle}\n` +
        `7. This is chunk ${chunkIndex + 1} of ${chunkCount}. Keep timestamps from this chunk and do not claim to summarize the whole lecture.\n` +
        `8. Output language: ${t("promptOutputLanguageLine")}\n\n` +
        `Transcript:\n${transcriptText}`
    }
  ];
}

async function ensureOutputLanguageOutline(payload, config, pack) {
  if (config.outputLanguage !== "zh-CN" || !hasMostlyEnglishOutline(pack)) {
    return pack;
  }

  return requestDeepSeekJson(buildDeepSeekRewriteMessages(payload, config, pack), config);
}

async function repairDeepSeekJson(rawText, config) {
  return requestDeepSeekJson(buildDeepSeekJsonRepairMessages(rawText, config), config, {
    allowRepair: false
  });
}

function buildDeepSeekJsonRepairMessages(rawText, config = normalizeDeepSeekConfig()) {
  const t = config.t;
  const schemaExample = {
    title: t("promptTitleExample"),
    outline: [
      {
        heading: t("promptHeadingExample"),
        timestamp: "00:00",
        seconds: 0,
        bullets: [t("promptBulletExample")]
      }
    ]
  };

  return [
    {
      role: "system",
      content:
        "You repair malformed JSON from a lecture outline generator. Output valid JSON only. " +
        `Do not add new facts. ${t("promptRepairPreserve")}`
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

function buildDeepSeekRewriteMessages(payload, config, pack) {
  const t = config.t;
  const schemaExample = {
    title: t("promptTitleExample"),
    outline: [{ heading: t("promptHeadingExample"), timestamp: "00:00", seconds: 0, bullets: [t("promptBulletExample")] }]
  };

  return [
    {
      role: "system",
      content: t("promptRewriteSystem")
    },
    {
      role: "user",
      content:
        `${t("promptRewriteUser")}\n` +
        `Return strict json matching this shape exactly: ${JSON.stringify(schemaExample)}\n` +
        `Do not add notes, concepts, tags, questions, quizzes, or summaries.\n` +
        `Video title: ${payload.videoTitle}\n\n` +
        `Outline json:\n${JSON.stringify(pack)}`
    }
  ];
}

async function runDeepSeekVisualTextAnalysis(payload) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const config = normalizeDeepSeekConfig(stored, payload?.settings);
  const t = config.t;
  if (!config.deepseekApiKey) {
    throw new Error(t("errorMissingApiKey"));
  }

  const rawText = String(payload?.extraction?.rawVisibleText || "").trim();
  if (!rawText) {
    throw new Error(t("errorVisualOcrEmpty"));
  }

  try {
    const result = await requestDeepSeekJson(buildDeepSeekVisualTextMessages(payload, config), config, {
      repairMessagesBuilder: (rawText) => buildDeepSeekVisualJsonRepairMessages(rawText, config)
    });
    return normalizeVisualTextAnalysisResult(
      result,
      payload?.extraction || {},
      payload?.videoTitle || "",
      config.outputLanguage
    );
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }
    const repaired = await requestDeepSeekJson(buildDeepSeekVisualJsonRepairMessages(error.rawText, config), config, {
      allowRepair: false
    });
    return normalizeVisualTextAnalysisResult(
      repaired,
      payload?.extraction || {},
      payload?.videoTitle || "",
      config.outputLanguage
    );
  }
}

async function runDeepSeekQa(payload) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const config = normalizeDeepSeekConfig(stored, payload?.settings);
  const t = config.t;
  if (!config.deepseekApiKey) {
    throw new Error(t("errorMissingApiKey"));
  }

  const question = String(payload?.question || "").trim();
  if (!question) {
    throw new Error(t("errorQaQuestionMissing"));
  }

  const references = await fetchReferenceMaterials(payload, config);
  const result = await requestDeepSeekJson(buildDeepSeekQaMessages(payload, config, references), config, {
    repairMessagesBuilder: (rawText) => buildDeepSeekQaRepairMessages(rawText, config)
  });
  return normalizeQaResult(result, references);
}

function buildDeepSeekQaMessages(payload, config, references) {
  const t = config.t;
  const transcript = buildTranscriptExcerpt(payload?.transcript || [], payload?.question || "");
  const outline = buildOutlineExcerpt(payload?.studyPack);
  const visuals = buildVisualExcerpt(payload?.visualAnalysis || []);
  const referenceText = references
    .map((item, index) => `[R${index + 1}] ${item.title}\n${item.url}\n${item.snippet}`)
    .join("\n\n");
  const schemaExample = {
    answer: t("promptQaAnswerExample"),
    sources: [{ title: t("promptQaSourceTitleExample"), url: "https://example.com", note: t("promptQaSourceNoteExample") }]
  };

  return [
    {
      role: "system",
      content:
        "You answer questions about a lecture video. Output valid JSON only. " +
        "Use the transcript, outline, visual OCR notes, and provided public reference snippets as evidence. " +
        "Do not invent facts. If the evidence is insufficient, say what is missing. " +
        t("promptQaLanguageInstruction")
    },
    {
      role: "user",
      content:
        `Question:\n${String(payload?.question || "").slice(0, 1200)}\n\n` +
        `Video title:\n${payload?.videoTitle || ""}\n\n` +
        `Video URL:\n${payload?.videoUrl || ""}\n\n` +
        `Transcript evidence:\n${transcript}\n\n` +
        `Generated outline:\n${outline}\n\n` +
        `Visual/OCR notes:\n${visuals}\n\n` +
        `Public reference snippets:\n${referenceText || "No external reference snippets were available."}\n\n` +
        `Return strict JSON matching this shape exactly: ${JSON.stringify(schemaExample)}\n` +
        `Rules:\n` +
        `1. The answer must directly address the question.\n` +
        `2. Prefer video transcript evidence when it conflicts with public snippets.\n` +
        `3. Mention useful timestamps when transcript lines support the answer.\n` +
        `4. sources should include transcript/outline/visual evidence labels and any relevant public URLs.\n` +
        `5. Do not include markdown outside JSON.`
    }
  ];
}

function buildDeepSeekQaRepairMessages(rawText, config = normalizeDeepSeekConfig()) {
  const t = config.t;
  const schemaExample = {
    answer: t("promptQaAnswerExample"),
    sources: [{ title: t("promptQaSourceTitleExample"), url: "https://example.com", note: t("promptQaSourceNoteExample") }]
  };
  return [
    {
      role: "system",
      content: "You repair malformed JSON from a lecture Q&A assistant. Output valid JSON only."
    },
    {
      role: "user",
      content:
        `Repair this into strict JSON matching this schema exactly: ${JSON.stringify(schemaExample)}\n` +
        `Keep only answer and sources.\n\nMalformed JSON:\n${String(rawText || "").slice(0, 8000)}`
    }
  ];
}

function normalizeQaResult(result, references = []) {
  const answer = String(result?.answer || "").trim();
  const modelSources = Array.isArray(result?.sources) ? result.sources : [];
  const sources = modelSources
    .map((source) => ({
      title: String(source?.title || source?.label || "").trim(),
      url: sanitizeReferenceUrl(source?.url),
      note: String(source?.note || "").trim()
    }))
    .filter((source) => source.title || source.url || source.note);

  const externalByUrl = new Map(
    references
      .filter((source) => source.url)
      .map((source) => [source.url, source])
  );
  for (const source of sources) {
    if (source.url && externalByUrl.has(source.url) && !source.note) {
      source.note = externalByUrl.get(source.url).snippet;
    }
  }

  return {
    answer,
    sources: sources.slice(0, 8)
  };
}

async function fetchReferenceMaterials(payload, config) {
  const query = buildReferenceQuery(payload);
  if (!query) {
    return [];
  }

  try {
    const url = `https://api.duckduckgo.com/?${new URLSearchParams({
      q: query,
      format: "json",
      no_html: "1",
      no_redirect: "1",
      skip_disambig: "1"
    }).toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return normalizeDuckDuckGoReferences(data, config).slice(0, 6);
  } catch (error) {
    console.warn("[MIT Study] reference-fetch-failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

function buildReferenceQuery(payload) {
  return [
    payload?.videoTitle,
    payload?.question,
    "lecture reference"
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

function normalizeDuckDuckGoReferences(data, config) {
  const references = [];
  if (data?.AbstractText || data?.AbstractURL) {
    references.push({
      title: String(data.Heading || config.t("qaExternalReference")).trim(),
      url: sanitizeReferenceUrl(data.AbstractURL),
      snippet: String(data.AbstractText || "").trim()
    });
  }
  collectDuckDuckGoTopics(data?.RelatedTopics, references);
  return dedupeReferences(references);
}

function collectDuckDuckGoTopics(topics, references) {
  if (!Array.isArray(topics)) {
    return;
  }
  for (const topic of topics) {
    if (Array.isArray(topic?.Topics)) {
      collectDuckDuckGoTopics(topic.Topics, references);
      continue;
    }
    const snippet = String(topic?.Text || "").trim();
    const url = sanitizeReferenceUrl(topic?.FirstURL);
    if (!snippet && !url) {
      continue;
    }
    references.push({
      title: snippet.split(" - ")[0]?.slice(0, 120) || url,
      url,
      snippet
    });
  }
}

function dedupeReferences(references) {
  const seen = new Set();
  return references.filter((reference) => {
    const key = reference.url || `${reference.title}|${reference.snippet}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sanitizeReferenceUrl(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) {
    return "";
  }
  return text;
}

function buildTranscriptExcerpt(transcript, question) {
  const entries = Array.isArray(transcript) ? transcript : [];
  const tokens = extractQueryTokens(question);
  const scored = entries
    .map((entry, index) => ({
      entry,
      index,
      score: scoreTextForTokens(entry?.text, tokens)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = scored
    .filter((item) => item.score > 0)
    .slice(0, 24)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.entry);
  const fallback = selected.length ? selected : entries.slice(0, 36);
  return fallback
    .map((entry) => `[${formatTime(entry.startMs || 0)}] ${String(entry.text || "").trim()}`)
    .join("\n")
    .slice(0, 9000);
}

function buildOutlineExcerpt(studyPack) {
  const outline = Array.isArray(studyPack?.outline) ? studyPack.outline : [];
  return outline
    .slice(0, 80)
    .map((item) => `[${item.timestamp || formatTime((item.seconds || 0) * 1000)}] ${item.heading || ""}: ${(item.bullets || []).join(" ")}`)
    .join("\n")
    .slice(0, 5000);
}

function buildVisualExcerpt(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 24)
    .map((item) => `[${item.timestamp || formatTime((item.seconds || 0) * 1000)}] ${item.title || ""}: ${(item.bullets || []).join(" ")} ${(item.visibleText || []).join(" ")}`)
    .join("\n")
    .slice(0, 5000);
}

function extractQueryTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9\u3400-\u9fff]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 24);
}

function scoreTextForTokens(text, tokens) {
  const normalized = String(text || "").toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function buildDeepSeekVisualTextMessages(payload, config) {
  const t = config.t;
  const extraction = payload?.extraction || {};
  const visualType = normalizeVisualType(extraction.visualType || extraction.keyFrame?.visualType);
  const visualTypeLabel = getVisualTypeLabel(visualType, config.outputLanguage);
  const schemaExample = {
    title: t("promptVisualTitleExample"),
    bullets: [t("promptVisualBulletExample")],
    relationToTranscript: t("promptVisualRelationExample"),
    tags: [t("promptVisualTagExample")],
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
        `${t("promptVisualLanguageInstruction")} ` +
        "Do not call a blackboard or whiteboard a PPT."
    },
    {
      role: "user",
      content:
        `${t("promptVisualUserIntro", { visualType: visualTypeLabel })}\n` +
        `Requirements:\n` +
        `1. Only use the OCR text and nearby transcript. Do not invent image details.\n` +
        `2. ${t("promptVisualRequirementOutput")}\n` +
        `3. If OCR text is short, summarize conservatively.\n` +
        `4. Return strict JSON matching this shape: ${JSON.stringify(schemaExample)}\n` +
        `5. visualType must remain "${visualType}". Do not change it.\n` +
        `6. video title: ${payload?.videoTitle || ""}\n` +
        `7. timestamp: ${extraction.timestamp || ""}\n\n` +
        `${t("promptOcrRaw")}:\n${String(extraction.rawVisibleText || "").slice(0, 4000)}\n\n` +
        `${t("promptNearbyTranscript")}:\n${transcriptContext.slice(0, 3000)}`
    }
  ];
}

function buildDeepSeekVisualJsonRepairMessages(rawText, config = normalizeDeepSeekConfig()) {
  const t = config.t;
  const schemaExample = {
    title: t("promptVisualTitleExample"),
    bullets: [t("promptVisualBulletExample")],
    relationToTranscript: t("promptVisualRelationExample"),
    tags: [t("promptVisualTagExample")],
    visualType: "ppt"
  };

  return [
    {
      role: "system",
      content:
        "You repair malformed JSON from a lecture visual text analyzer. Output valid JSON only. " +
        `Do not add new facts. ${t("promptRepairPreserve")}`
    },
    {
      role: "user",
      content:
        `Repair this malformed JSON into strict JSON matching this schema exactly: ${JSON.stringify(schemaExample)}\n` +
        `Rules:\n` +
        `1. Return JSON only, no markdown.\n` +
        `2. Keep only title, bullets, relationToTranscript, tags, visualType.\n` +
        `3. ${t("promptVisualRepairLanguageRule")}\n` +
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

function getVisualTypeLabel(value, language = "zh-CN") {
  const t = createTranslator(language);
  const visualType = normalizeVisualType(value);
  if (visualType === "ppt") {
    return t("visualTypePpt");
  }
  if (visualType === "blackboard") {
    return t("visualTypeBlackboard");
  }
  if (visualType === "whiteboard") {
    return t("visualTypeWhiteboard");
  }
  if (visualType === "screen") {
    return t("visualTypeScreen");
  }
  return t("visualTypeVisual");
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
    throw new Error(config.t("errorDeepSeekStatus", { status: response.status, message: errorText.slice(0, 300) }));
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(config.t("errorDeepSeekEmpty"));
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
