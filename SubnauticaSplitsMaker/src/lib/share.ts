import LZString from "lz-string";
import { SubnauticaRunConfig } from "../types/model";

const SHARE_PARAM = "share";

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

export function buildShareUrl(config: SubnauticaRunConfig): string {
  const url = getCanonicalBaseUrl();
  url.searchParams.set(SHARE_PARAM, encodeShareConfig(config));
  return url.toString();
}

export function getShareParam(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get(SHARE_PARAM);
}

export function clearShareParamFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState({}, document.title, url.toString());
}
