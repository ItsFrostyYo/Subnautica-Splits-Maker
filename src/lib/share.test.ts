import { beforeEach, describe, expect, it } from "vitest";
import { createBlankConfig } from "../store/useAppStore";
import { buildShareUrl } from "./share";

describe("share url", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/SubnauticaSplitsMaker/index.html");
  });

  it("builds a canonical github pages compatible share link", () => {
    const result = buildShareUrl(createBlankConfig());
    const url = result.url;
    expect(url.includes("/SubnauticaSplitsMaker/")).toBe(true);
    expect(url.includes("index.html")).toBe(false);
    expect(url.includes("share=")).toBe(true);
    expect(result.iconsStripped).toBe(false);
  });
});
