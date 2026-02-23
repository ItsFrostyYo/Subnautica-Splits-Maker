export type SplitDataKind =
  | "typed-none"
  | "typed-inventory"
  | "typed-blueprint"
  | "typed-encyclopedia"
  | "typed-biome"
  | "typed-craft"
  | "prefab";

export interface GeneratedSplitDefinition {
  id: string;
  description: string;
  tooltip: string;
  kind: SplitDataKind;
}

export interface GeneratedEnumOption {
  id: string;
  label: string;
}
