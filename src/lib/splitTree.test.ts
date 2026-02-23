import { describe, expect, it } from "vitest";
import {
  canAddCondition,
  createSplitNode,
  reorderWithinSameList
} from "../lib/splitTree";

describe("splitTree", () => {
  it("creates sub condition nodes", () => {
    const node = createSplitNode("inventory", true);
    expect(node.kind).toBe("inventory");
    expect(node.isSubCondition).toBe(true);
  });

  it("reorders lists deterministically", () => {
    const a = createSplitNode("prefab", false);
    const b = createSplitNode("prefab", false);
    const c = createSplitNode("prefab", false);
    const result = reorderWithinSameList([a, b, c], c.id, a.id);
    const first = result[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("Expected first result entry to exist");
    }
    expect(first.id).toBe(c.id);
  });

  it("only allows sub-conditions on supported parent kinds", () => {
    expect(canAddCondition("prefab")).toBe(true);
    expect(canAddCondition("inventory")).toBe(true);
    expect(canAddCondition("blueprint")).toBe(true);
    expect(canAddCondition("encyclopedia")).toBe(true);
    expect(canAddCondition("biome")).toBe(true);
    expect(canAddCondition("craft")).toBe(false);
    expect(canAddCondition("legacy-raw")).toBe(false);
  });
});
