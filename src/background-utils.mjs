export function chunkTranscript(transcript, maxChars) {
  const chunks = [];
  let current = [];
  let currentChars = 0;

  for (const entry of transcript) {
    const line = `[${formatTime(entry.startMs)}] ${entry.text}`;
    if (current.length && currentChars + line.length > maxChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(entry);
    currentChars += line.length;
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

export class ModelJsonParseError extends Error {
  constructor(text, cause) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause || "unknown");
    super(`模型返回的内容不是有效 JSON: ${causeMessage}`);
    this.name = "ModelJsonParseError";
    this.rawText = String(text || "");
    this.cause = cause;
  }
}

export function safeParseModelJson(text) {
  const source = String(text || "").trim();
  let lastError = null;

  try {
    return JSON.parse(source);
  } catch (error) {
    lastError = error;
  }

  for (const candidate of extractJsonCandidates(source)) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw new ModelJsonParseError(source, lastError);
}

function extractJsonCandidates(text) {
  const candidates = [];
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function normalizeRemoteStudyPack(pack, transcript, videoTitle) {
  return {
    title: pack?.title || videoTitle,
    summary: "",
    outline: Array.isArray(pack?.outline) ? pack.outline : [],
    lectureNotes: [],
    concepts: [],
    tags: [],
    questions: [],
    transcript
  };
}

export function mergePartialStudyPacks(partialPacks, videoTitle) {
  const packs = Array.isArray(partialPacks) ? partialPacks : [];
  const title = packs.find((pack) => pack?.title)?.title || videoTitle || "";
  const seen = new Set();
  const outline = packs
    .flatMap((pack) => (Array.isArray(pack?.outline) ? pack.outline : []))
    .map(normalizeOutlineItem)
    .filter((item) => item.heading || item.bullets.length)
    .filter((item) => {
      const key = `${item.seconds}|${item.heading}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => Number(left.seconds || 0) - Number(right.seconds || 0));

  return { title, outline };
}

function normalizeOutlineItem(item) {
  const explicitSeconds = Number(item?.seconds);
  const seconds = Number.isFinite(explicitSeconds)
    ? Math.max(0, Math.round(explicitSeconds))
    : parseTimestampSeconds(item?.timestamp);

  return {
    timestamp: item?.timestamp || formatTime(seconds * 1000),
    seconds,
    heading: String(item?.heading || "").trim(),
    bullets: Array.isArray(item?.bullets)
      ? dedupeStrings(item.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean))
      : []
  };
}

function parseTimestampSeconds(timestamp) {
  const parts = String(timestamp || "")
    .split(":")
    .map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }
  return Math.max(0, parts.reduce((total, part) => total * 60 + part, 0));
}

function dedupeStrings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function hasMostlyEnglishOutline(pack) {
  const fields = [
    pack?.title,
    ...(Array.isArray(pack?.outline)
      ? pack.outline.flatMap((item) => [item?.heading, ...(Array.isArray(item?.bullets) ? item.bullets : [])])
      : [])
  ].filter(Boolean);

  const englishDominantFields = fields.filter(isEnglishDominantText).length;
  if (englishDominantFields >= 2) {
    return true;
  }

  const text = fields.join(" ");
  if (!text) {
    return false;
  }

  const latinChars = (text.match(/[A-Za-z]/g) || []).length;
  const chineseChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return latinChars > 40 && latinChars > chineseChars;
}

export function isEnglishDominantText(value) {
  const text = String(value || "");
  const latinChars = (text.match(/[A-Za-z]/g) || []).length;
  const chineseChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const englishWords = (text.match(/\b[A-Za-z][A-Za-z-]{3,}\b/g) || []).length;
  return englishWords >= 3 && latinChars > Math.max(12, chineseChars);
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
