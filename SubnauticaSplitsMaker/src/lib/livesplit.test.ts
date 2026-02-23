import { describe, expect, it } from "vitest";
import { exportToLss, importFromLss } from "./livesplit";
import { SubnauticaRunConfig } from "../types/model";

const sampleConfig: SubnauticaRunConfig = {
  configVersion: 1,
  metadata: {
    gameName: "Subnautica",
    categoryName: "Any%",
    variables: { Difficulty: "Survival" },
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
  splits: [
    {
      id: "s1",
      kind: "inventory",
      itemId: "Quartz",
      pickUp: true,
      isCount: false,
      count: 1,
      displayNameOverride: "Get Quartz",
      iconData: "",
      onlySplitOnce: true,
      isSubCondition: false,
      conditions: [
        {
          id: "s1c1",
          kind: "biome",
          fromBiomeId: "Any",
          toBiomeId: "SafeShallows",
          displayNameOverride: "",
          iconData: "",
          onlySplitOnce: true,
          isSubCondition: true,
          conditions: []
        }
      ]
    }
  ]
};

describe("livesplit import/export", () => {
  it("exports XML with expected settings keys", () => {
    const xml = exportToLss(sampleConfig);
    expect(xml).toContain("<IntroStart>True</IntroStart>");
    expect(xml).toContain("<CreativeStart>True</CreativeStart>");
    expect(xml).toContain("<Name>Inventory</Name>");
    expect(xml).toContain("<Value>Quartz:True:False:1</Value>");
  });

  it("round-trips inventory + nested biome conditions", () => {
    const xml = exportToLss(sampleConfig);
    const imported = importFromLss(xml);

    expect(imported.config.splits).toHaveLength(1);
    const split = imported.config.splits[0];
    expect(split).toBeDefined();
    if (!split) {
      throw new Error("Expected imported split to be defined");
    }
    expect(split.kind).toBe("inventory");
    if (split.kind === "inventory") {
      expect(split.itemId).toBe("Quartz");
      expect(split.conditions).toHaveLength(1);
      const condition = split.conditions[0];
      expect(condition).toBeDefined();
      if (!condition) {
        throw new Error("Expected imported condition to be defined");
      }
      expect(condition.kind).toBe("biome");
    }
  });

  it("preserves unknown split as legacy-raw", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Run version="1.7.0">
  <GameName>Subnautica</GameName>
  <CategoryName>Test</CategoryName>
  <Metadata><Run id="" /><Platform usesEmulator="False" /><Variables /></Metadata>
  <Offset>00:00:00</Offset>
  <AttemptCount>0</AttemptCount>
  <AttemptHistory />
  <Segments />
  <AutoSplitterSettings>
    <IntroStart>True</IntroStart>
    <CreativeStart>True</CreativeStart>
    <Reset>False</Reset>
    <AskForGoldSave>False</AskForGoldSave>
    <SRCLoadtimes>True</SRCLoadtimes>
    <OrderedLiveSplit>False</OrderedLiveSplit>
    <OrderedAutoSplits>False</OrderedAutoSplits>
    <Splits>
      <Split>
        <OnlySplitOnce>True</OnlySplitOnce>
        <IsSubCondition>False</IsSubCondition>
        <Name>UnknownSplitType</Name>
        <Value>abc</Value>
      </Split>
    </Splits>
  </AutoSplitterSettings>
</Run>`;

    const imported = importFromLss(xml);
    const split = imported.config.splits[0];
    expect(split).toBeDefined();
    if (!split) {
      throw new Error("Expected imported split to be defined");
    }
    expect(split.kind).toBe("legacy-raw");
    expect(imported.warnings.length).toBeGreaterThan(0);
  });

  it("supports manual split nodes through lss round-trip", () => {
    const manualConfig: SubnauticaRunConfig = {
      ...sampleConfig,
      splits: [
        {
          id: "manual-s1",
          kind: "manual",
          displayNameOverride: "Manual Segment",
          iconData: "",
          onlySplitOnce: true,
          isSubCondition: false,
          conditions: []
        }
      ]
    };

    const xml = exportToLss(manualConfig);
    expect(xml).toContain("<Name>None</Name>");
    expect(xml).toContain("<Value>None</Value>");

    const imported = importFromLss(xml);
    const split = imported.config.splits[0];
    expect(split).toBeDefined();
    if (!split) {
      throw new Error("Expected imported split to be defined");
    }
    expect(split.kind).toBe("manual");
  });

  it("embeds and restores segment icon data", () => {
    const configWithIcon: SubnauticaRunConfig = {
      ...sampleConfig,
      splits: [
        {
          id: "s-icon",
          kind: "prefab",
          prefabId: "RocketSplit",
          displayNameOverride: "Rocket Launch",
          iconData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBg7Sxr9wAAAAASUVORK5CYII=",
          onlySplitOnce: true,
          isSubCondition: false,
          conditions: []
        }
      ]
    };

    const xml = exportToLss(configWithIcon);
    expect(xml).toMatch(/<Icon>\s*<!\[CDATA\[/);
    expect(xml).toContain(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBg7Sxr9wAAAAASUVORK5CYII="
    );

    const imported = importFromLss(xml);
    const split = imported.config.splits[0];
    expect(split).toBeDefined();
    if (!split) {
      throw new Error("Expected imported split to be defined");
    }
    expect(split.iconData).toBe(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBg7Sxr9wAAAAASUVORK5CYII="
    );
  });

  it("collapses legacy Gantry+Rocket tail pair when there is only one launch segment", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Run version="1.7.0">
  <GameName>Subnautica</GameName>
  <CategoryName>Any%</CategoryName>
  <Metadata><Run id="" /><Platform usesEmulator="False" /><Variables /></Metadata>
  <Offset>00:00:00</Offset>
  <AttemptCount>0</AttemptCount>
  <AttemptHistory />
  <Segments>
    <Segment>
      <Name>Launch</Name>
      <Icon></Icon>
      <SplitTimes><SplitTime name="Personal Best" /></SplitTimes>
      <BestSegmentTime></BestSegmentTime>
      <SegmentHistory></SegmentHistory>
    </Segment>
  </Segments>
  <AutoSplitterSettings>
    <IntroStart>True</IntroStart>
    <CreativeStart>False</CreativeStart>
    <Reset>True</Reset>
    <AskForGoldSave>False</AskForGoldSave>
    <SRCLoadtimes>False</SRCLoadtimes>
    <OrderedLiveSplit>True</OrderedLiveSplit>
    <OrderedAutoSplits>False</OrderedAutoSplits>
    <Splits>
      <Split>
        <OnlySplitOnce>True</OnlySplitOnce>
        <IsSubCondition>False</IsSubCondition>
        <Name>GantrySplit</Name>
        <Value>GantrySplit</Value>
      </Split>
      <Split>
        <OnlySplitOnce>True</OnlySplitOnce>
        <IsSubCondition>False</IsSubCondition>
        <Name>RocketSplit</Name>
        <Value>RocketSplit</Value>
      </Split>
    </Splits>
  </AutoSplitterSettings>
</Run>`;

    const imported = importFromLss(xml);
    expect(imported.config.splits).toHaveLength(1);
    const split = imported.config.splits[0];
    expect(split).toBeDefined();
    if (!split || split.kind !== "prefab") {
      throw new Error("Expected imported split to be prefab.");
    }
    expect(split.prefabId).toBe("RocketSplit");
    expect(split.displayNameOverride).toBe("Launch");

    const exported = exportToLss(imported.config);
    expect(exported).toContain("<Name>RocketSplit</Name>");
    expect(exported).not.toContain("<Name>GantrySplit</Name>");
  });
});
