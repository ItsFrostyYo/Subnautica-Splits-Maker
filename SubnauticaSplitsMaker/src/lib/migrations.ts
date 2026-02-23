import {
  CURRENT_CONFIG_VERSION,
  ImportWarning,
  SubnauticaRunConfig
} from "../types/model";
import { parseRunConfigOrThrow } from "./configSchema";

interface LegacyConfigV0 {
  metadata?: SubnauticaRunConfig["metadata"];
  globalSettings?: SubnauticaRunConfig["globalSettings"];
  splits?: SubnauticaRunConfig["splits"];
}

export function migrateConfig(
  input: unknown,
  fromVersion?: number,
  toVersion: number = CURRENT_CONFIG_VERSION
): { config: SubnauticaRunConfig; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const asRecord = input as Record<string, unknown>;
  const version = fromVersion ?? Number(asRecord?.configVersion ?? 0);

  if (!version) {
    const legacy = input as LegacyConfigV0;
    const migrated: SubnauticaRunConfig = {
      configVersion: toVersion as typeof CURRENT_CONFIG_VERSION,
      metadata: legacy.metadata ?? {
        gameName: "Subnautica",
        categoryName: "Imported Category",
        variables: {},
        offset: "00:00:00"
      },
      globalSettings: legacy.globalSettings ?? {
        IntroStart: true,
        CreativeStart: false,
        Reset: true,
        AskForGoldSave: false,
        SRCLoadtimes: false,
        OrderedLiveSplit: true,
        OrderedAutoSplits: false
      },
      splits: legacy.splits ?? []
    };
    warnings.push({
      code: "migration-applied",
      message: `Imported legacy config and upgraded it to configVersion ${toVersion}.`
    });
    return { config: parseRunConfigOrThrow(migrated), warnings };
  }

  if (version !== toVersion) {
    throw new Error(
      `Unsupported configVersion ${version}. Expected ${toVersion}.`
    );
  }

  return { config: parseRunConfigOrThrow(input), warnings };
}
