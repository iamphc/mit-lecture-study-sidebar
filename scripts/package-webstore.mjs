import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const packageDir = path.join(distDir, "webstore", "mit-lecture-study-sidebar");

await ensureExists(path.join(rootDir, "manifest.json"));
await ensureExists(path.join(rootDir, "src"));
await ensureExists(path.join(rootDir, "_locales"));
await ensureExists(path.join(rootDir, "assets", "icons", "icon-128.png"));

const manifest = JSON.parse(await readFile(path.join(rootDir, "manifest.json"), "utf8"));
const zipPath = path.join(distDir, `mit-lecture-study-sidebar-v${manifest.version}.zip`);

await rm(path.dirname(packageDir), { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

await cp(path.join(rootDir, "manifest.json"), path.join(packageDir, "manifest.json"));
await cp(path.join(rootDir, "src"), path.join(packageDir, "src"), { recursive: true });
await cp(path.join(rootDir, "_locales"), path.join(packageDir, "_locales"), { recursive: true });
await cp(path.join(rootDir, "assets"), path.join(packageDir, "assets"), { recursive: true });

await rm(zipPath, { force: true });
await execFileAsync("zip", ["-qr", zipPath, "."], { cwd: packageDir });

console.log(`Chrome Web Store package created at ${zipPath}`);

async function ensureExists(targetPath) {
  await stat(targetPath);
}
