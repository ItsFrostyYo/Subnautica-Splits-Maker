# Data Model

## Root Config

`SubnauticaRunConfig`:

- `configVersion: 1`
- `metadata`
  - `gameName: string`
  - `categoryName: string`
  - `variables: Record<string, string>`
  - `offset: string`
- `globalSettings`
  - `IntroStart`
  - `CreativeStart`
  - `Reset`
  - `AskForGoldSave`
  - `SRCLoadtimes`
  - `OrderedLiveSplit`
  - `OrderedAutoSplits`
- `splits: SubnauticaSplitNode[]`

## Split Nodes

Discriminated union by `kind`:

- `prefab`
- `inventory`
- `blueprint`
- `encyclopedia`
- `biome`
- `craft`
- `legacy-raw`

Shared fields:

- `id`
- `displayNameOverride`
- `iconData`
- `onlySplitOnce`
- `isSubCondition`
- `conditions: SubnauticaSplitNode[]`

## LSS XML Mapping

Each split maps to:

- `<Name>`
- `<Value>`
- `<OnlySplitOnce>`
- `<IsSubCondition>`
- optional nested `<Conditions><Split>...</Split></Conditions>`

`Name`/`Value` rules:

- `prefab`: `Name = prefabId`, `Value = prefabId`
- `inventory`: `Name = Inventory`, `Value = itemId:pickUp:isCount:count`
- `blueprint`: `Name = Blueprint`, `Value = blueprintId`
- `encyclopedia`: `Name = Encyclopedia`, `Value = encyclopediaId`
- `biome`: `Name = Biome`, `Value = fromBiomeId:toBiomeId`
- `craft`: `Name = Craft`, `Value = craftableId`
- `legacy-raw`: `Name = rawName`, `Value = rawValue`

## Import Warnings

Warnings are emitted for:

- Unknown split names
- Unknown enum values
- Legacy mapping fallback
- Migration steps

## Versioning and Migrations

- Current version: `1`.
- Inputs without `configVersion` are treated as legacy and upgraded.
- Future migrations should be implemented in `src/lib/migrations.ts`.
