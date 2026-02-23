import { createId } from "./id";
import {
  SubnauticaSplitKind,
  SubnauticaSplitNode
} from "../types/model";

export interface SplitRef {
  node: SubnauticaSplitNode;
  parentId: string | null;
}

function mapSplitTree(
  nodes: SubnauticaSplitNode[],
  fn: (node: SubnauticaSplitNode) => SubnauticaSplitNode
): SubnauticaSplitNode[] {
  return nodes.map((node) => {
    const next = fn(node);
    return {
      ...next,
      conditions: mapSplitTree(next.conditions, fn)
    };
  });
}

export function findSplitById(
  nodes: SubnauticaSplitNode[],
  id: string,
  parentId: string | null = null
): SplitRef | null {
  for (const node of nodes) {
    if (node.id === id) {
      return { node, parentId };
    }
    const child = findSplitById(node.conditions, id, node.id);
    if (child) {
      return child;
    }
  }
  return null;
}

export function updateSplitById(
  nodes: SubnauticaSplitNode[],
  id: string,
  updater: (node: SubnauticaSplitNode) => SubnauticaSplitNode
): SubnauticaSplitNode[] {
  return mapSplitTree(nodes, (node) => {
    if (node.id !== id) {
      return node;
    }
    return updater(node);
  });
}

export function removeSplitById(
  nodes: SubnauticaSplitNode[],
  id: string
): SubnauticaSplitNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      conditions: removeSplitById(node.conditions, id)
    }));
}

export function addConditionToSplit(
  nodes: SubnauticaSplitNode[],
  parentId: string,
  newNode: SubnauticaSplitNode
): SubnauticaSplitNode[] {
  return updateSplitById(nodes, parentId, (node) => ({
    ...node,
    conditions: [...node.conditions, newNode]
  }));
}

export function reorderWithinSameList<T extends { id: string }>(
  list: T[],
  activeId: string,
  overId: string
): T[] {
  const oldIndex = list.findIndex((item) => item.id === activeId);
  const newIndex = list.findIndex((item) => item.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return list;
  }
  const copy = [...list];
  const [item] = copy.splice(oldIndex, 1);
  if (!item) {
    return list;
  }
  copy.splice(newIndex, 0, item);
  return copy;
}

export function reorderTopLevel(
  nodes: SubnauticaSplitNode[],
  activeId: string,
  overId: string
): SubnauticaSplitNode[] {
  return reorderWithinSameList(nodes, activeId, overId);
}

export function reorderConditions(
  nodes: SubnauticaSplitNode[],
  parentId: string,
  activeId: string,
  overId: string
): SubnauticaSplitNode[] {
  return updateSplitById(nodes, parentId, (node) => ({
    ...node,
    conditions: reorderWithinSameList(node.conditions, activeId, overId)
  }));
}

export function canAddCondition(parentKind: SubnauticaSplitKind): boolean {
  return (
    parentKind === "prefab" ||
    parentKind === "inventory" ||
    parentKind === "blueprint" ||
    parentKind === "encyclopedia" ||
    parentKind === "biome"
  );
}

function createSplitBase(isSubCondition: boolean) {
  return {
    id: createId(),
    displayNameOverride: "",
    iconData: "",
    onlySplitOnce: true,
    isSubCondition,
    conditions: []
  };
}

export function createSplitNode(
  kind: SubnauticaSplitKind,
  isSubCondition: boolean
): SubnauticaSplitNode {
  const common = createSplitBase(isSubCondition);
  switch (kind) {
    case "manual":
      return {
        ...common,
        kind: "manual"
      };
    case "inventory":
      return {
        ...common,
        kind: "inventory",
        itemId: "Quartz",
        pickUp: true,
        isCount: false,
        count: 1
      };
    case "blueprint":
      return {
        ...common,
        kind: "blueprint",
        blueprintId: "Titanium"
      };
    case "encyclopedia":
      return {
        ...common,
        kind: "encyclopedia",
        encyclopediaId: "CuteFish"
      };
    case "biome":
      return {
        ...common,
        kind: "biome",
        fromBiomeId: "Any",
        toBiomeId: "SafeShallows"
      };
    case "craft":
      return {
        ...common,
        kind: "craft",
        craftableId: "FiberMesh"
      };
    case "legacy-raw":
      return {
        ...common,
        kind: "legacy-raw",
        rawName: "UnknownSplit",
        rawValue: "Unknown"
      };
    case "prefab":
    default:
      return {
        ...common,
        kind: "prefab",
        prefabId: "RocketSplit"
      };
  }
}

export function getNodeLabel(node: SubnauticaSplitNode): string {
  if (node.displayNameOverride) {
    return node.displayNameOverride;
  }

  switch (node.kind) {
    case "prefab":
      return node.prefabId;
    case "manual":
      return "Manual Split";
    case "inventory":
      if (node.isSubCondition) {
        return node.isCount
          ? `Have ${node.count} ${node.itemId}`
          : `Have ${node.itemId}`;
      }
      return `${node.pickUp ? "Pickup" : "Drop"} ${node.itemId}`;
    case "blueprint":
      return node.isSubCondition
        ? `${node.blueprintId} already unlocked`
        : `${node.blueprintId} unlock`;
    case "encyclopedia":
      return node.isSubCondition
        ? `${node.encyclopediaId} already discovered`
        : `${node.encyclopediaId} databank entry`;
    case "biome":
      return `${node.fromBiomeId} -> ${node.toBiomeId}`;
    case "craft":
      return `Craft ${node.craftableId}`;
    case "legacy-raw":
      return `Legacy: ${node.rawName}`;
    default:
      return "Split";
  }
}
