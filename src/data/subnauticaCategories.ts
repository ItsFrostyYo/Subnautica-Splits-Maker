import { z } from "zod";
import categoriesRaw from "./subnauticaCategories.json";
import { SubnauticaGlobalSettings, SubnauticaRunMetadata } from "../types/model";

export type CategoryGroup =
  | "Main Categories"
  | "Category Extensions"
  | "Unofficial Category Extensions";

export interface CategoryVariableDefinition {
  key: string;
  label: string;
  options: string[];
}

export interface SubnauticaCategoryDefinition {
  id: string;
  label: string;
  group: CategoryGroup;
  categoryName: string;
  variableDefinitions: CategoryVariableDefinition[];
  fixedVariables: Record<string, string>;
  source: {
    gameSlug: string;
    gameId: string;
    categoryId: string;
  };
}

const categorySchema: z.ZodType<SubnauticaCategoryDefinition> = z.object({
  id: z.string(),
  label: z.string(),
  group: z.enum([
    "Main Categories",
    "Category Extensions",
    "Unofficial Category Extensions"
  ]),
  categoryName: z.string(),
  variableDefinitions: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      options: z.array(z.string())
    })
  ),
  fixedVariables: z.record(z.string()),
  source: z.object({
    gameSlug: z.string(),
    gameId: z.string(),
    categoryId: z.string()
  })
});

export const CATEGORY_GROUP_ORDER: CategoryGroup[] = [
  "Main Categories",
  "Category Extensions",
  "Unofficial Category Extensions"
];

export const subnauticaCategories = z
  .array(categorySchema)
  .parse(categoriesRaw as unknown);

export function getCategoryById(
  id: string
): SubnauticaCategoryDefinition | undefined {
  return subnauticaCategories.find((entry) => entry.id === id);
}

export function getDefaultCategory(): SubnauticaCategoryDefinition {
  const anyMain = subnauticaCategories.find(
    (entry) => entry.group === "Main Categories" && entry.label === "Any%"
  );
  if (anyMain) {
    return anyMain;
  }
  const first = subnauticaCategories[0];
  if (!first) {
    throw new Error("Category catalog is empty.");
  }
  return first;
}

export function buildVariablesForCategory(
  category: SubnauticaCategoryDefinition,
  currentVariables: Record<string, string> = {}
): Record<string, string> {
  const next: Record<string, string> = {};

  Object.entries(category.fixedVariables).forEach(([key, value]) => {
    next[key] = value;
  });

  category.variableDefinitions.forEach((definition) => {
    const current = currentVariables[definition.key];
    if (current && definition.options.includes(current)) {
      next[definition.key] = current;
      return;
    }
    next[definition.key] = definition.options[0] ?? "";
  });

  return next;
}

export function resolveCategoryForMetadata(
  metadata: SubnauticaRunMetadata
): SubnauticaCategoryDefinition {
  const fallback = getDefaultCategory();
  const exact = subnauticaCategories.find((category) => {
    if (category.categoryName !== metadata.categoryName) {
      return false;
    }

    const fixedOk = Object.entries(category.fixedVariables).every(([key, value]) => {
      return metadata.variables[key] === value;
    });
    if (!fixedOk) {
      return false;
    }

    return category.variableDefinitions.every((definition) => {
      const value = metadata.variables[definition.key];
      return typeof value === "string" && definition.options.includes(value);
    });
  });

  if (exact) {
    return exact;
  }

  const byCategoryName = subnauticaCategories.find(
    (category) => category.categoryName === metadata.categoryName
  );

  return byCategoryName ?? fallback;
}

export function getGameModeForCategory(
  category: SubnauticaCategoryDefinition,
  variables: Record<string, string>
): "Survival" | "Hardcore" | "Creative" {
  const fixedMode = category.fixedVariables["Game Mode"];
  if (fixedMode === "Creative") {
    return "Creative";
  }
  if (fixedMode === "Hardcore") {
    return "Hardcore";
  }
  if (fixedMode === "Survival") {
    return "Survival";
  }

  const selectedMode = variables["Game Mode"];
  if (selectedMode === "Creative") {
    return "Creative";
  }
  if (selectedMode === "Hardcore") {
    return "Hardcore";
  }
  if (selectedMode === "Survival") {
    return "Survival";
  }

  return "Survival";
}

export function buildDefaultSettingsForGameMode(
  gameMode: "Survival" | "Hardcore" | "Creative"
): SubnauticaGlobalSettings {
  const isCreative = gameMode === "Creative";
  return {
    IntroStart: !isCreative,
    CreativeStart: isCreative,
    Reset: true,
    AskForGoldSave: false,
    SRCLoadtimes: isCreative,
    OrderedLiveSplit: true,
    OrderedAutoSplits: false
  };
}
