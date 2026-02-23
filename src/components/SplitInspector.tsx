import { ChangeEvent, useRef } from "react";
import {
  biomeOptions,
  craftableOptions,
  encyclopediaOptions,
  inventoryOptions,
  splitDefinitions,
  unlockableOptions
} from "../generated";
import { getSplitKindLabel } from "../lib/autosplitterTooltips";
import { findSplitById } from "../lib/splitTree";
import { useAppStore } from "../store/useAppStore";
import { SubnauticaSplitNode } from "../types/model";

const ICON_MAX_SIDE = 32;
const ICON_OUTPUT_FORMAT = "image/webp";
const ICON_OUTPUT_QUALITY = 0.82;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode icon image."));
    image.src = src;
  });
}

async function optimizeIconBase64(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const comma = dataUrl.indexOf(",");
  const fallbackBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  if (!dataUrl.startsWith("data:image/")) {
    return fallbackBase64;
  }

  try {
    const image = await loadImage(dataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      return fallbackBase64;
    }

    const scale = Math.min(1, ICON_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return fallbackBase64;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    const optimizedDataUrl = canvas.toDataURL(ICON_OUTPUT_FORMAT, ICON_OUTPUT_QUALITY);
    const optimizedComma = optimizedDataUrl.indexOf(",");
    return optimizedComma >= 0 ? optimizedDataUrl.slice(optimizedComma + 1) : fallbackBase64;
  } catch {
    return fallbackBase64;
  }
}

function updateIconData(
  event: ChangeEvent<HTMLInputElement>,
  onData: (base64: string) => void
) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  event.target.value = "";

  void optimizeIconBase64(file).then((base64) => {
    if (base64) {
      onData(base64);
    }
  });
}

function normalizeBase64(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function detectRawIconMime(base64: string): string | null {
  if (base64.startsWith("iVBOR")) {
    return "image/png";
  }
  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }
  if (base64.startsWith("R0lGOD")) {
    return "image/gif";
  }
  if (base64.startsWith("Qk")) {
    return "image/bmp";
  }
  if (base64.startsWith("PHN2Zy")) {
    return "image/svg+xml";
  }
  return null;
}

const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";
const PNG_TRAILER = "IEND\xaeB`\x82";

function extractEmbeddedPngBase64(serializedBase64: string): string | null {
  try {
    const binary = atob(serializedBase64);
    const start = binary.indexOf(PNG_SIGNATURE);
    if (start < 0) {
      return null;
    }

    const trailerStart = binary.indexOf(PNG_TRAILER, start);
    if (trailerStart < 0) {
      return null;
    }

    const pngBinary = binary.slice(start, trailerStart + PNG_TRAILER.length);
    return btoa(pngBinary);
  } catch {
    return null;
  }
}

function buildIconPreviewSrc(iconData: string): string {
  const normalized = normalizeBase64(iconData);
  if (!normalized) {
    return "";
  }

  const rawMime = detectRawIconMime(normalized);
  if (rawMime) {
    return `data:${rawMime};base64,${normalized}`;
  }

  const embeddedPng = extractEmbeddedPngBase64(normalized);
  if (embeddedPng) {
    return `data:image/png;base64,${embeddedPng}`;
  }

  return "";
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SplitKindInspector({
  split,
  onUpdate
}: {
  split: SubnauticaSplitNode;
  onUpdate: (updater: (node: SubnauticaSplitNode) => SubnauticaSplitNode) => void;
}) {
  switch (split.kind) {
    case "manual":
      return <p className="muted">Manual split: no autosplit trigger is attached.</p>;
    case "prefab":
      return (
        <SelectField
          label="Prefabricated Split"
          value={split.prefabId}
          options={splitDefinitions
            .filter((entry) => entry.kind === "prefab")
            .map((entry) => ({ id: entry.id, label: entry.description }))}
          onChange={(value) =>
            onUpdate((node) => (node.kind === "prefab" ? { ...node, prefabId: value } : node))
          }
        />
      );
    case "inventory":
      return (
        <>
          <SelectField
            label="Item"
            value={split.itemId}
            options={inventoryOptions}
            onChange={(value) =>
              onUpdate((node) =>
                node.kind === "inventory" ? { ...node, itemId: value } : node
              )
            }
          />
          {split.isSubCondition ? (
            <p className="muted">
              Condition mode: requires this item to already be in your inventory.
            </p>
          ) : (
            <label>
              Trigger Type
              <select
                value={split.pickUp ? "pickup" : "drop"}
                onChange={(event) =>
                  onUpdate((node) =>
                    node.kind === "inventory"
                      ? { ...node, pickUp: event.target.value === "pickup" }
                      : node
                  )
                }
              >
                <option value="pickup">Pickup</option>
                <option value="drop">Drop</option>
              </select>
            </label>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={split.isCount}
              onChange={(event) =>
                onUpdate((node) =>
                  node.kind === "inventory" ? { ...node, isCount: event.target.checked } : node
                )
              }
            />
            {split.isSubCondition ? "Require exact inventory count" : "Exact count required"}
          </label>
          <label>
            {split.isSubCondition ? "Required Count" : "Count"}
            <input
              type="number"
              min={1}
              max={48}
              value={split.count}
              onChange={(event) =>
                onUpdate((node) =>
                  node.kind === "inventory"
                    ? {
                        ...node,
                        count: Math.max(1, Math.min(48, Number(event.target.value) || 1))
                      }
                    : node
                )
              }
            />
          </label>
        </>
      );
    case "blueprint":
      return (
        <>
          <SelectField
            label="Blueprint"
            value={split.blueprintId}
            options={unlockableOptions}
            onChange={(value) =>
              onUpdate((node) =>
                node.kind === "blueprint" ? { ...node, blueprintId: value } : node
              )
            }
          />
          {split.isSubCondition && (
            <p className="muted">
              Condition mode: requires this blueprint to already be unlocked.
            </p>
          )}
        </>
      );
    case "encyclopedia":
      return (
        <>
          <SelectField
            label="Databank Entry"
            value={split.encyclopediaId}
            options={encyclopediaOptions}
            onChange={(value) =>
              onUpdate((node) =>
                node.kind === "encyclopedia" ? { ...node, encyclopediaId: value } : node
              )
            }
          />
          {split.isSubCondition && (
            <p className="muted">
              Condition mode: requires this entry to already be discovered.
            </p>
          )}
        </>
      );
    case "biome":
      return (
        <>
          <SelectField
            label="From Biome"
            value={split.fromBiomeId}
            options={biomeOptions}
            onChange={(value) =>
              onUpdate((node) =>
                node.kind === "biome" ? { ...node, fromBiomeId: value } : node
              )
            }
          />
          <SelectField
            label="To Biome"
            value={split.toBiomeId}
            options={biomeOptions}
            onChange={(value) =>
              onUpdate((node) =>
                node.kind === "biome" ? { ...node, toBiomeId: value } : node
              )
            }
          />
        </>
      );
    case "craft":
      return (
        <SelectField
          label="Craftable"
          value={split.craftableId}
          options={craftableOptions}
          onChange={(value) =>
            onUpdate((node) => (node.kind === "craft" ? { ...node, craftableId: value } : node))
          }
        />
      );
    case "legacy-raw":
      return (
        <>
          <label>
            Raw Name
            <input
              type="text"
              value={split.rawName}
              onChange={(event) =>
                onUpdate((node) =>
                  node.kind === "legacy-raw" ? { ...node, rawName: event.target.value } : node
                )
              }
            />
          </label>
          <label>
            Raw Value
            <input
              type="text"
              value={split.rawValue}
              onChange={(event) =>
                onUpdate((node) =>
                  node.kind === "legacy-raw" ? { ...node, rawValue: event.target.value } : node
                )
              }
            />
          </label>
        </>
      );
    default:
      return null;
  }
}

export function SplitInspector() {
  const config = useAppStore((state) => state.config);
  const selectedSplitId = useAppStore((state) => state.selectedSplitId);
  const updateSplit = useAppStore((state) => state.updateSplit);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSplit = selectedSplitId
    ? findSplitById(config.splits, selectedSplitId)?.node ?? null
    : null;

  if (!selectedSplit) {
    return (
      <div className="glass-panel inspector-panel">
        <div className="panel-title-row">
          <h2>Split Editor</h2>
        </div>
        <div className="muted">Select a split to edit it.</div>
      </div>
    );
  }

  const onlySplitOnceDisabled =
    selectedSplit.isSubCondition ||
    config.globalSettings.OrderedAutoSplits ||
    config.globalSettings.OrderedLiveSplit;
  const conditionsCount = selectedSplit.conditions.length;
  const hasIconData = Boolean(selectedSplit.iconData);
  const iconPreviewSrc = hasIconData ? buildIconPreviewSrc(selectedSplit.iconData ?? "") : "";

  return (
    <div className="glass-panel inspector-panel">
      <div className="panel-title-row">
        <h2>Split Editor</h2>
        <span className="muted">{getSplitKindLabel(selectedSplit.kind)}</span>
      </div>

      <div className="split-name-row">
        <label className="split-name-field">
          Split Name
          <input
            type="text"
            value={selectedSplit.displayNameOverride ?? ""}
            onChange={(event) =>
              updateSplit(selectedSplit.id, (node) => ({
                ...node,
                displayNameOverride: event.target.value
              }))
            }
          />
        </label>
        <label className="checkbox-row inline-checkbox">
          <input
            type="checkbox"
            checked={selectedSplit.onlySplitOnce}
            disabled={onlySplitOnceDisabled}
            onChange={(event) =>
              updateSplit(selectedSplit.id, (node) => ({
                ...node,
                onlySplitOnce: event.target.checked
              }))
            }
          />
          Only Split Once
        </label>
      </div>
      {onlySplitOnceDisabled && (
        <p className="muted">
          Disabled because this is a sub-condition or ordered splitting is enabled.
        </p>
      )}

      <SplitKindInspector
        split={selectedSplit}
        onUpdate={(updater) => updateSplit(selectedSplit.id, updater)}
      />

      {!selectedSplit.isSubCondition && (
        <div className="icon-editor">
          <span>Upload Icon for Split (optional)</span>
          <div className="file-picker-row">
            <button type="button" onClick={() => iconInputRef.current?.click()}>
              Choose Icon File
            </button>
            <span className="muted">
              {hasIconData
                ? "Icon loaded from preset/import. Choose a file to replace it."
                : "No icon selected."}
            </span>
          </div>
          <input
            ref={iconInputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={(event) =>
              updateIconData(event, (base64) =>
                updateSplit(selectedSplit.id, (node) => ({
                  ...node,
                  iconData: base64
                }))
              )
            }
          />
          {hasIconData ? (
            <div className="icon-preview-row">
              {iconPreviewSrc ? (
                <img
                  className="split-icon-preview"
                  src={iconPreviewSrc}
                  alt="Split icon preview"
                />
              ) : (
                <span className="muted">Icon data loaded (preview unavailable).</span>
              )}
              <button
                type="button"
                onClick={() =>
                  updateSplit(selectedSplit.id, (node) => ({
                    ...node,
                    iconData: ""
                  }))
                }
              >
                Clear Icon
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="muted">
        Conditions: {conditionsCount === 0 ? "None" : `${conditionsCount}`}
      </div>
    </div>
  );
}
