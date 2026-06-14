import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { defaultCsvPath, upsertLectureCsvRecord } from "./lecture-csv-store.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.LECTURE_CSV_PORT || 45873);
const csvPath = process.env.LECTURE_CSV_PATH || defaultCsvPath(rootDir);
const visualDebugPath = resolveVisualDebugPath(process.env.VISUAL_DEBUG_PATH || "data/visual_debug");

export const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true, csvPath, visualDebugPath });
    return;
  }

  if (request.method !== "POST" || request.url !== "/lecture") {
    if (request.method === "POST" && request.url === "/visual-debug") {
      try {
        const body = await readRequestBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await saveVisualDebugSnapshot(payload);
        sendJson(response, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body || "{}");
    const result = await upsertLectureCsvRecord(payload, csvPath);
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Lecture CSV server listening at http://127.0.0.1:${port}`);
    console.log(`CSV path: ${csvPath}`);
    console.log(`Visual debug path: ${visualDebugPath}`);
  });
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("请求体太大。"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export async function saveVisualDebugSnapshot(payload) {
  const normalized = normalizeVisualDebugPayload(payload);
  const baseDir = resolveVisualDebugPath(normalized.save_dir || visualDebugPath);
  const dir = path.join(baseDir, normalized.video_id, normalized.date_slug);
  await mkdir(dir, { recursive: true });

  const baseName = `${normalized.timestamp_slug}-${normalized.seconds.toString().padStart(5, "0")}`;
  const jsonPath = path.join(dir, `${baseName}.json`);
  const framePath = path.join(dir, `${baseName}-frame.jpg`);
  const ocrPath = path.join(dir, `${baseName}-ocr.jpg`);

  await writeFile(jsonPath, JSON.stringify(normalized, null, 2), "utf8");
  await writeDataUrlFile(framePath, normalized.frame_preview);
  await writeDataUrlFile(ocrPath, normalized.ocr_region_preview);

  return {
    dir,
    jsonPath,
    framePath,
    ocrPath,
    videoId: normalized.video_id
  };
}

function normalizeVisualDebugPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const videoId = safeSlug(String(source.videoId || "unknown-video"));
  const timestamp = String(source.timestamp || "00:00");
  const seconds = Number.isFinite(Number(source.seconds)) ? Math.max(0, Math.round(Number(source.seconds))) : 0;
  const dateSlug = safeSlug(String(source.savedAt || new Date().toISOString()).slice(0, 10));
  return {
    video_id: videoId,
    video_title: String(source.videoTitle || ""),
    video_url: String(source.videoUrl || ""),
    timestamp,
    timestamp_slug: safeSlug(timestamp || "00-00"),
    seconds,
    saved_at: String(source.savedAt || new Date().toISOString()),
    save_dir: String(source.saveDir || ""),
    date_slug: dateSlug,
    frame_preview: String(source.framePreview || ""),
    ocr_region_preview: String(source.ocrRegionPreview || ""),
    raw_visible_text: String(source.rawVisibleText || ""),
    analysis: source.analysis && typeof source.analysis === "object" ? source.analysis : {},
    key_frame: source.keyFrame && typeof source.keyFrame === "object" ? source.keyFrame : null,
    transcript_context: Array.isArray(source.transcriptContext) ? source.transcriptContext : []
  };
}

async function writeDataUrlFile(filePath, dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  if (!match?.[1]) {
    return;
  }
  await writeFile(filePath, Buffer.from(match[1], "base64"));
}

function resolveVisualDebugPath(configuredPath) {
  const text = String(configuredPath || "data/visual_debug").trim();
  return path.isAbsolute(text) ? path.resolve(text) : path.resolve(rootDir, text);
}

function safeSlug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}
