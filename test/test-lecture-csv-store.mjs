import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseCsv,
  stringifyCsv,
  upsertLectureCsvRecord
} from "../scripts/lecture-csv-store.mjs";

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

async function main() {
  await testCsvRoundTrip();
  await testUpsertByVideoId();
  console.log("lecture csv store tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
