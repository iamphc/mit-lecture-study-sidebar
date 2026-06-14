import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseCsv,
  stringifyCsv,
  upsertLectureCsvRecord
} from "../scripts/lecture-csv-store.mjs";
import { saveVisualDebugSnapshot } from "../scripts/lecture-csv-server.mjs";
import {
  buildLocalLectureFiles,
  prepareLocalLectureRecord,
  upsertCsvRecord
} from "../src/local-save-utils.mjs";

const ONE_PIXEL_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

async function testCsvRoundTrip() {
  const rows = [
    {
      video_id: "abc",
      video_title: "标题, 带逗号",
      tags: '操作系统; 指令集',
      tags_json: JSON.stringify([{ label: '含"引号"标签' }]),
      transcript_text: "第一行\n第二行",
      visual_analysis_json: JSON.stringify([{ title: "PPT 画面" }]),
      outline_json: JSON.stringify([{ heading: '含"引号"' }])
    }
  ];

  const parsed = parseCsv(stringifyCsv(rows));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].video_id, "abc");
  assert.equal(parsed[0].video_title, "标题, 带逗号");
  assert.equal(parsed[0].tags, "操作系统; 指令集");
  assert.equal(JSON.parse(parsed[0].tags_json)[0].label, '含"引号"标签');
  assert.equal(parsed[0].transcript_text, "第一行\n第二行");
  assert.equal(JSON.parse(parsed[0].visual_analysis_json)[0].title, "PPT 画面");
  assert.equal(JSON.parse(parsed[0].outline_json)[0].heading, '含"引号"');
}

async function testUpsertByVideoId() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lecture-csv-"));
  const csvPath = path.join(tmpDir, "lecture_library.csv");

  try {
    await upsertLectureCsvRecord(
      {
        video_id: "same-video",
        video_title: "旧标题",
        transcript_text: "old"
      },
      csvPath
    );
    await upsertLectureCsvRecord(
      {
        video_id: "same-video",
        video_title: "新标题",
        transcript_text: "new"
      },
      csvPath
    );

    const parsed = parseCsv(await readFile(csvPath, "utf8"));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].video_id, "same-video");
    assert.equal(parsed[0].video_title, "新标题");
    assert.equal(parsed[0].transcript_text, "new");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function testSaveVisualDebugSnapshot() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lecture-visual-debug-"));

  try {
    const result = await saveVisualDebugSnapshot({
      saveDir: tmpDir,
      videoId: "abc123",
      videoTitle: "MIT Smoke",
      videoUrl: "https://www.youtube.com/watch?v=abc123",
      timestamp: "00:15",
      seconds: 15,
      savedAt: "2026-06-14T00:00:00.000Z",
      framePreview: ONE_PIXEL_JPEG,
      ocrRegionPreview: ONE_PIXEL_JPEG,
      rawVisibleText: "CPU Instructions",
      analysis: { title: "CPU 指令" },
      keyFrame: { score: 0.9 },
      transcriptContext: [{ startMs: 1000, text: "context" }]
    });

    const files = await readdir(path.dirname(result.jsonPath));
    assert(files.some((file) => file.endsWith(".json")));
    assert(files.some((file) => file.endsWith("-frame.jpg")));
    assert(files.some((file) => file.endsWith("-ocr.jpg")));
    const json = JSON.parse(await readFile(result.jsonPath, "utf8"));
    assert.equal(json.video_id, "abc123");
    assert.equal(json.raw_visible_text, "CPU Instructions");
    assert.equal(json.analysis.title, "CPU 指令");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function testBrowserLocalSaveUtils() {
  const prepared = prepareLocalLectureRecord({
    video_id: "video-001",
    video_title: "带图片",
    visual_analysis_json: JSON.stringify([
      {
        title: "板书",
        seconds: 15,
        framePreview: ONE_PIXEL_JPEG,
        ocrRegionPreview: ONE_PIXEL_JPEG
      }
    ])
  });
  const preparedVisual = JSON.parse(prepared.record.visual_analysis_json);
  assert.equal(prepared.imageAssets.length, 2);
  assert.equal(prepared.imageAssets[0].fileName, "000015-01-frame.jpg");
  assert.equal(prepared.imageAssets[1].fileName, "000015-01-ocr.jpg");
  assert.equal(preparedVisual[0].framePreview, undefined);
  assert.equal(preparedVisual[0].ocrRegionPreview, undefined);
  assert.equal(preparedVisual[0].framePreviewPath, "images/000015-01-frame.jpg");
  assert.equal(preparedVisual[0].ocrRegionPreviewPath, "images/000015-01-ocr.jpg");

  const first = upsertCsvRecord("", {
    video_id: "video-001",
    video_title: "第一版",
    transcript_json: JSON.stringify([{ text: "line" }]),
    outline_json: JSON.stringify([{ heading: "大纲" }]),
    visual_analysis_json: JSON.stringify([{ title: "PPT" }]),
    study_pack_markdown: "# 第一版\n"
  });
  const second = upsertCsvRecord(first.csvText, {
    video_id: "video-001",
    video_title: "第二版",
    transcript_json: JSON.stringify([{ text: "line" }]),
    outline_json: JSON.stringify([{ heading: "大纲" }]),
    visual_analysis_json: JSON.stringify([{ title: "PPT" }]),
    study_pack_markdown: "# 第二版\n"
  });

  assert.equal(second.rowCount, 1);
  assert.match(second.csvText, /第二版/);
  assert.doesNotMatch(second.csvText, /第一版/);
  const compactCsv = upsertCsvRecord("", prepared.record);
  assert.doesNotMatch(compactCsv.csvText, /data:image\/jpeg;base64/);
  assert.match(compactCsv.csvText, /images\/000015-01-frame\.jpg/);

  const files = buildLocalLectureFiles({
    video_id: "video-001",
    video_title: "第二版",
    transcript_json: JSON.stringify([{ text: "line" }]),
    outline_json: JSON.stringify([{ heading: "大纲" }]),
    visual_analysis_json: JSON.stringify([{ title: "PPT" }]),
    study_pack_markdown: "# 第二版\n"
  });
  assert.equal(files.folderName, "video-001");
  assert.equal(files.markdownFileName, "study_pack.md");
  assert.match(files.markdownText, /第二版/);
  assert.equal(JSON.parse(files.jsonText).outline[0].heading, "大纲");
}

async function main() {
  await testCsvRoundTrip();
  await testUpsertByVideoId();
  await testSaveVisualDebugSnapshot();
  testBrowserLocalSaveUtils();
  console.log("lecture csv store tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
