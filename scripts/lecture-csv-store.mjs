import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export function defaultCsvPath(rootDir) {
  return path.join(rootDir, "data", "lecture_csv", "lecture_library.csv");
}

export async function upsertLectureCsvRecord(record, csvPath) {
  const normalized = normalizeRecord(record);
  const rows = await readCsvRows(csvPath);
  const nextRows = upsertByVideoId(rows, normalized);

  await mkdir(path.dirname(csvPath), { recursive: true });
  await writeFile(csvPath, stringifyCsv(nextRows), "utf8");

  return {
    csvPath,
    rowCount: nextRows.length,
    videoId: normalized.video_id
  };
}

export function normalizeRecord(record) {
  const source = record && typeof record === "object" ? record : {};
  const videoId = stringValue(source.video_id || source.videoId);
  if (!videoId) {
    throw new Error("缺少 video_id。");
  }

  return Object.fromEntries(
    CSV_HEADERS.map((header) => [header, stringifyCell(source[header] ?? source[camelCase(header)])])
  );
}

export function upsertByVideoId(rows, record) {
  const index = rows.findIndex((row) => row.video_id === record.video_id);
  if (index === -1) {
    return [...rows, record];
  }

  return rows.map((row, rowIndex) => (rowIndex === index ? record : row));
}

export async function readCsvRows(csvPath) {
  try {
    const text = await readFile(csvPath, "utf8");
    return parseCsv(text);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function stringifyCsv(rows) {
  const lines = [
    CSV_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => escapeCsvCell(row[header] || "")).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

export function parseCsv(text) {
  const rows = parseCsvMatrix(text);
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

function stringValue(value) {
  return String(value ?? "");
}

function camelCase(text) {
  return String(text).replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
}
