import { beforeEach, describe, expect, it } from "vitest";
import { createBlankConfig, useAppStore } from "./useAppStore";

function resetStore() {
  useAppStore.setState({
    config: createBlankConfig(),
    presetId: "",
    selectedSplitId: null,
    warnings: [],
    lastGeneratedLss: "",
    lastGeneratedJson: ""
  });
}

describe("useAppStore global setting rules", () => {
  beforeEach(() => {
    resetStore();
  });

  it("enforces IntroStart and CreativeStart as mutually exclusive", () => {
    const { updateGlobalSetting } = useAppStore.getState();

    updateGlobalSetting("CreativeStart", true);
    let settings = useAppStore.getState().config.globalSettings;
    expect(settings.CreativeStart).toBe(true);
    expect(settings.IntroStart).toBe(false);

    updateGlobalSetting("IntroStart", true);
    settings = useAppStore.getState().config.globalSettings;
    expect(settings.IntroStart).toBe(true);
    expect(settings.CreativeStart).toBe(false);
  });

  it("enforces ordered split modes as mutually exclusive", () => {
    const { updateGlobalSetting } = useAppStore.getState();

    updateGlobalSetting("OrderedAutoSplits", true);
    let settings = useAppStore.getState().config.globalSettings;
    expect(settings.OrderedAutoSplits).toBe(true);
    expect(settings.OrderedLiveSplit).toBe(false);

    updateGlobalSetting("OrderedLiveSplit", true);
    settings = useAppStore.getState().config.globalSettings;
    expect(settings.OrderedLiveSplit).toBe(true);
    expect(settings.OrderedAutoSplits).toBe(false);
  });
});

describe("useAppStore split tree actions", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds conditions to supported parent splits", () => {
    const { addTopLevelSplit, addConditionSplit } = useAppStore.getState();
    addTopLevelSplit("inventory");

    const split = useAppStore.getState().config.splits[0];
    expect(split).toBeDefined();
    if (!split) {
      throw new Error("Expected top-level split to be created");
    }

    addConditionSplit(split.id, "blueprint");

    const updated = useAppStore.getState().config.splits[0];
    expect(updated).toBeDefined();
    if (!updated) {
      throw new Error("Expected split to still exist");
    }
    expect(updated.conditions).toHaveLength(1);
    const condition = updated.conditions[0];
    expect(condition).toBeDefined();
    if (!condition) {
      throw new Error("Expected condition to be created");
    }
    expect(condition.kind).toBe("blueprint");
  });
});
