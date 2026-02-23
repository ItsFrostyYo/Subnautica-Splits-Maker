import splitDefinitionsRaw from "./split-definitions.json";
import biomeRaw from "./enum-biome.json";
import craftableRaw from "./enum-craftable.json";
import inventoryRaw from "./enum-inventory.json";
import unlockableRaw from "./enum-unlockable.json";
import encyclopediaRaw from "./enum-ency.json";
import {
  enumOptionsFileSchema,
  splitDefinitionsFileSchema
} from "./validators";

function humanizeBiomeId(id: string): string {
  if (id === "Any") {
    return "Any";
  }

  const normalized = id
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();

  if (!normalized) {
    return id;
  }

  const acronymSet = new Set(["ALZ", "ILZ", "PCF", "QEP", "PDA", "O2"]);
  return normalized
    .split(/\s+/)
    .map((token) => {
      if (!token) {
        return token;
      }
      const upper = token.toUpperCase();
      if (acronymSet.has(upper)) {
        return upper;
      }
      if (/^\d+$/.test(token)) {
        return token;
      }
      return `${token.slice(0, 1).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export const splitDefinitions = splitDefinitionsFileSchema.parse(
  splitDefinitionsRaw
);
export const biomeOptions = enumOptionsFileSchema.parse(biomeRaw).map((option) => ({
  ...option,
  label: humanizeBiomeId(option.id)
}));
export const craftableOptions = enumOptionsFileSchema.parse(craftableRaw);
export const inventoryOptions = enumOptionsFileSchema.parse(inventoryRaw);
export const unlockableOptions = enumOptionsFileSchema.parse(unlockableRaw);
export const encyclopediaOptions = enumOptionsFileSchema.parse(encyclopediaRaw);
