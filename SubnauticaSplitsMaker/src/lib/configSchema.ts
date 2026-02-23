import { z } from "zod";
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_METADATA,
  SubnauticaGlobalSettings,
  SubnauticaRunConfig,
  SubnauticaRunMetadata,
  SubnauticaSplitNode
} from "../types/model";

const globalSettingsSchema = z.object({
  IntroStart: z.boolean(),
  CreativeStart: z.boolean(),
  Reset: z.boolean(),
  AskForGoldSave: z.boolean(),
  SRCLoadtimes: z.boolean(),
  OrderedLiveSplit: z.boolean(),
  OrderedAutoSplits: z.boolean()
});

const metadataSchema = z.object({
  gameName: z.string().min(1),
  categoryName: z.string().min(1),
  variables: z.record(z.string()),
  offset: z.string().min(1)
});

const splitBaseSchema = z.object({
  id: z.string().min(1),
  displayNameOverride: z.string().optional(),
  iconData: z.string().optional(),
  onlySplitOnce: z.boolean(),
  isSubCondition: z.boolean()
});

const splitNodeSchema: z.ZodType<SubnauticaSplitNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    splitBaseSchema.extend({
      kind: z.literal("prefab"),
      prefabId: z.string().min(1),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("manual"),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("inventory"),
      itemId: z.string().min(1),
      pickUp: z.boolean(),
      isCount: z.boolean(),
      count: z.number().int().min(1).max(48),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("blueprint"),
      blueprintId: z.string().min(1),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("encyclopedia"),
      encyclopediaId: z.string().min(1),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("biome"),
      fromBiomeId: z.string().min(1),
      toBiomeId: z.string().min(1),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("craft"),
      craftableId: z.string().min(1),
      conditions: z.array(splitNodeSchema)
    }),
    splitBaseSchema.extend({
      kind: z.literal("legacy-raw"),
      rawName: z.string().min(1),
      rawValue: z.string(),
      conditions: z.array(splitNodeSchema)
    })
  ])
);

export const runConfigSchema: z.ZodType<SubnauticaRunConfig> = z.object({
  configVersion: z.literal(CURRENT_CONFIG_VERSION),
  metadata: metadataSchema,
  globalSettings: globalSettingsSchema,
  splits: z.array(splitNodeSchema)
});

function sanitizeGlobalSettings(
  raw: Partial<SubnauticaGlobalSettings> | undefined
): SubnauticaGlobalSettings {
  return {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...raw
  };
}

function sanitizeMetadata(
  raw: Partial<SubnauticaRunMetadata> | undefined
): SubnauticaRunMetadata {
  const categoryName = raw?.categoryName?.trim() || DEFAULT_METADATA.categoryName;
  const offset = raw?.offset?.trim() || DEFAULT_METADATA.offset;
  return {
    gameName: "Subnautica",
    categoryName,
    variables: raw?.variables ? { ...raw.variables } : { ...DEFAULT_METADATA.variables },
    offset
  };
}

function sanitizeSplitNode(node: SubnauticaSplitNode): SubnauticaSplitNode {
  const sanitizedConditions = node.conditions.map((condition) =>
    sanitizeSplitNode(condition)
  );
  switch (node.kind) {
    case "inventory":
      return {
        ...node,
        count: Math.min(48, Math.max(1, Math.floor(node.count || 1))),
        conditions: sanitizedConditions
      };
    default:
      return {
        ...node,
        conditions: sanitizedConditions
      };
  }
}

export function sanitizeConfig(config: SubnauticaRunConfig): SubnauticaRunConfig {
  return {
    configVersion: CURRENT_CONFIG_VERSION,
    metadata: sanitizeMetadata(config.metadata),
    globalSettings: sanitizeGlobalSettings(config.globalSettings),
    splits: config.splits.map((node) => sanitizeSplitNode(node))
  };
}

export function parseRunConfigOrThrow(value: unknown): SubnauticaRunConfig {
  const parsed = runConfigSchema.parse(value);
  return sanitizeConfig(parsed);
}
