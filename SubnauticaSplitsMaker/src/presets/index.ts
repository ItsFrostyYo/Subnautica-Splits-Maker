import { z } from "zod";
import presetsRaw from "./subnautica-active.json";
import { SubnauticaPresetDefinition } from "../types/model";

// To activate the full generated preset pack later, change the import above to:
// import presetsRaw from "./subnautica-all-categories.json";

const splitNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.enum([
      "prefab",
      "manual",
      "inventory",
      "blueprint",
      "encyclopedia",
      "biome",
      "craft",
      "legacy-raw"
    ]),
    displayNameOverride: z.string().optional(),
    iconData: z.string().optional(),
    onlySplitOnce: z.boolean(),
    isSubCondition: z.boolean(),
    conditions: z.array(splitNodeSchema)
  }).passthrough()
);

const presetSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string(),
  description: z.string().optional(),
  metadata: z.object({
    gameName: z.string(),
    categoryName: z.string(),
    variables: z.record(z.string()),
    offset: z.string()
  }),
  globalSettings: z.object({
    IntroStart: z.boolean(),
    CreativeStart: z.boolean(),
    Reset: z.boolean(),
    AskForGoldSave: z.boolean(),
    SRCLoadtimes: z.boolean(),
    OrderedLiveSplit: z.boolean(),
    OrderedAutoSplits: z.boolean()
  }),
  splits: z.array(splitNodeSchema)
});

const presetsSchema = z.array(presetSchema);

export const presets = presetsSchema.parse(
  presetsRaw
) as unknown as SubnauticaPresetDefinition[];
