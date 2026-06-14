import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mustExist(relativePath) {
  await access(path.join(__dirname, relativePath));
}

async function mustContain(relativePath, pattern) {
  const text = await readFile(path.join(__dirname, relativePath), "utf8");
  assert.match(text, pattern);
}

async function main() {
  await mustExist("harness/mock-chrome.js");
  await mustExist("harness/popup-harness.html");
  await mustExist("harness/options-harness.html");
  await mustExist("harness/sidebar-harness.html");

  await mustContain("harness/sidebar-harness.html", /MIT Sidebar Harness Lecture/);
  await mustContain("harness/mock-chrome.js", /RUN_DEEPSEEK_ANALYSIS/);

  console.log("harness file checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
