import { create } from "zustand";
import {
  addConditionToSplit,
  canAddCondition,
  createSplitNode,
  findSplitById
} from "../lib/splitTree";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_METADATA,
  ImportWarning,
  SubnauticaPresetDefinition,
  SubnauticaRunConfig,
  SubnauticaSplitKind,
  SubnauticaSplitNode
} from "../types/model";
import {
  removeSplitById,
  reorderConditions,
  reorderTopLevel,
  updateSplitById
} from "../lib/splitTree";

export const STORAGE_KEY = "subnautica-splits-maker:autosave";

export function createBlankConfig(): SubnauticaRunConfig {
  return {
    configVersion: 1,
    metadata: {
      ...DEFAULT_METADATA
    },
    globalSettings: {
      ...DEFAULT_GLOBAL_SETTINGS
    },
    splits: []
  };
}

function normalizeExclusiveSettings(
  settings: SubnauticaRunConfig["globalSettings"]
): SubnauticaRunConfig["globalSettings"] {
  const nextSettings = { ...settings };
  if (nextSettings.OrderedLiveSplit && nextSettings.OrderedAutoSplits) {
    nextSettings.OrderedAutoSplits = false;
  }
  if (nextSettings.IntroStart && nextSettings.CreativeStart) {
    nextSettings.CreativeStart = false;
  }
  return nextSettings;
}

interface AppState {
  config: SubnauticaRunConfig;
  presetId: string;
  selectedSplitId: string | null;
  warnings: ImportWarning[];
  lastGeneratedLss: string;
  lastGeneratedJson: string;
  setConfig: (config: SubnauticaRunConfig, warnings?: ImportWarning[]) => void;
  setPresetId: (presetId: string) => void;
  setWarnings: (warnings: ImportWarning[]) => void;
  selectSplit: (id: string | null) => void;
  updateMetadata: (patch: Partial<SubnauticaRunConfig["metadata"]>) => void;
  setVariable: (key: string, value: string) => void;
  removeVariable: (key: string) => void;
  reorderVariable: (key: string, direction: "up" | "down") => void;
  updateGlobalSetting: (key: keyof SubnauticaRunConfig["globalSettings"], value: boolean) => void;
  setGlobalSettings: (settings: SubnauticaRunConfig["globalSettings"]) => void;
  resetGlobalSettings: () => void;
  addTopLevelSplit: (kind: SubnauticaSplitKind) => void;
  clearAllSplits: () => void;
  addConditionSplit: (parentId: string, kind: SubnauticaSplitKind) => void;
  removeSplit: (id: string) => void;
  updateSplit: (id: string, updater: (node: SubnauticaSplitNode) => SubnauticaSplitNode) => void;
  reorderTopLevel: (activeId: string, overId: string) => void;
  reorderConditions: (parentId: string, activeId: string, overId: string) => void;
  applyPreset: (preset: SubnauticaPresetDefinition) => void;
  resetToBlank: () => void;
  setGeneratedOutputs: (lss: string, json: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: createBlankConfig(),
  presetId: "",
  selectedSplitId: null,
  warnings: [],
  lastGeneratedLss: "",
  lastGeneratedJson: "",
  setConfig: (config, warnings = []) =>
    set({
      config: {
        ...config,
        globalSettings: normalizeExclusiveSettings(config.globalSettings)
      },
      warnings,
      selectedSplitId: config.splits[0]?.id ?? null
    }),
  setPresetId: (presetId) => set({ presetId }),
  setWarnings: (warnings) => set({ warnings }),
  selectSplit: (id) => set({ selectedSplitId: id }),
  updateMetadata: (patch) =>
    set((state) => ({
      config: {
        ...state.config,
        metadata: {
          ...state.config.metadata,
          ...patch
        }
      }
    })),
  setVariable: (key, value) =>
    set((state) => ({
      config: {
        ...state.config,
        metadata: {
          ...state.config.metadata,
          variables: {
            ...state.config.metadata.variables,
            [key]: value
          }
        }
      }
    })),
  removeVariable: (key) =>
    set((state) => {
      const nextVariables = { ...state.config.metadata.variables };
      delete nextVariables[key];
      return {
        config: {
          ...state.config,
          metadata: {
            ...state.config.metadata,
            variables: nextVariables
          }
        }
      };
    }),
  reorderVariable: (key, direction) =>
    set((state) => {
      const entries = Object.entries(state.config.metadata.variables);
      const currentIndex = entries.findIndex(([entryKey]) => entryKey === key);
      if (currentIndex < 0) {
        return state;
      }

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= entries.length) {
        return state;
      }

      const copy = [...entries];
      const [current] = copy.splice(currentIndex, 1);
      if (!current) {
        return state;
      }
      copy.splice(nextIndex, 0, current);

      return {
        config: {
          ...state.config,
          metadata: {
            ...state.config.metadata,
            variables: Object.fromEntries(copy)
          }
        }
      };
    }),
  updateGlobalSetting: (key, value) =>
    set((state) => {
      const nextSettings = {
        ...state.config.globalSettings,
        [key]: value
      };

      if (key === "OrderedLiveSplit" && value) {
        nextSettings.OrderedAutoSplits = false;
      }
      if (key === "OrderedAutoSplits" && value) {
        nextSettings.OrderedLiveSplit = false;
      }
      if (key === "IntroStart" && value) {
        nextSettings.CreativeStart = false;
      }
      if (key === "CreativeStart" && value) {
        nextSettings.IntroStart = false;
      }

      return {
        config: {
          ...state.config,
          globalSettings: normalizeExclusiveSettings(nextSettings)
        }
      };
    }),
  setGlobalSettings: (settings) =>
    set((state) => ({
      config: {
        ...state.config,
        globalSettings: normalizeExclusiveSettings(settings)
      }
    })),
  resetGlobalSettings: () =>
    set((state) => ({
      config: {
        ...state.config,
        globalSettings: normalizeExclusiveSettings(DEFAULT_GLOBAL_SETTINGS)
      }
    })),
  addTopLevelSplit: (kind) =>
    set((state) => {
      const node = createSplitNode(kind, false);
      return {
        config: {
          ...state.config,
          splits: [...state.config.splits, node]
        },
        selectedSplitId: node.id
      };
    }),
  clearAllSplits: () =>
    set((state) => ({
      config: {
        ...state.config,
        splits: []
      },
      presetId: "",
      selectedSplitId: null
    })),
  addConditionSplit: (parentId, kind) =>
    set((state) => {
      const parent = findSplitById(state.config.splits, parentId);
      if (!parent || !canAddCondition(parent.node.kind)) {
        return state;
      }
      if (
        kind !== "inventory" &&
        kind !== "blueprint" &&
        kind !== "encyclopedia" &&
        kind !== "biome"
      ) {
        return state;
      }

      const node = createSplitNode(kind, true);
      const nextSplits = addConditionToSplit(state.config.splits, parentId, node);
      return {
        config: {
          ...state.config,
          splits: nextSplits
        },
        selectedSplitId: node.id
      };
    }),
  removeSplit: (id) =>
    set((state) => {
      const next = removeSplitById(state.config.splits, id);
      return {
        config: {
          ...state.config,
          splits: next
        },
        selectedSplitId:
          state.selectedSplitId === id ? next[0]?.id ?? null : state.selectedSplitId
      };
    }),
  updateSplit: (id, updater) =>
    set((state) => ({
      config: {
        ...state.config,
        splits: updateSplitById(state.config.splits, id, updater)
      }
    })),
  reorderTopLevel: (activeId, overId) =>
    set((state) => ({
      config: {
        ...state.config,
        splits: reorderTopLevel(state.config.splits, activeId, overId)
      }
    })),
  reorderConditions: (parentId, activeId, overId) =>
    set((state) => ({
      config: {
        ...state.config,
        splits: reorderConditions(state.config.splits, parentId, activeId, overId)
      }
    })),
  applyPreset: (preset) =>
    set({
      config: {
        configVersion: 1,
        metadata: structuredClone(preset.metadata),
        globalSettings: normalizeExclusiveSettings(structuredClone(preset.globalSettings)),
        splits: structuredClone(preset.splits)
      },
      presetId: preset.id,
      selectedSplitId: preset.splits[0]?.id ?? null,
      warnings: []
    }),
  resetToBlank: () =>
    set({
      config: createBlankConfig(),
      presetId: "",
      selectedSplitId: null,
      warnings: []
    }),
  setGeneratedOutputs: (lss, json) =>
    set({
      lastGeneratedLss: lss,
      lastGeneratedJson: json
    })
}));

export function getSelectedSplit(
  state: Pick<AppState, "config" | "selectedSplitId">
): SubnauticaSplitNode | null {
  if (!state.selectedSplitId) {
    return null;
  }
  const result = findSplitById(state.config.splits, state.selectedSplitId);
  return result?.node ?? null;
}

export function serializeForStorage(config: SubnauticaRunConfig): string {
  return JSON.stringify(config);
}

export function deserializeFromStorage(raw: string): SubnauticaRunConfig {
  return JSON.parse(raw) as SubnauticaRunConfig;
}

export function getCurrentConfig(): SubnauticaRunConfig {
  return useAppStore.getState().config;
}
