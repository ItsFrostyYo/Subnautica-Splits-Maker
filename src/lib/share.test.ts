import { beforeEach, describe, expect, it } from "vitest";
import { createBlankConfig } from "../store/useAppStore";
import { buildShareUrl, decodeShareConfig, encodeShareConfig, getShareParam } from "./share";

describe("share url", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/SubnauticaSplitsMaker/index.html");
  });

  it("builds a canonical github pages compatible share link", () => {
    const result = buildShareUrl(createBlankConfig());
    const url = result.url;
    expect(url.includes("/SubnauticaSplitsMaker/")).toBe(true);
    expect(url.includes("index.html")).toBe(false);
    expect(url.includes("#share=")).toBe(true);
    expect(url.includes("?share=")).toBe(false);
    expect(result.iconsStripped).toBe(false);
  });

  it("reads share payload from hash", () => {
    window.history.replaceState({}, "", "/SubnauticaSplitsMaker/#share=abc123");
    expect(getShareParam()).toBe("abc123");
  });

  it("supports legacy query-string share payload", () => {
    window.history.replaceState({}, "", "/SubnauticaSplitsMaker/?share=legacy123");
    expect(getShareParam()).toBe("legacy123");
  });

  it("round-trips config with icon data using compact share format", () => {
    const config = createBlankConfig();
    config.splits = [
      {
        id: "node-1",
        kind: "inventory",
        itemId: "Titanium",
        pickUp: true,
        isCount: true,
        count: 2,
        onlySplitOnce: true,
        isSubCondition: false,
        displayNameOverride: "Grab Titanium",
        iconData: "data:image/png;base64,AAAA",
        conditions: []
      }
    ];

    const encoded = encodeShareConfig(config);
    expect(encoded.startsWith("v2:")).toBe(true);
    expect(decodeShareConfig(encoded)).toEqual(config);
  });
});
