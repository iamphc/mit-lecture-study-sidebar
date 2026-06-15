import assert from "node:assert/strict";
import {
  chunkTranscript,
  hasMostlyEnglishOutline,
  isEnglishDominantText,
  mergePartialStudyPacks,
  normalizeRemoteStudyPack,
  normalizeVisualTextAnalysisResult,
  safeParseModelJson
} from "../src/background-utils.mjs";

function buildTranscript(count) {
  return Array.from({ length: count }, (_, index) => ({
    startMs: index * 1000,
    text: `Transcript line number ${index} with enough text to force chunking behavior`
  }));
}

function testChunkTranscript() {
  const transcript = buildTranscript(12);
  const chunks = chunkTranscript(transcript, 160);
  assert.ok(chunks.length > 1, "transcript should be split into multiple chunks");
  assert.equal(chunks.flat().length, transcript.length, "all transcript entries should be preserved");
}

function testSafeParseModelJson() {
  const direct = safeParseModelJson('{"summary":"ok"}');
  assert.equal(direct.summary, "ok");

  const wrapped = safeParseModelJson('```json\n{"summary":"wrapped"}\n```');
  assert.equal(wrapped.summary, "wrapped");

  assert.throws(
    () => safeParseModelJson('{"title":"坏 JSON","outline":[{"heading":"缺逗号" "timestamp":"00:00"}]}'),
    /模型返回的内容不是有效 JSON/
  );
}

function testNormalizeRemoteStudyPack() {
  const transcript = buildTranscript(2);
  const result = normalizeRemoteStudyPack(
    {
      title: "",
      outline: "bad",
      tags: [{ label: "指令集", category: "subtopic" }]
    },
    transcript,
    "Video"
  );
  assert.equal(result.title, "Video");
  assert.deepEqual(result.outline, []);
  assert.deepEqual(result.tags, []);
  assert.equal(result.transcript.length, 2);
}

function testNormalizeVisualTextAnalysisResult() {
  const result = normalizeVisualTextAnalysisResult(
    {
      title: "指令集概念",
      bullets: ["说明 CPU 指令和内存访问的关系。", "说明这页 PPT 是本段讲解的概念提示。"],
      relationToTranscript: "和老师正在讲的 CPU 指令一致。",
      tags: ["CPU", "指令集", "内存访问", "CPU"]
    },
    {
      timestamp: "00:12",
      seconds: 12,
      rawVisibleText: "CPU Instructions\nMemory Access",
      visibleText: ["CPU Instructions", "Memory Access"],
      visualType: "blackboard",
      keyFrame: {
        source: "local-keyframe-detector-v1",
        score: 0.8,
        visualType: "blackboard"
      }
    },
    "Video"
  );

  assert.equal(result.title, "指令集概念");
  assert.equal(result.timestamp, "00:12");
  assert.equal(result.rawVisibleText, "CPU Instructions\nMemory Access");
  assert.deepEqual(result.visibleText, ["CPU Instructions", "Memory Access"]);
  assert.equal(result.visualType, "blackboard");
  assert.deepEqual(result.tags, ["CPU", "指令集", "内存访问"]);
  assert.equal(result.localExtraction.keyFrame.score, 0.8);
}

function testEnglishVisualFallbackTitle() {
  const result = normalizeVisualTextAnalysisResult(
    {},
    {
      timestamp: "00:12",
      seconds: 12,
      rawVisibleText: "",
      visibleText: [],
      visualType: "blackboard"
    },
    "",
    "en"
  );

  assert.equal(result.title, "Blackboard key frame");
}

function testEnglishOutlineDetection() {
  assert.equal(isEnglishDominantText("Introduction and Course Overview"), true);
  assert.equal(isEnglishDominantText("课程介绍与整体安排"), false);
  assert.equal(
    hasMostlyEnglishOutline({
      title: "MIT Linear Algebra",
      outline: [
        {
          heading: "Introduction and Course Overview",
          bullets: [
            "First lecture of MIT Linear Algebra.",
            "Plan: solve systems of linear equations."
          ]
        }
      ]
    }),
    true
  );
  assert.equal(
    hasMostlyEnglishOutline({
      title: "线性代数第一讲",
      outline: [
        {
          heading: "课程介绍与整体安排",
          bullets: ["介绍课程目标。", "说明线性方程组是本节课的主线。"]
        }
      ]
    }),
    false
  );
}

function testMergePartialStudyPacks() {
  const result = mergePartialStudyPacks(
    [
      {
        title: "第一段标题",
        outline: [
          {
            timestamp: "10:00",
            seconds: 600,
            heading: "后面的内容",
            bullets: ["要点 B", "要点 B"]
          }
        ]
      },
      {
        title: "第二段标题",
        outline: [
          {
            timestamp: "00:30",
            seconds: 30,
            heading: "前面的内容",
            bullets: ["要点 A"]
          },
          {
            timestamp: "10:00",
            seconds: 600,
            heading: "后面的内容",
            bullets: ["重复项"]
          }
        ]
      }
    ],
    "视频标题"
  );

  assert.equal(result.title, "第一段标题");
  assert.deepEqual(
    result.outline.map((item) => item.heading),
    ["前面的内容", "后面的内容"]
  );
  assert.deepEqual(result.outline[1].bullets, ["要点 B"]);
}

function main() {
  testChunkTranscript();
  testSafeParseModelJson();
  testNormalizeRemoteStudyPack();
  testNormalizeVisualTextAnalysisResult();
  testEnglishVisualFallbackTitle();
  testEnglishOutlineDetection();
  testMergePartialStudyPacks();
  console.log("background-utils tests passed");
}

main();
