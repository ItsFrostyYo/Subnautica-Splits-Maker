import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { useAppStore } from "./store/useAppStore";
import { buildShareUrl, decodeShareConfig, getShareParam } from "./lib/share";
import { downloadTextFile, readTextFile } from "./lib/file";
import {
  buildSuggestedFilename,
  exportLss,
  exportToJson,
  importFromJson,
  importLss,
  resolveLssFilename
} from "./lib/io";
import { parseRunConfigOrThrow } from "./lib/configSchema";
import { migrateConfig } from "./lib/migrations";
import { SplitTreeEditor } from "./components/SplitTreeEditor";
import { SplitInspector } from "./components/SplitInspector";
import { RunSettingsPanel } from "./components/RunSettingsPanel";
import { WarningsPanel } from "./components/WarningsPanel";

function useAutosave(configRaw: unknown): void {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem("subnautica-splits-maker:autosave", JSON.stringify(configRaw));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [configRaw]);
}

const backgroundModules = import.meta.glob(
  "./Backgrounds/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;
const backgroundModulesLower = import.meta.glob(
  "./backgrounds/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;
const backgroundModulesRoot = import.meta.glob(
  "../Backgrounds/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;
const backgroundModulesRootLower = import.meta.glob(
  "../backgrounds/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;
const backgroundModulesRootTypo = import.meta.glob(
  "../backgrouds/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;
const ENABLE_RANDOM_BACKGROUNDS = false;

export default function App() {
  const [activeOutputTab, setActiveOutputTab] = useState<"lss" | "json">("lss");
  const [copyStatus, setCopyStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [downloadFilenameOverride, setDownloadFilenameOverride] = useState("");
  const lssImportRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const randomBackground = useMemo(() => {
    const mergedBackgrounds = [
      ...Object.values(backgroundModules),
      ...Object.values(backgroundModulesLower),
      ...Object.values(backgroundModulesRoot),
      ...Object.values(backgroundModulesRootLower),
      ...Object.values(backgroundModulesRootTypo)
    ];

    const deduped = [...new Set(mergedBackgrounds)].sort();
    if (deduped.length === 0) {
      return "";
    }
    if (ENABLE_RANDOM_BACKGROUNDS) {
      const index = Math.floor(Math.random() * deduped.length);
      return deduped[index] ?? "";
    }
    return deduped[0] ?? "";
  }, []);

  const randomBackgroundStyle = useMemo(() => {
    if (!randomBackground) {
      return undefined;
    }
    return { backgroundImage: `url("${randomBackground}")` };
  }, [randomBackground]);

  const config = useAppStore((state) => state.config);
  const warnings = useAppStore((state) => state.warnings);
  const setConfig = useAppStore((state) => state.setConfig);
  const setPresetId = useAppStore((state) => state.setPresetId);
  const setWarnings = useAppStore((state) => state.setWarnings);
  const setGeneratedOutputs = useAppStore((state) => state.setGeneratedOutputs);
  const generatedLss = useAppStore((state) => state.lastGeneratedLss);
  const generatedJson = useAppStore((state) => state.lastGeneratedJson);
  const defaultDownloadFilename = useMemo(() => buildSuggestedFilename(config), [config]);
  const downloadFilenameInput = downloadFilenameOverride || defaultDownloadFilename;

  useAutosave(config);

  useEffect(() => {
    const shareValue = getShareParam();
    if (shareValue) {
      try {
        const shared = decodeShareConfig(shareValue);
        const migrated = migrateConfig(shared);
        setConfig(migrated.config, migrated.warnings);
        setPresetId("");
        setImportStatus("Loaded shared configuration from URL.");
        return;
      } catch (error) {
        setImportStatus(`Failed to load shared config: ${(error as Error).message}`);
      }
    }

    const raw = localStorage.getItem("subnautica-splits-maker:autosave");
    if (!raw) {
      return;
    }

    try {
      const migrated = migrateConfig(JSON.parse(raw));
      setConfig(migrated.config, migrated.warnings);
      setPresetId("");
      setImportStatus("Restored autosaved draft.");
    } catch {
      setImportStatus("Ignored corrupted autosave and loaded defaults.");
    }
  }, [setConfig, setPresetId]);

  useEffect(() => {
    try {
      const parsed = parseRunConfigOrThrow(config);
      const lss = exportLss(parsed);
      const json = exportToJson(parsed);
      setGeneratedOutputs(lss, json);
    } catch (error) {
      setWarnings([
        {
          code: "invalid-xml-shape",
          message: `Failed to generate output: ${(error as Error).message}`
        }
      ]);
    }
  }, [config, setGeneratedOutputs, setWarnings]);

  const onShareClick = async () => {
    try {
      const url = buildShareUrl(config);
      await navigator.clipboard.writeText(url);
      setCopyStatus("Share URL copied to clipboard.");
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Failed to copy share URL.");
    }
  };

  const onDownloadLss = () => {
    const filename = resolveLssFilename(downloadFilenameOverride, defaultDownloadFilename);
    downloadTextFile(filename, generatedLss, "application/xml");
  };

  const onDownloadJson = () => {
    downloadTextFile("subnautica-splits-config.json", generatedJson, "application/json");
  };

  const onImportLss = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await readTextFile(file);
      const result = importLss(text);
      setConfig(result.config, result.warnings);
      setPresetId("");
      setImportStatus(`Imported ${file.name}`);
    } catch (error) {
      setImportStatus(`Failed to import ${file.name}: ${(error as Error).message}`);
    } finally {
      event.target.value = "";
    }
  };

  const onImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await readTextFile(file);
      const result = importFromJson(text);
      setConfig(result.config, result.warnings);
      setPresetId("");
      setImportStatus(`Imported ${file.name}`);
    } catch (error) {
      setImportStatus(`Failed to import ${file.name}: ${(error as Error).message}`);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="app-root">
      <div className="random-bg" aria-hidden style={randomBackgroundStyle} />
      <div className="ocean-bg" aria-hidden />

      <main className="workspace">
        <section className="workspace-col left-col">
          <RunSettingsPanel />
          <WarningsPanel warnings={warnings} />
        </section>
        <section className="workspace-col wide center-col">
          <SplitTreeEditor
            downloadFilename={downloadFilenameInput}
            defaultDownloadFilename={defaultDownloadFilename}
            onDownloadFilenameChange={setDownloadFilenameOverride}
          />
        </section>
        <section className="workspace-col right-col">
          <SplitInspector />
          <div className="glass-panel io-panel">
            <div className="action-row">
              <button type="button" onClick={onDownloadLss}>
                Download Splits
              </button>
              <button type="button" onClick={() => lssImportRef.current?.click()}>
                Import Splits
              </button>
              <button type="button" onClick={onShareClick}>
                Copy Share URL
              </button>
            </div>
            <div className="action-row secondary">
              <button type="button" onClick={onDownloadJson}>
                Download JSON
              </button>
              <button type="button" onClick={() => jsonImportRef.current?.click()}>
                Import JSON
              </button>
            </div>
            {(copyStatus || importStatus) && (
              <div className="status-line">
                {copyStatus && <span>{copyStatus}</span>}
                {importStatus && <span>{importStatus}</span>}
              </div>
            )}
          </div>
          <div className="glass-panel output-panel">
            <div className="output-tabs">
              <button
                className={activeOutputTab === "lss" ? "active" : ""}
                onClick={() => setActiveOutputTab("lss")}
                type="button"
              >
                LSS XML
              </button>
              <button
                className={activeOutputTab === "json" ? "active" : ""}
                onClick={() => setActiveOutputTab("json")}
                type="button"
              >
                JSON
              </button>
            </div>
            <textarea
              readOnly
              value={activeOutputTab === "lss" ? generatedLss : generatedJson}
              spellCheck={false}
            />
          </div>
        </section>
      </main>

      <input
        ref={lssImportRef}
        className="hidden-input"
        type="file"
        accept=".lss,.xml"
        onChange={onImportLss}
      />
      <input
        ref={jsonImportRef}
        className="hidden-input"
        type="file"
        accept=".json"
        onChange={onImportJson}
      />
    </div>
  );
}
