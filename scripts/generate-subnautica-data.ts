import fs from "node:fs";
import path from "node:path";
import {
  generateArtifacts,
  GeneratedArtifacts,
  resolveProjectPaths
} from "./generator-lib";

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isGeneratedArtifacts(value: unknown): value is GeneratedArtifacts {
  const record = value as Record<string, unknown>;
  return Boolean(
    record &&
      Array.isArray(record.splitDefinitions) &&
      Array.isArray(record.biome) &&
      Array.isArray(record.craftable) &&
      Array.isArray(record.inventory) &&
      Array.isArray(record.unlockable) &&
      Array.isArray(record.encyclopedia)
  );
}

function loadArtifactsFromSnapshot(snapshotPath: string): GeneratedArtifacts {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot data not found: ${snapshotPath}`);
  }
  const raw = fs.readFileSync(snapshotPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as unknown;
  if (!isGeneratedArtifacts(parsed)) {
    throw new Error(`Snapshot data has invalid shape: ${snapshotPath}`);
  }
  return parsed;
}

function main(): void {
  const { autosplitterRoot, snapshotPath, generatedDir } = resolveProjectPaths();

  ensureDir(generatedDir);
  const artifacts = fs.existsSync(autosplitterRoot)
    ? generateArtifacts(autosplitterRoot)
    : loadArtifactsFromSnapshot(snapshotPath);

  writeJson(path.join(generatedDir, "split-definitions.json"), artifacts.splitDefinitions);
  writeJson(path.join(generatedDir, "enum-biome.json"), artifacts.biome);
  writeJson(path.join(generatedDir, "enum-craftable.json"), artifacts.craftable);
  writeJson(path.join(generatedDir, "enum-inventory.json"), artifacts.inventory);
  writeJson(path.join(generatedDir, "enum-unlockable.json"), artifacts.unlockable);
  writeJson(path.join(generatedDir, "enum-ency.json"), artifacts.encyclopedia);

  // eslint-disable-next-line no-console
  console.log(
    fs.existsSync(autosplitterRoot)
      ? "Generated Subnautica data artifacts from local autosplitter source."
      : "Generated Subnautica data artifacts from in-repo snapshot."
  );
}

main();
