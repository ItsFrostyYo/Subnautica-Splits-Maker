import { describe, expect, it } from "vitest";
import { migrateConfig } from "./migrations";

describe("migrations", () => {
  it("upgrades legacy config without version", () => {
    const legacy = {
      metadata: {
        gameName: "Subnautica",
        categoryName: "Any%",
        variables: {},
        offset: "00:00:00"
      },
      globalSettings: {
        IntroStart: true,
        CreativeStart: true,
        Reset: false,
        AskForGoldSave: false,
        SRCLoadtimes: true,
        OrderedLiveSplit: false,
        OrderedAutoSplits: false
      },
      splits: []
    };

    const result = migrateConfig(legacy);
    expect(result.config.configVersion).toBe(1);
    expect(result.warnings[0]?.code).toBe("migration-applied");
  });
});
