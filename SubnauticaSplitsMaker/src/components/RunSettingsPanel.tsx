import { ChangeEvent, useEffect, useMemo } from "react";
import {
  buildDefaultSettingsForGameMode,
  buildVariablesForCategory,
  CATEGORY_GROUP_ORDER,
  getCategoryById,
  getDefaultCategory,
  getGameModeForCategory,
  resolveCategoryForMetadata,
  subnauticaCategories
} from "../data/subnauticaCategories";
import { importLss } from "../lib/io";
import { SETTINGS_TOOLTIPS } from "../lib/autosplitterTooltips";
import { presets } from "../presets";
import { useAppStore } from "../store/useAppStore";

const settingLabels: Array<{
  key:
    | "IntroStart"
    | "CreativeStart"
    | "Reset"
    | "AskForGoldSave"
    | "SRCLoadtimes"
    | "OrderedLiveSplit"
    | "OrderedAutoSplits";
  label: string;
}> = [
  { key: "IntroStart", label: "Start After Intro" },
  { key: "CreativeStart", label: "Creative Start" },
  { key: "Reset", label: "Reset Run on Main Menu" },
  { key: "AskForGoldSave", label: "Warn On Reset If Gold" },
  { key: "SRCLoadtimes", label: "SRC Loadtimes" },
  { key: "OrderedLiveSplit", label: "Ordered Splits (LiveSplit)" },
  { key: "OrderedAutoSplits", label: "Ordered Splits (Auto-Splits)" }
];

interface PresetFileLoaderEntry {
  sourcePath: string;
  load: () => Promise<string>;
}

interface PresetFileLoaderCandidate extends PresetFileLoaderEntry {
  priority: number;
}

const presetFileModuleGroups: Array<{
  priority: number;
  modules: Record<string, () => Promise<string>>;
}> = [
  {
    priority: 0,
    modules: import.meta.glob("../../Presets/*.lss", {
      import: "default",
      query: "?raw"
    }) as Record<string, () => Promise<string>>
  },
  {
    priority: 1,
    modules: import.meta.glob("../../presets/*.lss", {
      import: "default",
      query: "?raw"
    }) as Record<string, () => Promise<string>>
  },
  {
    priority: 2,
    modules: import.meta.glob("../Presets/*.lss", {
      import: "default",
      query: "?raw"
    }) as Record<string, () => Promise<string>>
  },
  {
    priority: 3,
    modules: import.meta.glob("../presets/*.lss", {
      import: "default",
      query: "?raw"
    }) as Record<string, () => Promise<string>>
  }
];

function buildPresetFileLoaders(): Record<string, PresetFileLoaderEntry[]> {
  const byName: Record<string, PresetFileLoaderCandidate[]> = {};

  presetFileModuleGroups.forEach(({ priority, modules }) => {
    Object.entries(modules).forEach(([path, loader]) => {
      const match = path.match(/\/([^/]+)\.lss$/i);
      const filename = match?.[1];
      if (!filename) {
        return;
      }

      const key = filename.toLowerCase();
      if (!byName[key]) {
        byName[key] = [];
      }

      byName[key]?.push({
        sourcePath: path,
        load: loader,
        priority
      });
    });
  });

  return Object.fromEntries(
    Object.entries(byName).map(([key, entries]) => [
      key,
      [...entries]
        .sort((left, right) => left.priority - right.priority)
        .map(({ sourcePath, load }) => ({ sourcePath, load }))
    ])
  );
}

const presetFileLoaders = buildPresetFileLoaders();

async function tryLoadPresetFromPublic(label: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(label);
    const response = await fetch(`./Presets/${encoded}.lss`, {
      cache: "no-store"
    });
    if (response.ok) {
      return await response.text();
    }

    const lowerResponse = await fetch(`./presets/${encoded}.lss`, {
      cache: "no-store"
    });
    if (lowerResponse.ok) {
      return await lowerResponse.text();
    }

    const rawPathResponse = await fetch(`./Presets/${label}.lss`, {
      cache: "no-store"
    });
    if (rawPathResponse.ok) {
      return await rawPathResponse.text();
    }

    const rawPathLowerResponse = await fetch(`./presets/${label}.lss`, {
      cache: "no-store"
    });
    if (rawPathLowerResponse.ok) {
      return await rawPathLowerResponse.text();
    }

    return null;
  } catch {
    return null;
  }
}

export function RunSettingsPanel() {
  const config = useAppStore((state) => state.config);
  const presetId = useAppStore((state) => state.presetId);
  const setPresetId = useAppStore((state) => state.setPresetId);
  const applyPreset = useAppStore((state) => state.applyPreset);
  const setConfig = useAppStore((state) => state.setConfig);
  const updateMetadata = useAppStore((state) => state.updateMetadata);
  const updateGlobalSetting = useAppStore((state) => state.updateGlobalSetting);
  const setGlobalSettings = useAppStore((state) => state.setGlobalSettings);

  const groupedPresets = useMemo(() => {
    const groups = new Map<string, typeof presets>();
    presets.forEach((preset) => {
      if (!groups.has(preset.group)) {
        groups.set(preset.group, []);
      }
      groups.get(preset.group)?.push(preset);
    });
    return groups;
  }, []);

  const selectedCategory = resolveCategoryForMetadata(config.metadata);
  const normalizedVariables = buildVariablesForCategory(
    selectedCategory,
    config.metadata.variables
  );
  const fixedVariableEntries = Object.entries(selectedCategory.fixedVariables ?? {});

  useEffect(() => {
    const variablesChanged =
      JSON.stringify(config.metadata.variables) !== JSON.stringify(normalizedVariables);
    if (
      config.metadata.gameName !== "Subnautica" ||
      config.metadata.categoryName !== selectedCategory.categoryName ||
      variablesChanged
    ) {
      updateMetadata({
        gameName: "Subnautica",
        categoryName: selectedCategory.categoryName,
        variables: normalizedVariables
      });
    }
  }, [
    config.metadata.categoryName,
    config.metadata.gameName,
    config.metadata.variables,
    normalizedVariables,
    selectedCategory.categoryName,
    updateMetadata
  ]);

  const onPresetChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setPresetId(nextId);
    if (!nextId) {
      return;
    }

    const preset = presets.find((entry) => entry.id === nextId);
    if (!preset) {
      return;
    }
    if (!window.confirm(`Load preset "${preset.label}"?`)) {
      setPresetId("");
      return;
    }

    const fileLoaders = presetFileLoaders[preset.label.toLowerCase()];
    if (fileLoaders && fileLoaders.length > 0) {
      const errors: string[] = [];
      for (const loader of fileLoaders) {
        try {
          const lssRaw = await loader.load();
          const result = importLss(lssRaw);
          setConfig(result.config, result.warnings);
          return;
        } catch (error) {
          errors.push(`${loader.sourcePath}: ${(error as Error).message}`);
        }
      }
      window.alert(
        `Failed to load preset file "${preset.label}.lss":\n${errors.join("\n")}`
      );
      return;
    }

    const publicPresetRaw = await tryLoadPresetFromPublic(preset.label);
    if (publicPresetRaw !== null) {
      try {
        const result = importLss(publicPresetRaw);
        setConfig(result.config, result.warnings);
        return;
      } catch (error) {
        window.alert(
          `Failed to load public preset file "${preset.label}.lss": ${(error as Error).message}`
        );
        return;
      }
    }

    applyPreset(preset);
  };

  const onCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = getCategoryById(event.target.value);
    if (!nextCategory) {
      return;
    }
    const nextVariables = buildVariablesForCategory(nextCategory, config.metadata.variables);
    const nextMode = getGameModeForCategory(nextCategory, nextVariables);

    updateMetadata({
      gameName: "Subnautica",
      categoryName: nextCategory.categoryName,
      variables: nextVariables
    });
    setGlobalSettings(buildDefaultSettingsForGameMode(nextMode));
    setPresetId("");
  };

  const onVariableChange = (key: string, value: string) => {
    const nextVariables = buildVariablesForCategory(selectedCategory, {
      ...config.metadata.variables,
      [key]: value
    });
    updateMetadata({
      gameName: "Subnautica",
      categoryName: selectedCategory.categoryName,
      variables: nextVariables
    });

    if (key === "Game Mode") {
      const nextMode = getGameModeForCategory(selectedCategory, nextVariables);
      setGlobalSettings(buildDefaultSettingsForGameMode(nextMode));
    }
  };

  const onResetDefaults = () => {
    const defaultCategory = getDefaultCategory();
    const defaultVariables = buildVariablesForCategory(defaultCategory);

    updateMetadata({
      gameName: "Subnautica",
      categoryName: defaultCategory.categoryName,
      variables: defaultVariables,
      offset: "00:00:00"
    });
    setPresetId("");
  };

  const onResetSettingsDefaults = () => {
    const gameMode = getGameModeForCategory(selectedCategory, config.metadata.variables);
    setGlobalSettings(buildDefaultSettingsForGameMode(gameMode));
  };

  return (
    <div className="glass-panel run-panel">
      <h2>Run Setup</h2>

      <label>
        Preset
        <select value={presetId} onChange={onPresetChange}>
          <option value="">None</option>
          {[...groupedPresets.entries()].map(([group, entries]) => (
            <optgroup key={group} label={group}>
              {entries.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label>
        Category
        <select value={selectedCategory.id} onChange={onCategoryChange}>
          {CATEGORY_GROUP_ORDER.map((group) => (
            <optgroup key={group} label={group}>
              {subnauticaCategories
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="muted">
        Subcategory Variables: {selectedCategory.variableDefinitions.length}
      </div>
      {selectedCategory.variableDefinitions.length === 0 && (
        <div className="muted">None</div>
      )}

      {selectedCategory.variableDefinitions.map((definition) => (
        <label key={definition.key}>
          {definition.label}
          <select
            value={config.metadata.variables[definition.key] ?? definition.options[0] ?? ""}
            onChange={(event) => onVariableChange(definition.key, event.target.value)}
          >
            {definition.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ))}

      {fixedVariableEntries.map(([key, value]) => (
        <label key={key}>
          {key}
          <input type="text" value={value} disabled />
        </label>
      ))}

      <label>
        Timer Start Offset
        <input
          type="text"
          value={config.metadata.offset}
          onChange={(event) => updateMetadata({ offset: event.target.value })}
        />
      </label>

      <h3>AutoSplitter Settings</h3>
      <div className="settings-grid">
        {settingLabels.map((entry) => {
          return (
            <label
              key={entry.key}
              className="checkbox-row"
              title={SETTINGS_TOOLTIPS[entry.key]}
            >
              <input
                type="checkbox"
                checked={config.globalSettings[entry.key]}
                onChange={(event) => updateGlobalSetting(entry.key, event.target.checked)}
              />
              {entry.label}
            </label>
          );
        })}
      </div>

      <div className="reset-actions">
        <button type="button" onClick={onResetDefaults}>
          Reset Run Setup to Default
        </button>
        <button type="button" onClick={onResetSettingsDefaults}>
          Reset Settings to Default
        </button>
      </div>
    </div>
  );
}
