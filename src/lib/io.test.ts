import { describe, expect, it } from "vitest";
import { buildSuggestedFilename, resolveLssFilename } from "./io";
import { SubnauticaRunConfig } from "../types/model";

const baseConfig: SubnauticaRunConfig = {
  configVersion: 1,
  metadata: {
    gameName: "Subnautica",
    categoryName: "Any%",
    variables: {},
    offset: "00:00:00"
  },
  globalSettings: {
    IntroStart: true,
    CreativeStart: false,
    Reset: true,
    AskForGoldSave: false,
    SRCLoadtimes: false,
    OrderedLiveSplit: true,
    OrderedAutoSplits: false
  },
  splits: []
};

describe("buildSuggestedFilename", () => {
  it("puts game mode first, then run type, then remaining variables", () => {
    const filename = buildSuggestedFilename({
      ...baseConfig,
      metadata: {
        ...baseConfig.metadata,
        categoryName: "No Damage",
        variables: {
          "Run Type": "Glitched",
          "Game Mode": "Survival",
          "Special Rule": "No Coffee"
        }
      }
    });

    expect(filename).toBe("Subnautica - No Damage Survival Glitched No Coffee.lss");
  });

  it("resolves custom filename while enforcing .lss extension and safe characters", () => {
    const fallback = "Subnautica - Any% Survival Glitched.lss";

    expect(resolveLssFilename("My Route", fallback)).toBe("My Route.lss");
    expect(resolveLssFilename("My Route.lss", fallback)).toBe("My Route.lss");
    expect(resolveLssFilename("My:Route*", fallback)).toBe("My Route.lss");
    expect(resolveLssFilename("", fallback)).toBe(fallback);
  });
});
