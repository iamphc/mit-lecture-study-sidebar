export const LECTURE_LIBRARY_CSV_FILE = "lecture_library.csv";
export const LECTURE_FILES_DIR = "lectures";
export const LECTURE_IMAGES_DIR = "images";

export const CSV_HEADERS = [
  "video_id",
  "video_url",
  "video_title",
  "published_at",
  "watched_at",
  "watch_time_seconds",
  "duration_seconds",
  "saved_at",
  "transcript_line_count",
  "transcript_text",
  "transcript_json",
  "visual_analysis_json",
  "summary",
  "tags",
  "tags_json",
  "outline_json",
  "lecture_notes_json",
  "concepts_json",
  "questions_json",
  "study_pack_markdown"
];

export function normalizeLocalLectureRecord(record) {
  const source = record && typeof record === "object" ? record : {};
  const videoId = stringValue(source.video_id || source.videoId).trim();
  if (!videoId) {
    throw new Error("缺少 video_id，无法保存本地课程数据。");
  }

  return Object.fromEntries(
    CSV_HEADERS.map((header) => [header, stringifyCell(source[header] ?? source[camelCase(header)])])
  );
}

export function upsertCsvRecord(csvText, record) {
  const rows = parseCsv(csvText);
  const nextRows = upsertByVideoId(rows, normalizeLocalLectureRecord(record));
  return {
    csvText: stringifyCsv(nextRows),
    rowCount: nextRows.length
  };
}

export function prepareLocalLectureRecord(record) {
  const normalized = normalizeLocalLectureRecord(record);
  const visualAnalysis = parseJsonCell(normalized.visual_analysis_json, []);
  const { items, imageAssets } = externalizeVisualAnalysisImages(visualAnalysis);
  return {
    record: {
      ...normalized,
      visual_analysis_json: JSON.stringify(items)
    },
    imageAssets
  };
}

export function buildLocalLectureFiles(record) {
  const normalized = normalizeLocalLectureRecord(record);
  const folderName = sanitizePathSegment(normalized.video_id);
  const richRecord = {
    videoId: normalized.video_id,
    videoUrl: normalized.video_url,
    videoTitle: normalized.video_title,
    publishedAt: normalized.published_at,
    watchedAt: normalized.watched_at,
    watchTimeSeconds: numberValue(normalized.watch_time_seconds),
    durationSeconds: numberValue(normalized.duration_seconds),
    savedAt: normalized.saved_at,
    transcriptLineCount: numberValue(normalized.transcript_line_count),
    transcriptText: normalized.transcript_text,
    transcript: parseJsonCell(normalized.transcript_json, []),
    outline: parseJsonCell(normalized.outline_json, []),
    visualAnalysis: parseJsonCell(normalized.visual_analysis_json, []),
    summary: normalized.summary,
    tags: parseJsonCell(normalized.tags_json, []),
    lectureNotes: parseJsonCell(normalized.lecture_notes_json, []),
    concepts: parseJsonCell(normalized.concepts_json, []),
    questions: parseJsonCell(normalized.questions_json, [])
  };

  return {
    folderName,
    jsonFileName: "lecture.json",
    markdownFileName: "study_pack.md",
    jsonText: `${JSON.stringify(richRecord, null, 2)}\n`,
    markdownText: normalized.study_pack_markdown || ""
  };
}

function externalizeVisualAnalysisImages(items) {
  const imageAssets = [];
  const normalizedItems = Array.isArray(items) ? items : [];
  const nextItems = normalizedItems.map((item, index) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const nextItem = { ...item };
    for (const config of [
      { field: "framePreview", pathField: "framePreviewPath", suffix: "frame" },
      { field: "ocrRegionPreview", pathField: "ocrRegionPreviewPath", suffix: "ocr" }
    ]) {
      const parsed = parseDataImageUrl(nextItem[config.field]);
      if (!parsed) {
        continue;
      }

      const fileName = buildImageFileName(item, index, config.suffix, parsed.extension);
      const relativePath = `${LECTURE_IMAGES_DIR}/${fileName}`;
      imageAssets.push({
        field: config.field,
        relativePath,
        fileName,
        mimeType: parsed.mimeType,
        dataUrl: parsed.dataUrl,
        base64: parsed.base64
      });
      delete nextItem[config.field];
      nextItem[config.pathField] = relativePath;
    }
    return nextItem;
  });

  return {
    items: nextItems,
    imageAssets
  };
}

function parseDataImageUrl(value) {
  const text = stringValue(value).trim();
  const match = text.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    return null;
  }
  const subtype = match[1].toLowerCase();
  return {
    dataUrl: text,
    base64: match[2],
    mimeType: subtype === "jpg" ? "image/jpeg" : `image/${subtype}`,
    extension: subtype === "jpeg" ? "jpg" : subtype
  };
}

function buildImageFileName(item, index, suffix, extension) {
  const seconds = Number(item?.seconds);
  const normalizedSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : index;
  const paddedSeconds = String(normalizedSeconds).padStart(6, "0");
  const paddedIndex = String(index + 1).padStart(2, "0");
  return `${paddedSeconds}-${paddedIndex}-${suffix}.${extension}`;
}

export function parseCsv(text) {
  const rows = parseCsvMatrix(String(text || ""));
  if (!rows.length) {
    return [];
  }

  const headers = rows[0];
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      Object.fromEntries(CSV_HEADERS.map((header) => [header, row[headers.indexOf(header)] || ""]))
    );
}

export function stringifyCsv(rows) {
  const lines = [
    CSV_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => escapeCsvCell(row[header] || "")).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

export function upsertByVideoId(rows, record) {
  const normalized = normalizeLocalLectureRecord(record);
  const index = rows.findIndex((row) => row.video_id === normalized.video_id);
  if (index === -1) {
    return [...rows, normalized];
  }
  return rows.map((row, rowIndex) => (rowIndex === index ? normalized : row));
}

function parseCsvMatrix(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeCsvCell(value) {
  const text = stringValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function stringifyCell(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function parseJsonCell(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sanitizePathSegment(value) {
  return stringValue(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "lecture";
}

function stringValue(value) {
  return String(value ?? "");
}

function camelCase(text) {
  return String(text).replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
}
