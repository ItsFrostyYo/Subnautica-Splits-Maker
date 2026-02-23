import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  encyclopediaOptions,
  inventoryOptions,
  splitDefinitions,
  unlockableOptions
} from "../generated";
import {
  ImportResult,
  ImportWarning,
  SubnauticaRunConfig,
  SubnauticaSplitNode
} from "../types/model";
import { createId } from "./id";
import { getNodeLabel } from "./splitTree";

const TRUE_TEXT = "True";
const FALSE_TEXT = "False";

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: false
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  parseTagValue: false,
  trimValues: false
});

const splitDescriptionToId = new Map<string, string>();
splitDefinitions.forEach((definition) => {
  splitDescriptionToId.set(definition.description.toLowerCase(), definition.id);
});

const knownInventory = new Set(inventoryOptions.map((option) => option.id));
const knownBlueprint = new Set(unlockableOptions.map((option) => option.id));
const knownEncyclopedia = new Set(encyclopediaOptions.map((option) => option.id));

function boolToText(value: boolean): string {
  return value ? TRUE_TEXT : FALSE_TEXT;
}

function textToBool(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim().toLowerCase() === "true";
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") {
      const textValue = record["#text"].trim();
      if (textValue) {
        return textValue;
      }
    }
    if (typeof record["#cdata"] === "string") {
      return record["#cdata"].trim();
    }
  }
  return "";
}

function getSplitNameForNode(node: SubnauticaSplitNode): string {
  switch (node.kind) {
    case "prefab":
      return node.prefabId;
    case "manual":
      return "None";
    case "inventory":
      return "Inventory";
    case "blueprint":
      return "Blueprint";
    case "encyclopedia":
      return "Encyclopedia";
    case "biome":
      return "Biome";
    case "craft":
      return "Craft";
    case "legacy-raw":
      return node.rawName;
    default:
      return "Unknown";
  }
}

function getSplitValueForNode(node: SubnauticaSplitNode): string {
  switch (node.kind) {
    case "prefab":
      return node.prefabId;
    case "manual":
      return "None";
    case "inventory":
      return `${node.itemId}:${boolToText(node.isSubCondition ? true : node.pickUp)}:${boolToText(node.isCount)}:${node.count}`;
    case "blueprint":
      return node.blueprintId;
    case "encyclopedia":
      return node.encyclopediaId;
    case "biome":
      return `${node.fromBiomeId}:${node.toBiomeId}`;
    case "craft":
      return node.craftableId;
    case "legacy-raw":
      return node.rawValue;
    default:
      return "";
  }
}

function splitNodeToXmlObject(node: SubnauticaSplitNode): Record<string, unknown> {
  const xmlNode: Record<string, unknown> = {
    OnlySplitOnce: boolToText(node.onlySplitOnce),
    IsSubCondition: boolToText(node.isSubCondition),
    Name: getSplitNameForNode(node),
    Value: getSplitValueForNode(node)
  };

  if (node.conditions.length > 0) {
    xmlNode.Conditions = {
      Split: node.conditions.map((condition) => splitNodeToXmlObject(condition))
    };
  }

  return xmlNode;
}

function splitSegmentToXmlObject(node: SubnauticaSplitNode): Record<string, unknown> {
  const segmentName = node.displayNameOverride || getNodeLabel(node);
  const iconValue = node.iconData || "";

  return {
    Name: segmentName,
    Icon: iconValue ? { "#cdata": iconValue } : "",
    SplitTimes: {
      SplitTime: {
        "@_name": "Personal Best"
      }
    },
    BestSegmentTime: "",
    SegmentHistory: ""
  };
}

function buildVariablesNode(
  variables: Record<string, string>
): string | { Variable: Array<Record<string, string>> } {
  const entries = Object.entries(variables);
  if (entries.length === 0) {
    return "";
  }
  return {
    Variable: entries.map(([name, value]) => ({
      "@_name": name,
      "#text": value
    }))
  };
}

export function exportToLss(config: SubnauticaRunConfig): string {
  const doc = {
    Run: {
      "@_version": "1.7.0",
      GameIcon: "",
      GameName: config.metadata.gameName,
      CategoryName: config.metadata.categoryName,
      Metadata: {
        Run: {
          "@_id": ""
        },
        Platform: {
          "@_usesEmulator": FALSE_TEXT
        },
        Variables: buildVariablesNode(config.metadata.variables)
      },
      Offset: config.metadata.offset,
      AttemptCount: "0",
      AttemptHistory: "",
      Segments: {
        Segment: config.splits.map((split) => splitSegmentToXmlObject(split))
      },
      AutoSplitterSettings: {
        Settings: {
          IntroStart: boolToText(config.globalSettings.IntroStart),
          CreativeStart: boolToText(config.globalSettings.CreativeStart),
          Reset: boolToText(config.globalSettings.Reset),
          AskForGoldSave: boolToText(config.globalSettings.AskForGoldSave),
          SRCLoadtimes: boolToText(config.globalSettings.SRCLoadtimes),
          OrderedLiveSplit: boolToText(config.globalSettings.OrderedLiveSplit),
          OrderedAutoSplits: boolToText(config.globalSettings.OrderedAutoSplits),
          Splits: {
            Split: config.splits.map((split) => splitNodeToXmlObject(split))
          }
        }
      }
    }
  };

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBuilder.build(doc)}`;
}

function markUnknownEnum(
  warnings: ImportWarning[],
  kind: "Inventory" | "Blueprint" | "Encyclopedia",
  value: string
): void {
  warnings.push({
    code: "unknown-enum-value",
    message: `${kind} value "${value}" is not in generated enum list. Preserved as raw string.`
  });
}

function parseSplitNode(
  rawSplit: Record<string, unknown>,
  warnings: ImportWarning[]
): SubnauticaSplitNode {
  const rawName = textContent(rawSplit.Name);
  const rawValue = textContent(rawSplit.Value);
  const resolvedName =
    rawName ||
    (typeof rawSplit.Name === "string" ? rawSplit.Name : "UnknownSplit");

  const nameKey = resolvedName.toLowerCase();
  const normalizedName = splitDescriptionToId.get(nameKey) || resolvedName;
  const onlySplitOnce = textToBool(rawSplit.OnlySplitOnce, true);
  const isSubCondition = textToBool(rawSplit.IsSubCondition, false);
  const conditionsRaw = asArray(
    (rawSplit.Conditions as Record<string, unknown> | undefined)?.Split as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  const conditions = conditionsRaw.map((child) => parseSplitNode(child, warnings));

  if (normalizedName !== resolvedName) {
    warnings.push({
      code: "legacy-preserved",
      message: `Mapped legacy split description "${resolvedName}" to "${normalizedName}".`
    });
  }

  switch (normalizedName) {
    case "None":
      return {
        id: createId(),
        kind: "manual",
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    case "Inventory": {
      const [itemId = "Quartz", pickUp = "True", isCount = "False", count = "1"] =
        rawValue.split(":");
      if (!knownInventory.has(itemId)) {
        markUnknownEnum(warnings, "Inventory", itemId);
      }
      return {
        id: createId(),
        kind: "inventory",
        itemId,
        pickUp: isSubCondition ? true : pickUp.toLowerCase() === "true",
        isCount: isCount.toLowerCase() === "true",
        count: Math.max(1, Math.min(48, Number.parseInt(count, 10) || 1)),
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    }
    case "Blueprint":
      if (!knownBlueprint.has(rawValue)) {
        markUnknownEnum(warnings, "Blueprint", rawValue);
      }
      return {
        id: createId(),
        kind: "blueprint",
        blueprintId: rawValue || "Titanium",
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    case "Encyclopedia":
      if (!knownEncyclopedia.has(rawValue)) {
        markUnknownEnum(warnings, "Encyclopedia", rawValue);
      }
      return {
        id: createId(),
        kind: "encyclopedia",
        encyclopediaId: rawValue || "CuteFish",
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    case "Biome": {
      const [fromBiomeId = "Any", toBiomeId = "SafeShallows"] = rawValue.split(":");
      return {
        id: createId(),
        kind: "biome",
        fromBiomeId,
        toBiomeId,
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    }
    case "Craft":
      return {
        id: createId(),
        kind: "craft",
        craftableId: rawValue || "FiberMesh",
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    default: {
      const knownPrefab = splitDefinitions.some(
        (definition) => definition.id === normalizedName
      );
      if (!knownPrefab) {
        warnings.push({
          code: "unknown-split-name",
          message: `Unknown split "${resolvedName}" preserved as legacy-raw.`
        });
        return {
          id: createId(),
          kind: "legacy-raw",
          rawName: resolvedName || "UnknownSplit",
          rawValue,
          displayNameOverride: "",
          iconData: "",
          onlySplitOnce,
          isSubCondition,
          conditions
        };
      }
      return {
        id: createId(),
        kind: "prefab",
        prefabId: normalizedName,
        displayNameOverride: "",
        iconData: "",
        onlySplitOnce,
        isSubCondition,
        conditions
      };
    }
  }
}

function parseVariables(rawVariables: unknown): Record<string, string> {
  const variableNodes = asArray(
    (rawVariables as Record<string, unknown> | undefined)?.Variable as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  const result: Record<string, string> = {};
  variableNodes.forEach((entry) => {
    const name = textContent(entry["@_name"]);
    if (!name) {
      return;
    }
    result[name] = textContent(entry["#text"] ?? "");
  });
  return result;
}

function collapseLegacyLaunchPair(
  splits: SubnauticaSplitNode[],
  segmentCount: number,
  warnings: ImportWarning[]
): SubnauticaSplitNode[] {
  if (segmentCount !== splits.length - 1) {
    return splits;
  }

  if (splits.length < 2) {
    return splits;
  }

  const gantry = splits[splits.length - 2];
  const rocket = splits[splits.length - 1];
  if (!gantry || !rocket) {
    return splits;
  }

  if (gantry.kind !== "prefab" || rocket.kind !== "prefab") {
    return splits;
  }

  if (gantry.prefabId !== "GantrySplit" || rocket.prefabId !== "RocketSplit") {
    return splits;
  }

  const mergedRocket: SubnauticaSplitNode = {
    ...rocket,
    displayNameOverride:
      rocket.displayNameOverride || gantry.displayNameOverride || "",
    iconData: rocket.iconData || gantry.iconData || ""
  };

  warnings.push({
    code: "legacy-preserved",
    message:
      "Collapsed legacy GantrySplit + RocketSplit tail pair into a single RocketSplit to match segment count."
  });

  return [...splits.slice(0, -2), mergedRocket];
}

export function importFromLss(xml: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const run = parsed.Run as Record<string, unknown> | undefined;
  if (!run) {
    throw new Error("Invalid LSS: missing Run node.");
  }

  const autoSplitterSettings =
    ((run.AutoSplitterSettings as Record<string, unknown> | undefined)?.Settings as
      | Record<string, unknown>
      | undefined) ||
    (run.AutoSplitterSettings as Record<string, unknown> | undefined);

  if (!autoSplitterSettings) {
    throw new Error("Invalid LSS: missing AutoSplitterSettings.");
  }

  const splitNodesRaw = asArray(
    (autoSplitterSettings.Splits as Record<string, unknown> | undefined)?.Split as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  const splits = splitNodesRaw.map((raw) => parseSplitNode(raw, warnings));

  const segmentNodes = asArray(
    (run.Segments as Record<string, unknown> | undefined)?.Segment as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  splits.forEach((split, index) => {
    const segment = segmentNodes[index];
    if (!segment) {
      return;
    }
    const segmentName = textContent(segment.Name);
    const defaultName = getNodeLabel(split);
    if (segmentName && segmentName !== defaultName) {
      split.displayNameOverride = segmentName;
    }

    const iconData = textContent(segment.Icon);
    if (iconData) {
      split.iconData = iconData;
    }
  });
  const normalizedSplits = collapseLegacyLaunchPair(splits, segmentNodes.length, warnings);

  const metadataNode = (run.Metadata as Record<string, unknown> | undefined) || {};
  const variables = parseVariables(metadataNode.Variables);

  const config: SubnauticaRunConfig = {
    configVersion: 1,
    metadata: {
      gameName: textContent(run.GameName) || "Subnautica",
      categoryName: textContent(run.CategoryName) || "Imported Category",
      variables,
      offset: textContent(run.Offset) || "00:00:00"
    },
    globalSettings: {
      IntroStart: textToBool(autoSplitterSettings.IntroStart, true),
      CreativeStart: textToBool(autoSplitterSettings.CreativeStart, false),
      Reset: textToBool(autoSplitterSettings.Reset, true),
      AskForGoldSave: textToBool(autoSplitterSettings.AskForGoldSave, false),
      SRCLoadtimes: textToBool(autoSplitterSettings.SRCLoadtimes, false),
      OrderedLiveSplit: textToBool(autoSplitterSettings.OrderedLiveSplit, true),
      OrderedAutoSplits: textToBool(autoSplitterSettings.OrderedAutoSplits, false)
    },
    splits: normalizedSplits
  };

  return { config, warnings };
}
