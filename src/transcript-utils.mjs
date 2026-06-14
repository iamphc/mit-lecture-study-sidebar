export function readPlayerResponseFromHtml(html) {
  const playerResponseMarker = "ytInitialPlayerResponse";
  const playerResponseIndex = html.indexOf(playerResponseMarker);
  if (playerResponseIndex !== -1) {
    const objectStart = html.indexOf("{", playerResponseIndex);
    const objectText = extractBalancedJsonObject(html, objectStart);
    if (objectText) {
      const parsed = safeParseJson(objectText);
      if (parsed?.captions || parsed?.videoDetails) {
        return parsed;
      }
    }
  }

  const rawResponseMarkers = ['"playerResponse":"', '"raw_player_response":"'];

  for (const marker of rawResponseMarkers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const encodedStart = markerIndex + marker.length;
    const encodedEnd = findEscapedStringEnd(html, encodedStart);
    if (encodedEnd === -1) {
      continue;
    }

    const encodedPayload = html.slice(encodedStart, encodedEnd);
    const decodedPayload = decodeEscapedJsonString(encodedPayload);
    const parsed = safeParseJson(decodedPayload);
    if (parsed?.captions || parsed?.videoDetails) {
      return parsed;
    }
  }

  return null;
}

export function readInitialDataFromHtml(html) {
  const initialDataMarker = "ytInitialData";
  const initialDataIndex = html.indexOf(initialDataMarker);
  if (initialDataIndex === -1) {
    return null;
  }

  const objectStart = html.indexOf("{", initialDataIndex);
  const objectText = extractBalancedJsonObject(html, objectStart);
  if (!objectText) {
    return null;
  }

  const parsed = safeParseJson(objectText);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function readYtcfgFromHtml(html) {
  const marker = "ytcfg.set(";
  let searchIndex = 0;
  let mergedConfig = {};

  while (searchIndex < html.length) {
    const markerIndex = html.indexOf(marker, searchIndex);
    if (markerIndex === -1) {
      break;
    }

    const objectStart = html.indexOf("{", markerIndex);
    const objectText = extractBalancedJsonObject(html, objectStart);
    const parsed = objectText ? safeParseJson(objectText) : null;
    if (parsed && typeof parsed === "object") {
      mergedConfig = {
        ...mergedConfig,
        ...parsed
      };
    }

    searchIndex = markerIndex + marker.length;
  }

  return Object.keys(mergedConfig).length ? mergedConfig : null;
}

export function extractBalancedJsonObject(text, startIndex) {
  if (startIndex < 0 || text[startIndex] !== "{") {
    return "";
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

export function findEscapedStringEnd(text, startIndex) {
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === "\\") {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      return index;
    }
  }

  return -1;
}

export function decodeEscapedJsonString(text) {
  return text
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n");
}

export function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

export function safeParseJsonText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  const direct = safeParseJson(trimmed);
  if (direct) {
    return direct;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return safeParseJson(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

export function parseCaptionXml(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed[0] !== "<") {
    return null;
  }

  const textNodePattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  const nodes = [];
  let match;

  while ((match = textNodePattern.exec(trimmed))) {
    const attributes = match[1] || "";
    const start = Number.parseFloat(readXmlAttribute(attributes, "start") || "0");
    const duration = Number.parseFloat(readXmlAttribute(attributes, "dur") || "4");
    const decodedText = decodeXmlEntities(stripXmlTags(match[2] || ""))
      .replace(/\s+/g, " ")
      .trim();

    if (!decodedText) {
      continue;
    }

    nodes.push({
      startMs: Number.isFinite(start) ? Math.round(start * 1000) : 0,
      durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : 4000,
      text: decodedText
    });
  }

  return nodes.length ? nodes : null;
}

function readXmlAttribute(source, name) {
  const pattern = new RegExp(`${name}="([^"]*)"`, "i");
  return source.match(pattern)?.[1] || "";
}

function stripXmlTags(text) {
  return String(text || "").replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) =>
      String.fromCodePoint(Number.parseInt(value, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
