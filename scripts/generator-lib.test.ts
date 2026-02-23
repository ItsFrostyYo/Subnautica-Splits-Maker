import { describe, expect, it } from "vitest";
import {
  parseEnumMembers,
  parseLocalizationMap,
  parseSplitDefinitionsFromCode
} from "./generator-lib";

describe("generator-lib", () => {
  it("parses split definitions from C# attributes", () => {
    const source = `
      public enum SplitName {
        [Description("Inventory"), ToolTip("Inventory split")]
        Inventory,
        [Description("Rocket Launch"), ToolTip("Split when rocket launches")]
        RocketSplit,
      }
    `;

    const definitions = parseSplitDefinitionsFromCode(source);
    expect(definitions).toHaveLength(2);
    expect(definitions[0]).toMatchObject({ id: "Inventory", kind: "typed-inventory" });
    expect(definitions[1]).toMatchObject({ id: "RocketSplit", kind: "prefab" });
  });

  it("parses enum members including assigned values", () => {
    const source = `
      public enum Craftable {
        None = 0,
        FiberMesh = 3,
        Glass,
      }
    `;

    expect(parseEnumMembers(source, "Craftable")).toEqual([
      "None",
      "FiberMesh",
      "Glass"
    ]);
  });

  it("parses localization map with comments", () => {
    const source = `
      {
        // comment
        "FiberMesh": "Fiber Mesh",
        "Glass": "Glass"
      }
    `;

    const localization = parseLocalizationMap(source);
    expect(localization.FiberMesh).toBe("Fiber Mesh");
    expect(localization.Glass).toBe("Glass");
  });
});
