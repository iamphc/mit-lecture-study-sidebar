import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const packageDir = path.join(distDir, "mit-lecture-study-sidebar");

async function main() {
  await ensureExists(path.join(rootDir, "manifest.json"));
  await ensureExists(path.join(rootDir, "src"));

  await rm(distDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  await cp(path.join(rootDir, "manifest.json"), path.join(packageDir, "manifest.json"));
  await cp(path.join(rootDir, "src"), path.join(packageDir, "src"), { recursive: true });
  await cp(path.join(rootDir, "test", "harness"), path.join(packageDir, "test", "harness"), {
    recursive: true
  });

  const manifest = JSON.parse(await readFile(path.join(rootDir, "manifest.json"), "utf8"));
  const packageMeta = {
    name: manifest.name,
    version: manifest.version,
    packagedAt: new Date().toISOString()
  };
  await writeFile(
    path.join(packageDir, "package-meta.json"),
    `${JSON.stringify(packageMeta, null, 2)}\n`
  );

  console.log(`Extension packaged at ${packageDir}`);
}

async function ensureExists(targetPath) {
  await stat(targetPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
