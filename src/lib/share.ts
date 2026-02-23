import LZString from "lz-string";
import { SubnauticaRunConfig } from "../types/model";

const SHARE_PARAM = "share";
const SHARE_URL_MAX_LENGTH = 1800;

function getCanonicalBaseUrl(): URL {
  const { origin, pathname } = window.location;
  const pathWithoutIndex = pathname.replace(/\/index\.html$/i, "/");
  return new URL(pathWithoutIndex, origin);
}

export function encodeShareConfig(config: SubnauticaRunConfig): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(config));
}

export function decodeShareConfig(value: string): SubnauticaRunConfig {
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

  throw new Error("Share URL is too large for browsers/CDN even without icons.");
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
