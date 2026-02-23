import { z } from "zod";

const splitDataKindSchema = z.enum([
  "typed-none",
  "typed-inventory",
  "typed-blueprint",
  "typed-encyclopedia",
  "typed-biome",
  "typed-craft",
  "prefab"
]);

const splitDefinitionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  tooltip: z.string(),
  kind: splitDataKindSchema
});

const enumOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export const splitDefinitionsFileSchema = z.array(splitDefinitionSchema);
export const enumOptionsFileSchema = z.array(enumOptionSchema);
