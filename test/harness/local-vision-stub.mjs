export async function detectPptKeyFrame() {
  return {
    shouldAnalyze: true,
    score: 0.92,
    visualType: "ppt",
    visualTypeLabel: "PPT",
    region: { name: "full" },
    typeScores: [{ visualType: "ppt", label: "PPT", score: 0.92 }],
    candidateScores: [{ name: "full", score: 0.92 }]
  };
}

export async function extractRawPptInfo({ frame }) {
  return {
    shouldKeep: true,
    source: "test-stub",
    extractionStage: "stub",
    seconds: frame.seconds,
    timestamp: frame.timestamp,
    rawVisibleText: "CPU Instructions",
    visibleText: ["CPU Instructions"],
    visualType: "ppt",
    visualTypeLabel: "PPT",
    ocrConfidence: 0.9,
    ocrModel: "stub",
    ocrTask: "test",
    keyFrame: {
      score: 0.92,
      visualType: "ppt",
      visualTypeLabel: "PPT",
      region: { name: "full" },
      typeScores: [{ visualType: "ppt", label: "PPT", score: 0.92 }],
      candidateScores: [{ name: "full", score: 0.92 }]
    }
  };
}

export async function debugBuildOcrCandidateImages(_frame, { keyFrame } = {}) {
  return {
    source: {
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5o6X7sAAAAABJRU5ErkJggg=="
    },
    keyFrame
  };
}
