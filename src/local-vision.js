const DEFAULT_LOCAL_VISION_MODEL = "Xenova/trocr-small-printed";
const DEFAULT_LOCAL_VISION_TASK = "image-to-text";
const TRANSFORMERS_BUNDLE_PATH = "src/vendor/transformers/transformers.js";
const TRANSFORMERS_WASM_MJS_PATH = "src/vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs";
const TRANSFORMERS_WASM_BINARY_PATH = "src/vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm";
const KEYFRAME_SAMPLE_WIDTH = 160;
const KEYFRAME_SAMPLE_HEIGHT = 90;
const DEFAULT_KEYFRAME_THRESHOLD = 0.52;
const MIN_RAW_TEXT_LENGTH = 3;
const VISUAL_TYPE_LABELS = {
  "zh-CN": {
    ppt: "PPT",
    slide: "PPT",
    slides: "PPT",
    blackboard: "板书",
    chalkboard: "板书",
    whiteboard: "白板",
    screen: "屏幕",
    visual: "画面"
  },
  en: {
    ppt: "Slide",
    slide: "Slide",
    slides: "Slide",
    blackboard: "Blackboard",
    chalkboard: "Blackboard",
    whiteboard: "Whiteboard",
    screen: "Screen",
    visual: "Visual"
  }
};
const LOCAL_VISION_MESSAGES = {
  "zh-CN": {
    rawTitle: "{visualType}原文：{text}",
    visualTitle: "{visualType}画面",
    rawBullet: "已在浏览器本地提取{visualType}原文，等待 DeepSeek 做文本分析。",
    modelReady: "浏览器本地视觉模型已准备。",
    errorNoFrame: "缺少可分析的视频画面。",
    errorFrameUnsupported: "当前浏览器无法分析视频画面。",
    errorDebugImageRead: "无法读取调试图像。",
    reasonBlackboard: "深色背景更像板书",
    reasonWhiteboard: "浅色背景更像白板",
    reasonPpt: "浅色规则画面更像 PPT",
    reasonLightBackground: "浅色背景占比较高",
    reasonDarkInk: "存在深色文字或线条",
    reasonEdgeDensity: "画面边缘密度像课件内容",
    reasonTextBands: "多行区域有文字痕迹",
    reasonNotStable: "不像稳定课程画面"
  },
  en: {
    rawTitle: "{visualType} text: {text}",
    visualTitle: "{visualType} frame",
    rawBullet: "Local browser OCR extracted {visualType} text and is waiting for DeepSeek text analysis.",
    modelReady: "Browser local vision model is ready.",
    errorNoFrame: "Missing analyzable video frame.",
    errorFrameUnsupported: "This browser cannot analyze the video frame.",
    errorDebugImageRead: "Could not read debug image.",
    reasonBlackboard: "Dark background looks like a blackboard",
    reasonWhiteboard: "Light background looks like a whiteboard",
    reasonPpt: "Light structured frame looks like a slide",
    reasonLightBackground: "Light background ratio is high",
    reasonDarkInk: "Dark text or line strokes detected",
    reasonEdgeDensity: "Edge density resembles course material",
    reasonTextBands: "Multiple text-like bands detected",
    reasonNotStable: "Does not look like a stable lecture visual"
  }
};

let transformersPromise = null;
let pipelinePromise = null;
let modelProgressCallback = null;

export function detectPptKeyFrame(frame, options = {}) {
  const language = normalizeLanguage(options.language);
  const canvas = getFrameCanvas(frame, language);
  const seconds = normalizeSeconds(frame?.seconds);
  const candidates = buildKeyFrameRegionCandidates(canvas)
    .map((region) => {
      const stats = computeFrameStats(canvas, region, language);
      const classification = classifyTeachingVisualFrame(stats, region);
      return {
        region,
        stats,
        classification,
        score: classification.score
      };
    })
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const stats = best.stats;
  const score = best.score;
  const visualType = normalizeVisualType(best.classification.visualType);
  const visualTypeLabel = getVisualTypeLabel(visualType, language);
  const threshold = Number.isFinite(Number(options.threshold))
    ? Number(options.threshold)
    : DEFAULT_KEYFRAME_THRESHOLD;
  const shouldAnalyze = Boolean(options.force) || score >= threshold;

  return {
    source: "local-keyframe-detector-v2",
    shouldAnalyze,
    score: roundNumber(score, 3),
    threshold: roundNumber(threshold, 3),
    visualType,
    visualTypeLabel,
    reasons: buildKeyFrameReasons(stats, best.classification, threshold, language),
    stats: roundStats(stats),
    region: serializeRegion(best.region, canvas),
    typeScores: best.classification.typeScores.map((entry) => ({
      visualType: entry.visualType,
      label: getVisualTypeLabel(entry.visualType, language),
      score: roundNumber(entry.score, 3)
    })),
    candidateScores: candidates.slice(0, 3).map((candidate) => ({
      name: candidate.region.name,
      score: roundNumber(candidate.score, 3),
      visualType: normalizeVisualType(candidate.classification.visualType)
    })),
    timestamp: frame?.timestamp || formatTime(seconds * 1000),
    seconds
  };
}

export async function extractRawPptInfo(payload, options = {}) {
  const language = normalizeLanguage(options.language);
  const frame = payload?.frame || {};
  const canvas = getFrameCanvas(frame, language);
  const keyFrame =
    options.keyFrame ||
    detectPptKeyFrame(frame, {
      threshold: options.keyFrameThreshold,
      force: options.force,
      language
    });

  if (!keyFrame.shouldAnalyze && !options.force) {
    return buildRawExtractionResult({
      frame,
      rawText: "",
      keyFrame,
      shouldKeep: false,
      model: options.model || DEFAULT_LOCAL_VISION_MODEL,
      task: options.task || DEFAULT_LOCAL_VISION_TASK,
      language
    });
  }

  const captioner = await getLocalVisionPipeline({
    onProgress: options.onProgress,
    model: options.model || DEFAULT_LOCAL_VISION_MODEL,
    task: options.task || DEFAULT_LOCAL_VISION_TASK
  });
  const rawText = await extractTextFromFrameCanvases(captioner, getCanvasForKeyFrameRegion(canvas, keyFrame));

  return buildRawExtractionResult({
    frame,
    rawText,
    keyFrame,
    shouldKeep: shouldKeepRawExtraction(rawText),
    model: options.model || DEFAULT_LOCAL_VISION_MODEL,
    task: options.task || DEFAULT_LOCAL_VISION_TASK,
    language
  });
}

export async function analyzeLocalVisualFrame(payload, options = {}) {
  const extraction = await extractRawPptInfo(payload, {
    ...options,
    force: true
  });
  const visualType = normalizeVisualType(extraction.visualType);
  const language = normalizeLanguage(options.language);
  const visualTypeLabel = getVisualTypeLabel(visualType, language);
  const rawTitle = localVisionText("rawTitle", language, {
    visualType: visualTypeLabel,
    text: extraction.visibleText[0]?.slice(0, 28) || ""
  });
  return {
    timestamp: extraction.timestamp,
    seconds: extraction.seconds,
    title: extraction.visibleText[0]
      ? rawTitle
      : localVisionText("visualTitle", language, { visualType: visualTypeLabel }),
    visualType,
    shouldKeep: extraction.shouldKeep,
    bullets: extraction.visibleText.length
      ? [localVisionText("rawBullet", language, { visualType: visualTypeLabel })]
      : [],
    visibleText: extraction.visibleText,
    rawVisibleText: extraction.rawVisibleText,
    relationToTranscript: "",
    tags: [],
    localExtraction: extraction
  };
}

export async function preloadLocalVisionModel(options = {}) {
  await getLocalVisionPipeline({
    onProgress: options.onProgress,
    model: options.model || DEFAULT_LOCAL_VISION_MODEL,
    task: options.task || DEFAULT_LOCAL_VISION_TASK
  });
  return {
    status: "ok",
    model: options.model || DEFAULT_LOCAL_VISION_MODEL,
    message: localVisionText("modelReady", normalizeLanguage(options.language))
  };
}

export function getDefaultLocalVisionModel() {
  return DEFAULT_LOCAL_VISION_MODEL;
}

export async function debugBuildOcrCandidateImages(frame, options = {}) {
  const language = normalizeLanguage(options.language);
  const canvas = getFrameCanvas(frame, language);
  const keyFrame = options.keyFrame || detectPptKeyFrame(frame, { force: true, language });
  const sourceCanvas = getCanvasForKeyFrameRegion(canvas, keyFrame);
  const candidates = buildOcrCandidateCanvases(sourceCanvas);
  const sourceDataUrl = await canvasToDataUrl(candidates[0]?.sourceCanvas || sourceCanvas, options);
  const candidateImages = [];

  if (options.includeCandidates !== false) {
    for (const [index, candidate] of candidates.entries()) {
      candidateImages.push({
        index,
        kind: candidate.kind,
        width: candidate.canvas.width,
        height: candidate.canvas.height,
        dataUrl: await canvasToDataUrl(candidate.canvas, options)
      });
    }
  }

  return {
    keyFrame,
    source: {
      width: (candidates[0]?.sourceCanvas || sourceCanvas).width,
      height: (candidates[0]?.sourceCanvas || sourceCanvas).height,
      dataUrl: sourceDataUrl
    },
    candidates: candidateImages
  };
}

async function getLocalVisionPipeline({ onProgress, model, task }) {
  modelProgressCallback = typeof onProgress === "function" ? onProgress : modelProgressCallback;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { env, pipeline } = await loadTransformers();
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      // The wasm runtime is bundled inside the extension. Chrome's Cache API cannot
      // cache chrome-extension:// requests, so wasm caching only creates warnings.
      env.useWasmCache = false;
      env.backends.onnx.wasm.proxy = false;
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.wasmPaths = {
        mjs: runtimeUrl(TRANSFORMERS_WASM_MJS_PATH),
        wasm: runtimeUrl(TRANSFORMERS_WASM_BINARY_PATH)
      };
      return pipeline(task, model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (progress) => {
          modelProgressCallback?.(progress);
        }
      });
    })().catch((error) => {
      pipelinePromise = null;
      throw error;
    });
  }
  return pipelinePromise;
}

async function loadTransformers() {
  if (!transformersPromise) {
    transformersPromise = import(runtimeUrl(TRANSFORMERS_BUNDLE_PATH));
  }
  return transformersPromise;
}

function buildRawExtractionResult({ frame, rawText, keyFrame, shouldKeep, model, task, language = "zh-CN" }) {
  const seconds = normalizeSeconds(frame?.seconds);
  const visibleText = splitVisibleText(rawText);
  return {
    source: "local-ocr-transformersjs",
    extractionStage: "raw-ocr",
    timestamp: frame?.timestamp || formatTime(seconds * 1000),
    seconds,
    shouldKeep: Boolean(shouldKeep && visibleText.length),
    visualType: normalizeVisualType(keyFrame?.visualType),
    visualTypeLabel: getVisualTypeLabel(keyFrame?.visualType, language),
    rawVisibleText: String(rawText || "").trim(),
    visibleText,
    ocrConfidence: null,
    ocrModel: model,
    ocrTask: task,
    keyFrame
  };
}

async function extractTextFromFrameCanvases(captioner, canvas) {
  const candidates = buildOcrCandidateCanvases(canvas);
  const lines = [];

  for (const candidate of candidates) {
    const generated = await captioner(candidate.canvas, {
      max_new_tokens: candidate.kind === "line" ? 48 : 96
    });
    const text = extractGeneratedText(generated);
    if (text && !isNoisyOcrText(text)) {
      lines.push(text);
    }
  }

  if (!lines.length && candidates[0]?.sourceCanvas) {
    const generated = await captioner(candidates[0].sourceCanvas, {
      max_new_tokens: 96
    });
    const text = extractGeneratedText(generated);
    if (text && !isNoisyOcrText(text, { lenient: true })) {
      lines.push(text);
    }
  }

  return dedupeOcrLines(lines).join("\n");
}

function buildOcrCandidateCanvases(canvas) {
  const sourceCanvas = cropLikelySlideSurface(normalizeCanvasForReading(canvas));
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [{ kind: "full", canvas }];
  }

  const image = context.getImageData(0, 0, width, height).data;
  const rowInk = new Uint16Array(height);

  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luma = image[offset] * 0.299 + image[offset + 1] * 0.587 + image[offset + 2] * 0.114;
      if (luma < 150) {
        count += 1;
      }
    }
    rowInk[y] = count;
  }

  const minInk = Math.max(8, width * 0.026);
  const bands = mergeActiveBands(rowInk, minInk, 18)
    .map((band) => expandBand(band, height, 18))
    .filter((band) => band.end - band.start >= 12)
    .slice(0, 8);

  const lineCanvases = bands
    .map((band) => cropTextBand(sourceCanvas, band))
    .filter(Boolean)
    .map((lineCanvas) => ({ kind: "line", canvas: lineCanvas }));

  if (lineCanvases.length) {
    return lineCanvases.map((candidate) => ({
      ...candidate,
      sourceCanvas
    }));
  }
  return [{ kind: "full", canvas: sourceCanvas, sourceCanvas }];
}

function cropLikelySlideSurface(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || width <= 1 || height <= 1) {
    return canvas;
  }

  const image = context.getImageData(0, 0, width, height).data;
  const brightRows = new Uint16Array(height);
  const brightCols = new Uint16Array(width);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let brightCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luma = image[offset] * 0.299 + image[offset + 1] * 0.587 + image[offset + 2] * 0.114;
      const colorSpread = Math.max(image[offset], image[offset + 1], image[offset + 2]) - Math.min(image[offset], image[offset + 1], image[offset + 2]);
      if (luma > 205 && colorSpread < 70) {
        brightCount += 1;
        brightRows[y] += 1;
        brightCols[x] += 1;
      }
    }
  }

  const minBrightColPixels = Math.max(4, height * 0.32);
  const minBrightRowPixels = Math.max(4, width * 0.32);
  for (let x = 0; x < width; x += 1) {
    if (brightCols[x] >= minBrightColPixels) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  for (let y = 0; y < height; y += 1) {
    if (brightRows[y] >= minBrightRowPixels) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const brightRatio = brightCount / Math.max(width * height, 1);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  if (brightRatio < 0.12 || cropWidth < width * 0.25 || cropHeight < height * 0.25) {
    return canvas;
  }

  const padding = 0;
  const sourceX = Math.max(0, minX - padding);
  const sourceY = Math.max(0, minY - padding);
  const sourceWidth = Math.min(width - sourceX, cropWidth + padding * 2);
  const sourceHeight = Math.min(height - sourceY, cropHeight + padding * 2);
  const output = createCanvas(sourceWidth, sourceHeight);
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) {
    return canvas;
  }

  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, sourceWidth, sourceHeight);
  outputContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return output;
}

function normalizeCanvasForReading(canvas) {
  const width = Math.min(960, Math.max(1, canvas.width || 1));
  const height = Math.max(1, Math.round(((canvas.height || 1) / Math.max(canvas.width || 1, 1)) * width));
  const normalized = createCanvas(width, height);
  const context = normalized.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(canvas, 0, 0, width, height);
  return normalized;
}

function mergeActiveBands(rowInk, minInk, maxGap) {
  const bands = [];
  let current = null;
  let gap = 0;

  for (let y = 0; y < rowInk.length; y += 1) {
    if (rowInk[y] >= minInk) {
      if (!current) {
        current = { start: y, end: y + 1 };
      } else {
        current.end = y + 1;
      }
      gap = 0;
      continue;
    }

    if (current) {
      gap += 1;
      if (gap > maxGap) {
        current.end = Math.max(current.start + 1, current.end - gap + 1);
        bands.push(current);
        current = null;
        gap = 0;
      }
    }
  }

  if (current) {
    bands.push(current);
  }
  return bands;
}

function expandBand(band, height, padding) {
  return {
    start: Math.max(0, band.start - padding),
    end: Math.min(height, band.end + padding)
  };
}

function cropTextBand(canvas, band) {
  const width = canvas.width;
  const height = band.end - band.start;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || height <= 0) {
    return null;
  }

  const image = context.getImageData(0, band.start, width, height).data;
  let minX = width;
  let maxX = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luma = image[offset] * 0.299 + image[offset + 1] * 0.587 + image[offset + 2] * 0.114;
      if (luma < 160) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }

  if (maxX <= minX) {
    return null;
  }

  const paddingX = 24;
  const sourceX = Math.max(0, minX - paddingX);
  const sourceWidth = Math.min(width - sourceX, maxX - minX + paddingX * 2);
  const targetHeight = 112;
  const scale = targetHeight / Math.max(height, 1);
  const targetWidth = Math.max(160, Math.min(960, Math.round(sourceWidth * scale)));
  const output = createCanvas(targetWidth, targetHeight);
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) {
    return null;
  }

  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, targetWidth, targetHeight);
  outputContext.drawImage(canvas, sourceX, band.start, sourceWidth, height, 0, 0, targetWidth, targetHeight);
  return output;
}

function dedupeOcrLines(lines) {
  const seen = new Set();
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function isNoisyOcrText(text, options = {}) {
  const normalized = String(text || "").replace(/\s+/g, "");
  if (!normalized) {
    return true;
  }
  const letters = (normalized.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
  return letters / normalized.length < (options.lenient ? 0.35 : 0.5);
}

function getFrameCanvas(frame, language = "zh-CN") {
  const canvas = frame?.canvas;
  const isHtmlCanvas = typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement;
  const isOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas;
  if (!isHtmlCanvas && !isOffscreenCanvas) {
    throw new Error(localVisionText("errorNoFrame", language));
  }
  return canvas;
}

function buildKeyFrameRegionCandidates(canvas) {
  const width = Math.max(1, canvas.width || 1);
  const height = Math.max(1, canvas.height || 1);
  const regions = [
    { name: "full", x: 0, y: 0, width, height },
    { name: "left", x: 0, y: 0, width: width * 0.6, height },
    { name: "right", x: width * 0.4, y: 0, width: width * 0.6, height },
    { name: "center", x: width * 0.15, y: 0, width: width * 0.7, height },
    { name: "left-slide-area", x: 0, y: height * 0.12, width: width * 0.62, height: height * 0.78 },
    { name: "wide-slide-area", x: 0, y: height * 0.1, width: width * 0.72, height: height * 0.8 }
  ];

  return regions.map((region) => ({
    ...region,
    x: Math.max(0, Math.round(region.x)),
    y: Math.max(0, Math.round(region.y)),
    width: Math.max(1, Math.min(width - Math.max(0, Math.round(region.x)), Math.round(region.width))),
    height: Math.max(1, Math.min(height - Math.max(0, Math.round(region.y)), Math.round(region.height)))
  }));
}

function getCanvasForKeyFrameRegion(canvas, keyFrame) {
  const region = keyFrame?.region;
  if (!region || region.name === "full") {
    return canvas;
  }

  const sourceX = Math.max(0, Math.round(Number(region.xRatio || 0) * canvas.width));
  const sourceY = Math.max(0, Math.round(Number(region.yRatio || 0) * canvas.height));
  const sourceWidth = Math.max(
    1,
    Math.min(canvas.width - sourceX, Math.round(Number(region.widthRatio || 1) * canvas.width))
  );
  const sourceHeight = Math.max(
    1,
    Math.min(canvas.height - sourceY, Math.round(Number(region.heightRatio || 1) * canvas.height))
  );
  const output = createCanvas(sourceWidth, sourceHeight);
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return output;
}

function serializeRegion(region, canvas) {
  return {
    name: region.name,
    xRatio: roundNumber(region.x / Math.max(canvas.width || 1, 1), 4),
    yRatio: roundNumber(region.y / Math.max(canvas.height || 1, 1), 4),
    widthRatio: roundNumber(region.width / Math.max(canvas.width || 1, 1), 4),
    heightRatio: roundNumber(region.height / Math.max(canvas.height || 1, 1), 4)
  };
}

function computeFrameStats(canvas, region = null, language = "zh-CN") {
  const width = KEYFRAME_SAMPLE_WIDTH;
  const height = KEYFRAME_SAMPLE_HEIGHT;
  const sampleCanvas = createCanvas(width, height);
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error(localVisionText("errorFrameUnsupported", language));
  }

  const source = region || {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  };
  context.drawImage(canvas, source.x, source.y, source.width, source.height, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  const rowInk = new Uint16Array(height);
  const colInk = new Uint16Array(width);

  let brightPixels = 0;
  let darkPixels = 0;
  let midPixels = 0;
  let totalLuma = 0;
  let totalLumaSquared = 0;

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const luma = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    luminance[pixel] = luma;
    totalLuma += luma;
    totalLumaSquared += luma * luma;
    if (luma > 210) {
      brightPixels += 1;
    } else if (luma < 82) {
      darkPixels += 1;
      const y = Math.floor(pixel / width);
      const x = pixel - y * width;
      rowInk[y] += 1;
      colInk[x] += 1;
    } else {
      midPixels += 1;
    }
  }

  let edges = 0;
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const current = luminance[y * width + x];
      const left = luminance[y * width + x - 1];
      const up = luminance[(y - 1) * width + x];
      if (Math.abs(current - left) > 42 || Math.abs(current - up) > 42) {
        edges += 1;
      }
    }
  }

  const pixelCount = width * height;
  const meanLuma = totalLuma / pixelCount;
  const variance = Math.max(0, totalLumaSquared / pixelCount - meanLuma * meanLuma);
  const activeRows = Array.from(rowInk).filter((count) => count >= Math.max(2, width * 0.015)).length;
  const activeCols = Array.from(colInk).filter((count) => count >= Math.max(2, height * 0.015)).length;

  return {
    brightRatio: brightPixels / pixelCount,
    darkRatio: darkPixels / pixelCount,
    midRatio: midPixels / pixelCount,
    edgeDensity: edges / pixelCount,
    activeRowRatio: activeRows / height,
    activeColRatio: activeCols / width,
    meanLuma: meanLuma / 255,
    contrast: Math.sqrt(variance) / 128
  };
}

function classifyTeachingVisualFrame(stats, region) {
  const typeScores = [
    {
      visualType: "ppt",
      score: scoreSlideFrame(stats, region)
    },
    {
      visualType: "blackboard",
      score: scoreBlackboardFrame(stats, region)
    },
    {
      visualType: "whiteboard",
      score: scoreWhiteboardFrame(stats, region)
    }
  ].sort((left, right) => right.score - left.score);

  const best = typeScores[0] || { visualType: "visual", score: 0 };
  return {
    visualType: normalizeVisualType(best.visualType),
    score: roundNumber(best.score, 4),
    typeScores
  };
}

function scoreSlideFrame(stats, region) {
  const brightScore = clamp((stats.brightRatio - 0.18) / 0.48);
  const lightBackgroundScore = clamp((stats.meanLuma - 0.45) / 0.4);
  const darkTextScore = clamp((stats.darkRatio - 0.008) / 0.11);
  const edgeScore = bellScore(stats.edgeDensity, 0.035, 0.22);
  const rowScore = clamp((stats.activeRowRatio - 0.04) / 0.26);
  const colScore = clamp((stats.activeColRatio - 0.04) / 0.26);
  const contrastScore = clamp((stats.contrast - 0.08) / 0.38);
  const aspectScore = region.width / Math.max(region.height, 1) >= 1.1 ? 1 : 0.4;
  const darkDominantPenalty = clamp((stats.darkRatio - 0.28) / 0.38) * 0.36;

  return clamp(
    brightScore * 0.28 +
      lightBackgroundScore * 0.16 +
      darkTextScore * 0.18 +
      edgeScore * 0.16 +
      rowScore * 0.1 +
      colScore * 0.05 +
      contrastScore * 0.04 +
      aspectScore * 0.03 -
      darkDominantPenalty
  );
}

function scoreBlackboardFrame(stats, region) {
  const darkBackgroundScore = clamp((stats.darkRatio - 0.22) / 0.5);
  const darkMeanScore = clamp((0.58 - stats.meanLuma) / 0.42);
  const chalkScore = clamp((stats.brightRatio - 0.008) / 0.16);
  const edgeScore = bellScore(stats.edgeDensity, 0.025, 0.2);
  const rowScore = clamp((stats.activeRowRatio - 0.12) / 0.45);
  const colScore = clamp((stats.activeColRatio - 0.08) / 0.45);
  const contrastScore = clamp((stats.contrast - 0.1) / 0.42);
  const aspectScore = region.width / Math.max(region.height, 1) >= 1.1 ? 1 : 0.5;
  const brightDominantPenalty = clamp((stats.brightRatio - 0.2) / 0.35) * 0.32;

  return clamp(
    darkBackgroundScore * 0.28 +
      darkMeanScore * 0.2 +
      chalkScore * 0.16 +
      edgeScore * 0.14 +
      rowScore * 0.08 +
      colScore * 0.05 +
      contrastScore * 0.06 +
      aspectScore * 0.03 -
      brightDominantPenalty
  );
}

function scoreWhiteboardFrame(stats, region) {
  const brightScore = clamp((stats.brightRatio - 0.28) / 0.45);
  const lightBackgroundScore = clamp((stats.meanLuma - 0.62) / 0.32);
  const darkMarkerScore = clamp((stats.darkRatio - 0.004) / 0.08);
  const edgeScore = bellScore(stats.edgeDensity, 0.02, 0.18);
  const rowScore = clamp((stats.activeRowRatio - 0.03) / 0.22);
  const aspectScore = region.width / Math.max(region.height, 1) >= 1.05 ? 1 : 0.45;

  return clamp(
    brightScore * 0.26 +
      lightBackgroundScore * 0.22 +
      darkMarkerScore * 0.18 +
      edgeScore * 0.16 +
      rowScore * 0.12 +
      aspectScore * 0.06
  );
}

function bellScore(value, low, high) {
  if (value <= 0) {
    return 0;
  }
  if (value >= low && value <= high) {
    return 1;
  }
  if (value < low) {
    return clamp(value / low);
  }
  return clamp(1 - (value - high) / high);
}

function buildKeyFrameReasons(stats, classification, threshold, language = "zh-CN") {
  const reasons = [];
  const visualType = normalizeVisualType(classification?.visualType);
  const score = Number(classification?.score || 0);
  if (visualType === "blackboard") {
    reasons.push(localVisionText("reasonBlackboard", language));
  } else if (visualType === "whiteboard") {
    reasons.push(localVisionText("reasonWhiteboard", language));
  } else if (visualType === "ppt") {
    reasons.push(localVisionText("reasonPpt", language));
  }
  if (stats.brightRatio >= 0.35) {
    reasons.push(localVisionText("reasonLightBackground", language));
  }
  if (stats.darkRatio >= 0.015) {
    reasons.push(localVisionText("reasonDarkInk", language));
  }
  if (stats.edgeDensity >= 0.025) {
    reasons.push(localVisionText("reasonEdgeDensity", language));
  }
  if (stats.activeRowRatio >= 0.08) {
    reasons.push(localVisionText("reasonTextBands", language));
  }
  if (score < threshold) {
    reasons.push(localVisionText("reasonNotStable", language));
  }
  return reasons;
}

function normalizeLanguage(value) {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

function localVisionText(key, language = "zh-CN", values = {}) {
  const locale = normalizeLanguage(language);
  const template = LOCAL_VISION_MESSAGES[locale]?.[key] || LOCAL_VISION_MESSAGES["zh-CN"][key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
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
  const labels = VISUAL_TYPE_LABELS[normalizeLanguage(language)] || VISUAL_TYPE_LABELS["zh-CN"];
  return labels[normalizeVisualType(value)] || labels.visual;
}

function shouldKeepRawExtraction(rawText) {
  return String(rawText || "").replace(/\s+/g, "").length >= MIN_RAW_TEXT_LENGTH;
}

function splitVisibleText(rawText) {
  return String(rawText || "")
    .split(/[\n\r|•·;；。]+/)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 2)
    .slice(0, 12);
}

function extractGeneratedText(generated) {
  const first = Array.isArray(generated) ? generated.flat(Infinity)[0] : generated;
  return String(first?.generated_text || first?.text || first || "")
    .replace(/<\|[^>]+?\|>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToDataUrl(canvas, options = {}) {
  const outputCanvas = resizeCanvasForPreview(canvas, options.maxWidth);
  const type = options.type || "image/jpeg";
  const quality = Number.isFinite(Number(options.quality)) ? Number(options.quality) : 0.68;

  if (typeof outputCanvas.toDataURL === "function") {
    return outputCanvas.toDataURL(type, quality);
  }
  if (typeof outputCanvas.convertToBlob === "function") {
    const blob = await outputCanvas.convertToBlob({ type, quality });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(localVisionText("errorDebugImageRead")));
      reader.readAsDataURL(blob);
    });
  }
  return "";
}

function resizeCanvasForPreview(canvas, maxWidth) {
  const width = Math.max(1, Number(canvas?.width) || 1);
  const height = Math.max(1, Number(canvas?.height) || 1);
  const targetWidth = Number.isFinite(Number(maxWidth)) ? Math.min(width, Math.max(1, Number(maxWidth))) : width;
  if (targetWidth >= width) {
    return canvas;
  }

  const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));
  const output = createCanvas(targetWidth, targetHeight);
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(canvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
  return output;
}

function runtimeUrl(path) {
  const runtime = globalThis.chrome?.runtime;
  if (typeof runtime?.getURL === "function") {
    return runtime.getURL(path);
  }
  return path;
}

function normalizeSeconds(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function roundStats(stats) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, roundNumber(value, 4)])
  );
}

function roundNumber(value, digits) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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
