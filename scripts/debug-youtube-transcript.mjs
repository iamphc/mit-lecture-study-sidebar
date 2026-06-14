import {
  parseCaptionXml,
  readInitialDataFromHtml,
  readPlayerResponseFromHtml,
  readYtcfgFromHtml,
  safeParseJsonText
} from "../src/transcript-utils.mjs";
import { readFile } from "node:fs/promises";

const DEFAULT_VIDEO = "7UJ4CFRGd-U";
const WATCH_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};
const INNERTUBE_ANDROID_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "20.10.38",
  userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
  osName: "Android",
  osVersion: "11"
};

function mainArgs() {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      args.set(key, value ?? process.argv[index + 1] ?? "");
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (!args.has("video")) {
      args.set("video", arg);
    }
  }
  return args;
}

async function main() {
  const args = mainArgs();
  const videoId = extractVideoId(args.get("video") || DEFAULT_VIDEO);
  const lang = args.get("lang") || "en";
  const cookie = args.get("cookie") || process.env.YOUTUBE_COOKIE || "";
  const htmlPath = args.get("html") || "";

  if (!videoId) {
    throw new Error("Provide a YouTube video URL or ID.");
  }

  const result = await debugTranscript({ videoId, lang, cookie, htmlPath });
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exitCode = 1;
  }
}

async function debugTranscript({ videoId, lang, cookie, htmlPath }) {
  const steps = [];
  const headers = cookie ? { ...WATCH_HEADERS, cookie } : WATCH_HEADERS;
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const watch = htmlPath
    ? await readHtmlFile(htmlPath)
    : await fetchText(watchUrl, { headers });
  steps.push(summarizeHttpStep("watch-html", watch));

  if (!watch.ok) {
    return {
      success: false,
      videoId,
      lang,
      steps,
      error: `watch page failed with HTTP ${watch.status}`
    };
  }

  const html = watch.body;
  const ytcfg = readYtcfgFromHtml(html);
  const playerResponseFromHtml = readPlayerResponseFromHtml(html);
  const initialData = readInitialDataFromHtml(html);
  steps.push({
    name: "parse-watch-html",
    ok: true,
    hasYtcfg: Boolean(ytcfg),
    hasApiKey: Boolean(ytcfg?.INNERTUBE_API_KEY),
    hasContext: Boolean(ytcfg?.INNERTUBE_CONTEXT),
    hasPlayerResponse: Boolean(playerResponseFromHtml),
    htmlCaptionTracks: countCaptionTracks(playerResponseFromHtml),
    hasInitialData: Boolean(initialData)
  });

  const transcriptFromInitialData = extractTranscriptEntriesFromNode(initialData);
  if (transcriptFromInitialData.length) {
    return successResult({
      videoId,
      lang,
      source: "ytInitialData",
      steps,
      transcript: normalizeTranscriptEntries(transcriptFromInitialData)
    });
  }

  const transcriptParams = findTranscriptParams(initialData);
  steps.push({
    name: "find-get-transcript-params",
    ok: Boolean(transcriptParams),
    paramsLength: transcriptParams.length
  });

  if (transcriptParams && ytcfg?.INNERTUBE_API_KEY && ytcfg?.INNERTUBE_CONTEXT) {
    const transcriptApi = await postJson(
      `https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(
        ytcfg.INNERTUBE_API_KEY
      )}`,
      {
        context: ytcfg.INNERTUBE_CONTEXT,
        params: transcriptParams
      },
      { headers }
    );
    steps.push(summarizeHttpStep("youtubei-get-transcript", transcriptApi));
    if (transcriptApi.ok) {
      const payload = safeParseJsonText(transcriptApi.body);
      const entries = extractTranscriptEntriesFromNode(payload);
      steps.push({
        name: "parse-get-transcript",
        ok: Boolean(entries.length),
        eventCount: entries.length
      });
      if (entries.length) {
        return successResult({
          videoId,
          lang,
          source: "youtubei/get_transcript",
          steps,
          transcript: normalizeTranscriptEntries(entries)
        });
      }
    }
  }

  const htmlTracks =
    playerResponseFromHtml?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const htmlTrackResult = await tryCaptionTracks({
    tracks: htmlTracks,
    lang,
    headers,
    steps,
    source: "watch-html-captionTracks"
  });
  if (htmlTrackResult) {
    return successResult({
      videoId,
      lang,
      source: htmlTrackResult.source,
      steps,
      transcript: htmlTrackResult.transcript
    });
  }

  const playerApi = await postJson(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      context: buildInnertubePlayerContext(ytcfg?.INNERTUBE_CONTEXT),
      videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: "HTML5_PREF_WANTS",
          signatureTimestamp: 0
        }
      },
      contentCheckOk: true,
      racyCheckOk: true
    },
    {
      headers: {
        ...headers,
        "x-youtube-client-name": "3",
        "x-youtube-client-version": INNERTUBE_ANDROID_CLIENT.clientVersion
      }
    }
  );
  steps.push(summarizeHttpStep("youtubei-android-player", playerApi));
  if (playerApi.ok) {
    const payload = safeParseJsonText(playerApi.body);
    const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    steps.push({
      name: "parse-youtubei-android-player",
      ok: Boolean(tracks.length),
      trackCount: tracks.length,
      playabilityStatus: payload?.playabilityStatus?.status || "",
      playabilityReason: payload?.playabilityStatus?.reason || ""
    });
    const playerTrackResult = await tryCaptionTracks({
      tracks,
      lang,
      headers: {
        ...headers,
        "user-agent": INNERTUBE_ANDROID_CLIENT.userAgent
      },
      steps,
      source: "youtubei-android-player-captionTracks"
    });
    if (playerTrackResult) {
      return successResult({
        videoId,
        lang,
        source: playerTrackResult.source,
        steps,
        transcript: playerTrackResult.transcript
      });
    }
  }

  return {
    success: false,
    videoId,
    lang,
    steps,
    error: "No transcript source returned usable caption text."
  };
}

async function readHtmlFile(path) {
  try {
    const body = await readFile(path, "utf8");
    return {
      ok: true,
      status: 200,
      url: path,
      contentType: "text/html; local-file",
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: path,
      contentType: "",
      body: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function tryCaptionTracks({ tracks, lang, headers, steps, source }) {
  steps.push({
    name: `${source}-tracks`,
    ok: Boolean(tracks.length),
    trackCount: tracks.length,
    tracks: tracks.slice(0, 5).map(summarizeCaptionTrack)
  });

  for (const [index, attempt] of buildCaptionAttemptQueue(tracks, lang).entries()) {
    const response = await fetchText(attempt.requestUrl, { headers });
    steps.push({
      ...summarizeHttpStep(`${source}-timedtext-${index + 1}-${attempt.label}`, response),
      track: summarizeCaptionTrack(attempt.track),
      requestUrl: redactUrl(attempt.requestUrl)
    });

    if (!response.ok) {
      continue;
    }

    const parsed = parseCaptionPayload(response.body);
    steps.push({
      name: `${source}-parse-${index + 1}`,
      ok: Boolean(parsed.entries.length),
      parseMode: parsed.mode,
      eventCount: parsed.entries.length
    });

    if (parsed.entries.length) {
      return {
        source,
        transcript: normalizeTranscriptEntries(parsed.entries)
      };
    }
  }

  return null;
}

function parseCaptionPayload(text) {
  const json = safeParseJsonText(text);
  if (json?.events) {
    return {
      mode: "json3",
      entries: normalizeTranscriptPayload(json.events)
    };
  }

  const xml = parseCaptionXml(text);
  if (xml?.length) {
    return {
      mode: "xml",
      entries: xml
    };
  }

  return {
    mode: text ? "unrecognized" : "empty",
    entries: []
  };
}

async function fetchText(url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "follow"
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type") || "",
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      contentType: "",
      body: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function postJson(url, payload, init = {}) {
  return fetchText(url, {
    ...init,
    method: "POST",
    headers: {
      ...(init.headers || {}),
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function summarizeHttpStep(name, response) {
  return {
    name,
    ok: Boolean(response.ok),
    status: response.status,
    contentType: response.contentType,
    bodyLength: response.body.length,
    bodyPreview: response.body.slice(0, 160),
    error: response.error || "",
    url: redactUrl(response.url)
  };
}

function successResult({ videoId, lang, source, steps, transcript }) {
  return {
    success: true,
    videoId,
    lang,
    source,
    lineCount: transcript.length,
    preview: transcript.slice(0, 5),
    steps
  };
}

function extractVideoId(input) {
  const value = String(input || "").trim();
  if (/^[a-zA-Z0-9_-]{6,}$/.test(value) && !value.includes("/")) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    return url.searchParams.get("v") || "";
  } catch (_error) {
    return "";
  }
}

function countCaptionTracks(playerResponse) {
  return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0;
}

function buildCaptionAttemptQueue(tracks, preferredLang) {
  return rankCaptionTracks(tracks, preferredLang).flatMap((track) => {
    if (!track?.baseUrl) {
      return [];
    }

    return dedupeAttempts([
      ["json3", withCaptionFormat(track.baseUrl, "json3")],
      ["srv3", withCaptionFormat(track.baseUrl, "srv3")],
      ["native", withoutCaptionFormat(track.baseUrl)]
    ]).map(([label, requestUrl]) => ({ track, label, requestUrl }));
  });
}

function rankCaptionTracks(tracks, preferredLang) {
  return [...tracks].sort(
    (left, right) => scoreCaptionTrack(right, preferredLang) - scoreCaptionTrack(left, preferredLang)
  );
}

function scoreCaptionTrack(track, preferredLang) {
  const languageCode = track?.languageCode || "";
  const name = readRunsText(track?.name) || "";
  const kind = track?.kind || "";
  const baseUrl = track?.baseUrl || "";
  let score = 0;

  if (preferredLang && languageCode.toLowerCase().startsWith(preferredLang.toLowerCase())) {
    score += 120;
  }
  if (/en(-|$)/i.test(languageCode) || /english/i.test(name)) {
    score += 100;
  }
  if (!kind) {
    score += 40;
  }
  if (kind && !/asr/i.test(kind)) {
    score += 20;
  }
  if (/asr/i.test(kind)) {
    score -= 20;
  }
  if (/variant=gemini/i.test(baseUrl)) {
    score -= 80;
  }

  return score;
}

function withCaptionFormat(baseUrl, format) {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", format);
  return url.toString();
}

function withoutCaptionFormat(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.delete("fmt");
  return url.toString();
}

function dedupeAttempts(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry[1])) {
      return false;
    }
    seen.add(entry[1]);
    return true;
  });
}

function findTranscriptParams(initialData) {
  const holder = findFirstObject(
    initialData,
    (value) => typeof value?.continuationEndpoint?.getTranscriptEndpoint?.params === "string"
  );
  if (holder?.continuationEndpoint?.getTranscriptEndpoint?.params) {
    return holder.continuationEndpoint.getTranscriptEndpoint.params;
  }

  const directHolder = findFirstObject(
    initialData,
    (value) => typeof value?.getTranscriptEndpoint?.params === "string"
  );
  return directHolder?.getTranscriptEndpoint?.params || "";
}

function extractTranscriptEntriesFromNode(root) {
  const segmentRenderers = collectObjects(root, (value) => value?.transcriptSegmentRenderer).map(
    (value) => value.transcriptSegmentRenderer
  );

  return segmentRenderers
    .map((segment) => ({
      startMs: Number(segment.startMs || 0),
      durationMs:
        Number(segment.endMs || 0) > Number(segment.startMs || 0)
          ? Number(segment.endMs || 0) - Number(segment.startMs || 0)
          : 4000,
      text: readRunsText(segment.snippet) || readRunsText(segment.cue) || ""
    }))
    .filter((entry) => entry.text);
}

function normalizeTranscriptPayload(events) {
  return events
    .map((event) => {
      const text = (event.segs || [])
        .map((segment) => segment.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      return {
        startMs: Number(event.tStartMs || 0),
        durationMs: Number(event.dDurationMs || 0),
        text
      };
    })
    .filter((entry) => entry.text);
}

function normalizeTranscriptEntries(entries) {
  return entries
    .map((entry) => ({
      startMs: Number(entry.startMs || 0),
      durationMs: Number(entry.durationMs || 0) || 4000,
      text: String(entry.text || "")
        .replace(/\s+/g, " ")
        .trim()
    }))
    .filter((entry) => entry.text);
}

function buildInnertubePlayerContext(pageContext) {
  const pageClient = pageContext?.client || {};
  const client = {
    hl: pageClient.hl || "en",
    gl: pageClient.gl || "US",
    clientName: INNERTUBE_ANDROID_CLIENT.clientName,
    clientVersion: INNERTUBE_ANDROID_CLIENT.clientVersion,
    userAgent: INNERTUBE_ANDROID_CLIENT.userAgent,
    osName: INNERTUBE_ANDROID_CLIENT.osName,
    osVersion: INNERTUBE_ANDROID_CLIENT.osVersion
  };
  if (pageClient.visitorData) {
    client.visitorData = pageClient.visitorData;
  }

  return {
    ...pageContext,
    client
  };
}

function summarizeCaptionTrack(track) {
  return {
    languageCode: track?.languageCode || "",
    kind: track?.kind || "",
    name: readRunsText(track?.name),
    baseUrl: track?.baseUrl ? redactUrl(track.baseUrl) : ""
  };
}

function readRunsText(node) {
  if (!node) {
    return "";
  }
  if (typeof node.simpleText === "string") {
    return node.simpleText.trim();
  }
  if (Array.isArray(node.runs)) {
    return node.runs
      .map((run) => run?.text || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function findFirstObject(root, predicate) {
  const queue = [root];
  const seen = new Set();

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (predicate(value)) {
      return value;
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        queue.push(child);
      }
    }
  }

  return null;
}

function collectObjects(root, predicate) {
  const queue = [root];
  const seen = new Set();
  const results = [];

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (predicate(value)) {
      results.push(value);
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        queue.push(child);
      }
    }
  }

  return results;
}

function redactUrl(url) {
  if (!url) {
    return "";
  }
  try {
    const parsed = new URL(url);
    for (const key of ["key", "signature", "sig", "lsig"]) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "<redacted>");
      }
    }
    return parsed.toString();
  } catch (_error) {
    return String(url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
