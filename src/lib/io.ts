import { ImportResult, SubnauticaRunConfig } from "../types/model";
import { parseRunConfigOrThrow } from "./configSchema";
import { exportToLss, importFromLss } from "./livesplit";
import { migrateConfig } from "./migrations";

export function exportToJson(config: SubnauticaRunConfig): string {
  return JSON.stringify(config, null, 2);
}

export function importFromJson(raw: string): ImportResult {
  const parsed = JSON.parse(raw) as unknown;
  return migrateConfig(parsed);
}

export function exportLss(config: SubnauticaRunConfig): string {
  const parsed = parseRunConfigOrThrow(config);
  return exportToLss(parsed);
}

export function importLss(raw: string): ImportResult {
  const imported = importFromLss(raw);
  return {
    ...imported,
    config: parseRunConfigOrThrow(imported.config)
  };
}

export function buildSuggestedFilename(config: SubnauticaRunConfig): string {
  const preferredOrder = ["Game Mode", "Run Type"];
  const variableMap = config.metadata.variables ?? {};
  const variableKeys = Object.keys(variableMap);
  const orderedKeys = [
    ...preferredOrder.filter((key) => typeof variableMap[key] === "string" && variableMap[key]),
    ...variableKeys.filter((key) => !preferredOrder.includes(key))
  ];
  const orderedValues = orderedKeys
    .map((key) => variableMap[key]?.trim())
    .filter((value): value is string => Boolean(value));

  const middle = [config.metadata.categoryName, ...orderedValues]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  const rawName = `${config.metadata.gameName} - ${middle || "Splits"}`;
  const safeName = rawName
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${safeName}.lss`;
}

export function resolveLssFilename(
  customFilename: string | undefined,
  fallbackFilename: string
): string {
  const fallbackBase = fallbackFilename.replace(/\.lss$/i, "");
  const raw = (customFilename ?? "").trim();
  const baseCandidate = raw || fallbackBase;
  const noExt = baseCandidate.replace(/\.lss$/i, "");
  const safe = noExt
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const finalBase = safe || fallbackBase;
  return `${finalBase}.lss`;
}
