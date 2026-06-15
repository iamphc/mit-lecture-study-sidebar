import assert from "node:assert/strict";
import { detectPptKeyFrame } from "../src/local-vision.js";

class MockCanvas {
  constructor(width, height, dataFactory) {
    this.width = width;
    this.height = height;
    this.dataFactory = dataFactory;
  }

  getContext() {
    const owner = this;
    return {
      drawImage(source) {
        if (source instanceof MockCanvas) {
          owner.dataFactory = source.dataFactory;
        }
      },
      fillRect: () => {},
      getImageData: (_x, _y, width, height) => ({
        data: this.dataFactory(width, height)
      })
    };
  }
}

globalThis.HTMLCanvasElement = MockCanvas;
globalThis.document = {
  createElement(tagName) {
    assert.equal(tagName, "canvas");
    return new MockCanvas(1, 1, (width, height) =>
      makePixelData(width, height, () => [255, 255, 255])
    );
  }
};

function makePixelData(width, height, pixelFactory) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelFactory(x, y, width, height);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }
  return data;
}

function createBlackboardCanvas() {
  return new MockCanvas(640, 360, (width, height) =>
    makePixelData(width, height, (x, y) => {
      const isChalkLine =
        (y > height * 0.18 && y < height * 0.22 && x > width * 0.12 && x < width * 0.82) ||
        (y > height * 0.35 && y < height * 0.4 && x > width * 0.18 && x < width * 0.74) ||
        (y > height * 0.58 && y < height * 0.63 && x > width * 0.08 && x < width * 0.64) ||
        (x > width * 0.48 && x < width * 0.5 && y > height * 0.12 && y < height * 0.82);
      return isChalkLine ? [225, 225, 215] : [28, 44, 42];
    })
  );
}

function createSlideCanvas() {
  return new MockCanvas(640, 360, (width, height) =>
    makePixelData(width, height, (x, y) => {
      const isTitle = y > height * 0.08 && y < height * 0.16 && x > width * 0.08 && x < width * 0.88;
      const isRule = y > height * 0.2 && y < height * 0.215 && x > width * 0.08 && x < width * 0.92;
      const isBox =
        x > width * 0.08 &&
        x < width * 0.92 &&
        y > height * 0.25 &&
        y < height * 0.84 &&
        (Math.abs(x - width * 0.08) < 4 ||
          Math.abs(x - width * 0.92) < 4 ||
          Math.abs(y - height * 0.25) < 4 ||
          Math.abs(y - height * 0.84) < 4);
      const isTextLine =
        (y > height * 0.18 && y < height * 0.22 && x > width * 0.12 && x < width * 0.78) ||
        (y > height * 0.36 && y < height * 0.39 && x > width * 0.15 && x < width * 0.7) ||
        (y > height * 0.54 && y < height * 0.57 && x > width * 0.2 && x < width * 0.62);
      return isTitle || isRule || isBox || isTextLine ? [24, 36, 52] : [238, 241, 246];
    })
  );
}

function testClassifiesBlackboard() {
  const result = detectPptKeyFrame({
    canvas: createBlackboardCanvas(),
    seconds: 49,
    timestamp: "00:49"
  });

  assert.equal(result.visualType, "blackboard");
  assert.equal(result.visualTypeLabel, "板书");
  assert.equal(result.shouldAnalyze, true);
  assert.ok(result.typeScores.some((entry) => entry.visualType === "blackboard"));
}

function testClassifiesSlide() {
  const result = detectPptKeyFrame({
    canvas: createSlideCanvas(),
    seconds: 120,
    timestamp: "02:00"
  });

  assert.equal(result.visualType, "ppt");
  assert.equal(result.visualTypeLabel, "PPT");
  assert.equal(result.shouldAnalyze, true);
  assert.ok(result.typeScores.some((entry) => entry.visualType === "ppt"));
}

function testEnglishVisualLabels() {
  const result = detectPptKeyFrame(
    {
      canvas: createBlackboardCanvas(),
      seconds: 49,
      timestamp: "00:49"
    },
    { language: "en" }
  );

  assert.equal(result.visualType, "blackboard");
  assert.equal(result.visualTypeLabel, "Blackboard");
  assert.ok(result.reasons.some((reason) => /blackboard/i.test(reason)));
}

testClassifiesBlackboard();
testClassifiesSlide();
testEnglishVisualLabels();
console.log("local vision classification tests passed");
