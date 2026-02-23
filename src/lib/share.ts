import LZString from "lz-string";
import { SubnauticaRunConfig, SubnauticaSplitKind, SubnauticaSplitNode } from "../types/model";

const SHARE_PARAM = "share";
const SHARE_URL_MAX_LENGTH = 30000;
const SHARE_FORMAT_V2_PREFIX = "v2:";

const KIND_TO_CODE: Record<SubnauticaSplitKind, string> = {
  prefab: "p",
  manual: "m",
  inventory: "i",
  blueprint: "b",
  encyclopedia: "e",
  biome: "o",
  craft: "c",
  "legacy-raw": "l"
};

const CODE_TO_KIND: Record<string, SubnauticaSplitKind> = Object.fromEntries(
  Object.entries(KIND_TO_CODE).map(([kind, code]) => [code, kind as SubnauticaSplitKind])
) as Record<string, SubnauticaSplitKind>;

type PackedNodeV2 = [
  id: string,
  kindCode: string,
  displayNameOverride: string | null,
  iconIndex: number,
  onlySplitOnce: 0 | 1,
  isSubCondition: 0 | 1,
  payload: unknown,
  conditions: PackedNodeV2[]
];

type PackedConfigV2 = [
  marker: "s2",
  configVersion: number,
  metadata: [gameName: string, categoryName: string, offset: string, variables: [string, string][]],
  globalSettingsMask: number,
  iconTable: string[],
  splits: PackedNodeV2[]
];

function getCanonicalBaseUrl(): URL {
  const { origin, pathname } = window.location;
  const pathWithoutIndex = pathname.replace(/\/index\.html$/i, "/");
  return new URL(pathWithoutIndex, origin);
}

export function encodeShareConfig(config: SubnauticaRunConfig): string {
  const packed = packConfigV2(config);
  return `${SHARE_FORMAT_V2_PREFIX}${LZString.compressToEncodedURIComponent(
    JSON.stringify(packed)
  )}`;
}

export function decodeShareConfig(value: string): SubnauticaRunConfig {
  if (value.startsWith(SHARE_FORMAT_V2_PREFIX)) {
    const compressed = value.slice(SHARE_FORMAT_V2_PREFIX.length);
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) {
      throw new Error("Invalid share payload");
    }
    const packed = JSON.parse(decompressed) as PackedConfigV2;
    return unpackConfigV2(packed);
  }

  const decompressed = LZString.decompressFromEncodedURIComponent(value);
  if (!decompressed) {
    throw new Error("Invalid share payload");
  }
  return JSON.parse(decompressed) as SubnauticaRunConfig;
}

interface ShareBuildResult {
  url: string;
  iconsStripped: boolean;
}

function getSettingsMask(config: SubnauticaRunConfig): number {
  const g = config.globalSettings;
  return (
    (g.IntroStart ? 1 : 0) |
    (g.CreativeStart ? 1 << 1 : 0) |
    (g.Reset ? 1 << 2 : 0) |
    (g.AskForGoldSave ? 1 << 3 : 0) |
    (g.SRCLoadtimes ? 1 << 4 : 0) |
    (g.OrderedLiveSplit ? 1 << 5 : 0) |
    (g.OrderedAutoSplits ? 1 << 6 : 0)
  );
}

function maskToSettings(mask: number): SubnauticaRunConfig["globalSettings"] {
  return {
    IntroStart: Boolean(mask & 1),
    CreativeStart: Boolean(mask & (1 << 1)),
    Reset: Boolean(mask & (1 << 2)),
    AskForGoldSave: Boolean(mask & (1 << 3)),
    SRCLoadtimes: Boolean(mask & (1 << 4)),
    OrderedLiveSplit: Boolean(mask & (1 << 5)),
    OrderedAutoSplits: Boolean(mask & (1 << 6))
  };
}

function packNodeV2(node: SubnauticaSplitNode, iconIndexes: Map<string, number>): PackedNodeV2 {
  const displayName = node.displayNameOverride || null;
  const iconData = node.iconData || "";
  const iconIndex = iconData ? (iconIndexes.get(iconData) ?? -1) : -1;
  const kindCode = KIND_TO_CODE[node.kind];
  const payload = (() => {
    switch (node.kind) {
      case "prefab":
        return node.prefabId;
      case "manual":
        return null;
      case "inventory":
        return [node.itemId, node.pickUp ? 1 : 0, node.isCount ? 1 : 0, node.count];
      case "blueprint":
        return node.blueprintId;
      case "encyclopedia":
        return node.encyclopediaId;
      case "biome":
        return [node.fromBiomeId, node.toBiomeId];
      case "craft":
        return node.craftableId;
      case "legacy-raw":
        return [node.rawName, node.rawValue];
      default:
        return null;
    }
  })();

  return [
    node.id,
    kindCode,
    displayName,
    iconIndex,
    node.onlySplitOnce ? 1 : 0,
    node.isSubCondition ? 1 : 0,
    payload,
    node.conditions.map((condition) => packNodeV2(condition, iconIndexes))
  ];
}

function unpackNodeV2(packed: PackedNodeV2, icons: string[]): SubnauticaSplitNode {
  const [id, kindCode, displayNameOverride, iconIndex, onlySplitOnce, isSubCondition, payload, rawConditions] =
    packed;
  const kind = CODE_TO_KIND[kindCode];
  if (!kind) {
    throw new Error(`Unknown share split kind: ${kindCode}`);
  }

  const base = {
    id,
    kind,
    displayNameOverride: displayNameOverride ?? undefined,
    iconData: iconIndex >= 0 ? (icons[iconIndex] ?? "") : undefined,
    onlySplitOnce: Boolean(onlySplitOnce),
    isSubCondition: Boolean(isSubCondition),
    conditions: rawConditions.map((condition) => unpackNodeV2(condition, icons))
  };

  switch (kind) {
    case "prefab":
      return { ...base, kind, prefabId: (payload as string) ?? "" };
    case "manual":
      return { ...base, kind };
    case "inventory": {
      const [itemId, pickUp, isCount, count] = (payload as [string, 0 | 1, 0 | 1, number]) ?? [
        "",
        0,
        0,
        0
      ];
      return {
        ...base,
        kind,
        itemId,
        pickUp: Boolean(pickUp),
        isCount: Boolean(isCount),
        count: Number.isFinite(count) ? count : 0
      };
    }
    case "blueprint":
      return { ...base, kind, blueprintId: (payload as string) ?? "" };
    case "encyclopedia":
      return { ...base, kind, encyclopediaId: (payload as string) ?? "" };
    case "biome": {
      const [fromBiomeId, toBiomeId] = (payload as [string, string]) ?? ["", ""];
      return { ...base, kind, fromBiomeId, toBiomeId };
    }
    case "craft":
      return { ...base, kind, craftableId: (payload as string) ?? "" };
    case "legacy-raw": {
      const [rawName, rawValue] = (payload as [string, string]) ?? ["", ""];
      return { ...base, kind, rawName, rawValue };
    }
    default:
      return { ...base, kind: "manual" };
  }
}

function packConfigV2(config: SubnauticaRunConfig): PackedConfigV2 {
  const iconTable = [...new Set(collectIcons(config.splits))];
  const iconIndexes = new Map(iconTable.map((icon, index) => [icon, index]));
  return [
    "s2",
    config.configVersion,
    [
      config.metadata.gameName,
      config.metadata.categoryName,
      config.metadata.offset,
      Object.entries(config.metadata.variables)
    ],
    getSettingsMask(config),
    iconTable,
    config.splits.map((split) => packNodeV2(split, iconIndexes))
  ];
}

function unpackConfigV2(packed: PackedConfigV2): SubnauticaRunConfig {
  const [marker, configVersion, metadata, globalSettingsMask, iconTable, splits] = packed;
  if (marker !== "s2") {
    throw new Error("Unsupported share payload format");
  }

  const [gameName, categoryName, offset, variables] = metadata;
  return {
    configVersion: configVersion as SubnauticaRunConfig["configVersion"],
    metadata: {
      gameName,
      categoryName,
      offset,
      variables: Object.fromEntries(variables)
    },
    globalSettings: maskToSettings(globalSettingsMask),
    splits: splits.map((split) => unpackNodeV2(split, iconTable))
  };
}

function collectIcons(nodes: SubnauticaSplitNode[]): string[] {
  const output: string[] = [];
  const walk = (node: SubnauticaSplitNode) => {
    if (node.iconData) {
      output.push(node.iconData);
    }
    node.conditions.forEach((condition) => walk(condition));
  };
  nodes.forEach((node) => walk(node));
  return output;
}

function stripIconsFromConfig(config: SubnauticaRunConfig): SubnauticaRunConfig {
  const stripNodeIcons = (
    node: SubnauticaRunConfig["splits"][number]
  ): SubnauticaRunConfig["splits"][number] => ({
    ...node,
    iconData: "",
    conditions: node.conditions.map((condition) => stripNodeIcons(condition))
  });

  return {
    ...config,
    splits: config.splits.map((split) => stripNodeIcons(split))
  };
}

function buildUrl(config: SubnauticaRunConfig): string {
  const url = getCanonicalBaseUrl();
  const shareValue = encodeShareConfig(config);
  // Keep payload in hash so large share data never hits CDN/server URL limits.
  url.hash = `${SHARE_PARAM}=${shareValue}`;
  return url.toString();
}

export function buildShareUrl(config: SubnauticaRunConfig): ShareBuildResult {
  const fullUrl = buildUrl(config);
  if (fullUrl.length <= SHARE_URL_MAX_LENGTH) {
    return { url: fullUrl, iconsStripped: false };
  }

  const noIconsConfig = stripIconsFromConfig(config);
  const strippedUrl = buildUrl(noIconsConfig);
  if (strippedUrl.length <= SHARE_URL_MAX_LENGTH) {
    return { url: strippedUrl, iconsStripped: true };
  }

  throw new Error("Share URL is too large even after compression and icon stripping.");
}

export function getShareParam(): string | null {
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const shareFromHash = hashParams.get(SHARE_PARAM);
  if (shareFromHash) {
    return shareFromHash;
  }
  // Backward compatibility for older links using ?share=...
  return url.searchParams.get(SHARE_PARAM);
}

export function clearShareParamFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_PARAM);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  hashParams.delete(SHARE_PARAM);
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  window.history.replaceState({}, document.title, url.toString());
}
