import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCaptionXml,
  readInitialDataFromHtml,
  readPlayerResponseFromHtml,
  readYtcfgFromHtml,
  safeParseJsonText
} from "../src/transcript-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadFixture(name) {
  return readFile(path.join(__dirname, "fixtures", name), "utf8");
}

async function main() {
  const inlineHtml = await loadFixture("youtube-inline-player-response.html");
  const inlineResponse = readPlayerResponseFromHtml(inlineHtml);
  assert.ok(inlineResponse?.captions, "inline fixture should produce captions");
  assert.equal(
    inlineResponse.captions.playerCaptionsTracklistRenderer.captionTracks[0].languageCode,
    "en"
  );

  const escapedHtml = await loadFixture("youtube-escaped-player-response.html");
  const escapedResponse = readPlayerResponseFromHtml(escapedHtml);
  assert.ok(escapedResponse?.captions, "escaped fixture should produce captions");
  assert.match(
    escapedResponse.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl,
    /timedtext/
  );

  const initialData = readInitialDataFromHtml(`
    <!doctype html>
    <html><body><script>
      var ytInitialData = {"engagementPanels":[{"engagementPanelSectionListRenderer":{"panelIdentifier":"engagement-panel-searchable-transcript"}}]};
    </script></body></html>
  `);
  assert.equal(
    initialData?.engagementPanels?.[0]?.engagementPanelSectionListRenderer?.panelIdentifier,
    "engagement-panel-searchable-transcript"
  );

  const ytcfg = readYtcfgFromHtml(`
    <!doctype html>
    <html><body><script>
      ytcfg.set({"INNERTUBE_API_KEY":"test-key"});
      ytcfg.set({"INNERTUBE_CONTEXT":{"client":{"clientName":"WEB","clientVersion":"1.2.3"}}});
    </script></body></html>
  `);
  assert.equal(ytcfg?.INNERTUBE_API_KEY, "test-key");
  assert.equal(ytcfg?.INNERTUBE_CONTEXT?.client?.clientVersion, "1.2.3");

  const wrappedJson = safeParseJsonText(")]}'\\n{\"events\":[{\"tStartMs\":0}]}");
  assert.ok(wrappedJson?.events, "wrapped caption JSON should parse");

  const emptyJson = safeParseJsonText("");
  assert.equal(emptyJson, null);

  const xmlCaptions = parseCaptionXml(`
    <?xml version="1.0" encoding="utf-8" ?>
    <transcript>
      <text start="1.25" dur="2.5">Linear &amp; Algebra</text>
      <text start="4.0" dur="1.0">Vectors&lt;br&gt;and spaces</text>
    </transcript>
  `);
  assert.equal(xmlCaptions?.length, 2);
  assert.deepEqual(xmlCaptions?.[0], {
    startMs: 1250,
    durationMs: 2500,
    text: "Linear & Algebra"
  });
  assert.deepEqual(xmlCaptions?.[1], {
    startMs: 4000,
    durationMs: 1000,
    text: "Vectors<br>and spaces"
  });

  console.log("transcript-utils fixtures passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
