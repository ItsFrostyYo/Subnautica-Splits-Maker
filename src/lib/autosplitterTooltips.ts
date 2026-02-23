import { splitDefinitions } from "../generated";
import {
  SubnauticaGlobalSettings,
  SubnauticaSplitKind,
  SubnauticaSplitNode
} from "../types/model";

export type GlobalSettingKey = keyof SubnauticaGlobalSettings;
export type ConditionSplitKind = Extract<
  SubnauticaSplitKind,
  "inventory" | "blueprint" | "encyclopedia" | "biome"
>;

const splitDefinitionById = new Map(
  splitDefinitions.map((definition) => [definition.id, definition])
);

export const SETTINGS_TOOLTIPS: Record<GlobalSettingKey, string> = {
  IntroStart: "Starts the timer after the intro animation",
  CreativeStart:
    "Starts the timer when you move horizontally, jump, open your PDA or interact with the fabricator",
  Reset: "Resets the timer when you come back to the main menu",
  AskForGoldSave: "Ask to save golds when the timer auto resets",
  SRCLoadtimes:
    "This will add time to the actual load times to match the IGT shown on Speedrun.com (can be up to 0.1s inaccurate)\nUnchecking this will not turn off the load removal",
  OrderedLiveSplit:
    "Auto-splits are triggered in the same order as the splits in LiveSplit.\nIf you skip a split in LiveSplit, the corresponding auto-split will also be skipped.",
  OrderedAutoSplits: "Auto-splits trigger one after another in their own sequence."
};

export const SPLIT_KIND_LABELS: Record<SubnauticaSplitKind, string> = {
  prefab: "Prefabricated Splits",
  inventory: "Inventory Splits",
  blueprint: "Blueprint Splits",
  encyclopedia: "Databank Entry Splits",
  biome: "Biome Change Splits",
  craft: "Crafting Splits",
  manual: "Manual (No Autosplits)",
  "legacy-raw": "Legacy Raw Split"
};

export const CONDITION_KIND_LABELS: Record<ConditionSplitKind, string> = {
  inventory: "Inventory Condition",
  blueprint: "Blueprint Condition",
  encyclopedia: "Databank Entry Condition",
  biome: "Biome Condition"
};

function typedSplitTooltip(kind: SubnauticaSplitKind): string {
  const definitionId =
    kind === "inventory"
      ? "Inventory"
      : kind === "blueprint"
        ? "Blueprint"
        : kind === "encyclopedia"
          ? "Encyclopedia"
          : kind === "biome"
            ? "Biome"
            : kind === "craft"
              ? "Craft"
              : "None";
  return splitDefinitionById.get(definitionId)?.tooltip ?? "";
}

export function getSplitKindLabel(kind: SubnauticaSplitKind): string {
  return SPLIT_KIND_LABELS[kind];
}

export function getConditionKindLabel(kind: ConditionSplitKind): string {
  return CONDITION_KIND_LABELS[kind];
}

export function getSplitKindTooltip(kind: SubnauticaSplitKind): string {
  if (kind === "prefab") {
    return "Choose a built-in Subnautica autosplit trigger.";
  }
  if (kind === "manual") {
    return "Manual split with no autosplit trigger.";
  }
  if (kind === "legacy-raw") {
    return "Unknown legacy split preserved for safe round-trip import/export.";
  }
  return typedSplitTooltip(kind);
}

export function getSplitTooltip(node: SubnauticaSplitNode): string {
  if (node.kind === "prefab") {
    return (
      splitDefinitionById.get(node.prefabId)?.tooltip ??
      splitDefinitionById.get("None")?.tooltip ??
      "Prefabricated autosplit trigger."
    );
  }
  if (node.kind === "manual") {
    return "Manual split with no autosplit trigger.";
  }
  if (node.kind === "legacy-raw") {
    return "Unknown legacy split preserved from import.";
  }

  const baseTooltip = typedSplitTooltip(node.kind);
  if (node.isSubCondition && node.kind === "inventory") {
    return `${baseTooltip} Condition mode checks the inventory state before the parent split trigger.`;
  }
  if (node.isSubCondition && node.kind === "blueprint") {
    return `${baseTooltip} Condition mode checks unlocked blueprints before the parent split trigger.`;
  }
  if (node.isSubCondition && node.kind === "encyclopedia") {
    return `${baseTooltip} Condition mode checks databank unlock state before the parent split trigger.`;
  }
  return baseTooltip;
}

