export const CURRENT_CONFIG_VERSION = 1 as const;

export type SubnauticaSplitKind =
  | "prefab"
  | "manual"
  | "inventory"
  | "blueprint"
  | "encyclopedia"
  | "biome"
  | "craft"
  | "legacy-raw";

export interface SubnauticaGlobalSettings {
  IntroStart: boolean;
  CreativeStart: boolean;
  Reset: boolean;
  AskForGoldSave: boolean;
  SRCLoadtimes: boolean;
  OrderedLiveSplit: boolean;
  OrderedAutoSplits: boolean;
}

export interface BaseSplitNode {
  id: string;
  kind: SubnauticaSplitKind;
  displayNameOverride?: string;
  iconData?: string;
  onlySplitOnce: boolean;
  isSubCondition: boolean;
  conditions: SubnauticaSplitNode[];
}

export interface PrefabSplitNode extends BaseSplitNode {
  kind: "prefab";
  prefabId: string;
}

export interface InventorySplitNode extends BaseSplitNode {
  kind: "inventory";
  itemId: string;
  pickUp: boolean;
  isCount: boolean;
  count: number;
}

export interface ManualSplitNode extends BaseSplitNode {
  kind: "manual";
}

export interface BlueprintSplitNode extends BaseSplitNode {
  kind: "blueprint";
  blueprintId: string;
}

export interface EncyclopediaSplitNode extends BaseSplitNode {
  kind: "encyclopedia";
  encyclopediaId: string;
}

export interface BiomeSplitNode extends BaseSplitNode {
  kind: "biome";
  fromBiomeId: string;
  toBiomeId: string;
}

export interface CraftSplitNode extends BaseSplitNode {
  kind: "craft";
  craftableId: string;
}

export interface LegacyRawSplitNode extends BaseSplitNode {
  kind: "legacy-raw";
  rawName: string;
  rawValue: string;
}

export type SubnauticaSplitNode =
  | PrefabSplitNode
  | ManualSplitNode
  | InventorySplitNode
  | BlueprintSplitNode
  | EncyclopediaSplitNode
  | BiomeSplitNode
  | CraftSplitNode
  | LegacyRawSplitNode;

export interface SubnauticaRunMetadata {
  gameName: string;
  categoryName: string;
  variables: Record<string, string>;
  offset: string;
}

export interface SubnauticaRunConfig {
  configVersion: typeof CURRENT_CONFIG_VERSION;
  metadata: SubnauticaRunMetadata;
  globalSettings: SubnauticaGlobalSettings;
  splits: SubnauticaSplitNode[];
}

export interface SubnauticaPresetDefinition {
  id: string;
  label: string;
  group: string;
  description?: string;
  metadata: SubnauticaRunMetadata;
  globalSettings: SubnauticaGlobalSettings;
  splits: SubnauticaSplitNode[];
}

export interface ImportWarning {
  code:
    | "unknown-split-name"
    | "unknown-enum-value"
    | "invalid-xml-shape"
    | "legacy-preserved"
    | "migration-applied";
  message: string;
  nodeId?: string;
}

export interface ImportResult {
  config: SubnauticaRunConfig;
  warnings: ImportWarning[];
}

export const DEFAULT_GLOBAL_SETTINGS: SubnauticaGlobalSettings = {
  IntroStart: true,
  CreativeStart: false,
  Reset: true,
  AskForGoldSave: false,
  SRCLoadtimes: false,
  OrderedLiveSplit: true,
  OrderedAutoSplits: false
};

export const DEFAULT_METADATA: SubnauticaRunMetadata = {
  gameName: "Subnautica",
  categoryName: "Any%",
  variables: {
    "Run Type": "Glitchless",
    "Game Mode": "Survival"
  },
  offset: "00:00:00"
};
