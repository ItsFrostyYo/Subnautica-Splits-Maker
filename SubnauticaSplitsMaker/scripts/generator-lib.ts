import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type GeneratedSplitDataKind =
  | "typed-none"
  | "typed-inventory"
  | "typed-blueprint"
  | "typed-encyclopedia"
  | "typed-biome"
  | "typed-craft"
  | "prefab";

export interface GeneratedSplitDefinition {
  id: string;
  description: string;
  tooltip: string;
  kind: GeneratedSplitDataKind;
}

export interface GeneratedEnumOption {
  id: string;
  label: string;
}

export interface GeneratedArtifacts {
  splitDefinitions: GeneratedSplitDefinition[];
  biome: GeneratedEnumOption[];
  craftable: GeneratedEnumOption[];
  inventory: GeneratedEnumOption[];
  unlockable: GeneratedEnumOption[];
  encyclopedia: GeneratedEnumOption[];
}

function removeCSharpComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function unescapeQuoted(raw: string): string {
  const normalized = raw
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"');
  return JSON.parse(`"${normalized}"`) as string;
}

function parseSplitKind(id: string): GeneratedSplitDataKind {
  if (id === "None") {
    return "typed-none";
  }
  switch (id) {
    case "Inventory":
      return "typed-inventory";
    case "Blueprint":
      return "typed-blueprint";
    case "Encyclopedia":
      return "typed-encyclopedia";
    case "Biome":
      return "typed-biome";
    case "Craft":
      return "typed-craft";
    default:
      return "prefab";
  }
}

export function parseSplitDefinitionsFromCode(source: string): GeneratedSplitDefinition[] {
  const cleaned = removeCSharpComments(source);
  const regex =
    /\[Description\("((?:\\.|[^"])*)"\),\s*ToolTip\("((?:\\.|[^"])*)"\)\]\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g;

  const output: GeneratedSplitDefinition[] = [];
  let match = regex.exec(cleaned);

  while (match) {
    const descriptionRaw = match[1];
    const tooltipRaw = match[2];
    const id = match[3];
    if (!descriptionRaw || !tooltipRaw || !id) {
      throw new Error("Failed to parse split definition attributes.");
    }
    output.push({
      id,
      description: unescapeQuoted(descriptionRaw),
      tooltip: unescapeQuoted(tooltipRaw),
      kind: parseSplitKind(id)
    });
    match = regex.exec(cleaned);
  }

  return output;
}

export function parseEnumMembers(source: string, enumName: string): string[] {
  const cleaned = removeCSharpComments(source);
  const enumRegex = new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = cleaned.match(enumRegex);
  if (!match) {
    throw new Error(`Failed to locate enum ${enumName}`);
  }

  const body = match[1];
  if (!body) {
    throw new Error(`Failed to parse enum body for ${enumName}`);
  }
  const entries: string[] = [];

  body.split(/\r?\n/).forEach((lineRaw) => {
    const line = lineRaw.replace(/\/\/.*$/, "").trim();
    if (!line) {
      return;
    }
    const lineMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*.+?)?\s*,?$/
    );
    if (!lineMatch) {
      return;
    }
    const memberName = lineMatch[1];
    if (!memberName) {
      return;
    }
    entries.push(memberName);
  });

  if (entries.length === 0) {
    throw new Error(`Enum ${enumName} parsed with zero members`);
  }

  return entries;
}

function stripJsonComments(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] ?? "";
    if (ch === undefined) {
      continue;
    }

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"' && !inString) {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  return out;
}

function escapeInvalidCharsInJsonStrings(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === undefined) {
      continue;
    }
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) {
        out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  return out;
}

export function parseLocalizationMap(source: string): Record<string, string> {
  const noComments = stripJsonComments(source);
  const escaped = escapeInvalidCharsInJsonStrings(noComments);
  return JSON.parse(escaped) as Record<string, string>;
}

function toOptions(
  members: string[],
  localization: Record<string, string>,
  skipFirst = true
): GeneratedEnumOption[] {
  const source = skipFirst ? members.slice(1) : members;
  return source.map((id) => ({
    id,
    label: localization[id] || id
  }));
}

export function generateArtifacts(
  autosplitterRoot: string
): GeneratedArtifacts {
  const splitSettingsPath = path.join(
    autosplitterRoot,
    "Settings",
    "SubnauticaSplitSetting.cs"
  );
  const splitSettingsCode = fs.readFileSync(splitSettingsPath, "utf8");
  const splitDefinitions = parseSplitDefinitionsFromCode(splitSettingsCode);

  const biomeCode = fs.readFileSync(
    path.join(autosplitterRoot, "Enums", "Biome.cs"),
    "utf8"
  );
  const craftableCode = fs.readFileSync(
    path.join(autosplitterRoot, "Enums", "Craftable.cs"),
    "utf8"
  );
  const inventoryCode = fs.readFileSync(
    path.join(autosplitterRoot, "Enums", "InvItems.cs"),
    "utf8"
  );
  const unlockableCode = fs.readFileSync(
    path.join(autosplitterRoot, "Enums", "Unlockable.cs"),
    "utf8"
  );
  const encyclopediaCode = fs.readFileSync(
    path.join(autosplitterRoot, "Enums", "EncyMapping2023.cs"),
    "utf8"
  );
  const localizationSource = fs.readFileSync(
    path.join(autosplitterRoot, "Resources", "English.json"),
    "utf8"
  );
  const localization = parseLocalizationMap(localizationSource);

  return {
    splitDefinitions,
    biome: toOptions(parseEnumMembers(biomeCode, "Biome"), localization),
    craftable: toOptions(parseEnumMembers(craftableCode, "Craftable"), localization),
    inventory: toOptions(parseEnumMembers(inventoryCode, "InventoryItem"), localization),
    unlockable: toOptions(parseEnumMembers(unlockableCode, "Unlockable"), localization),
    encyclopedia: toOptions(parseEnumMembers(encyclopediaCode, "EncyEntry"), localization)
  };
}

export function resolveProjectPaths() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  const autosplitterRoot = path.resolve(
    projectRoot,
    "vendor",
    "LiveSplitAutosplitter",
    "Livesplit.Subnautica"
  );
  const snapshotPath = path.resolve(
    projectRoot,
    "scripts",
    "subnautica-data-snapshot.json"
  );
  const generatedDir = path.resolve(projectRoot, "src", "generated");
  return { projectRoot, autosplitterRoot, snapshotPath, generatedDir };
}
