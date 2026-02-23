import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ConditionSplitKind,
  getConditionKindLabel,
  getSplitKindLabel,
  getSplitKindTooltip,
  getSplitTooltip
} from "../lib/autosplitterTooltips";
import { canAddCondition, getNodeLabel } from "../lib/splitTree";
import { useAppStore } from "../store/useAppStore";
import { SubnauticaSplitKind, SubnauticaSplitNode } from "../types/model";

const topLevelKinds: SubnauticaSplitKind[] = [
  "prefab",
  "inventory",
  "blueprint",
  "encyclopedia",
  "biome",
  "craft",
  "manual"
];

const conditionKinds: ConditionSplitKind[] = [
  "inventory",
  "blueprint",
  "encyclopedia",
  "biome"
];

interface SplitListProps {
  nodes: SubnauticaSplitNode[];
  parentId: string | null;
  depth: number;
}

interface SplitTreeEditorProps {
  downloadFilename: string;
  defaultDownloadFilename: string;
  onDownloadFilenameChange: (value: string) => void;
}

function countConditionNodes(nodes: SubnauticaSplitNode[]): number {
  return nodes.reduce((total, node) => {
    const direct = node.conditions.length;
    const nested = countConditionNodes(node.conditions);
    return total + direct + nested;
  }, 0);
}

function getKindBadgeText(node: SubnauticaSplitNode): string {
  if (node.kind === "legacy-raw") {
    return "Legacy";
  }
  if (node.kind === "manual") {
    return "Manual";
  }
  if (node.kind === "encyclopedia") {
    return node.isSubCondition ? "Databank Cond." : "Databank";
  }
  if (node.kind === "inventory") {
    return node.isSubCondition ? "Inventory Cond." : "Inventory";
  }
  if (node.kind === "blueprint") {
    return node.isSubCondition ? "Blueprint Cond." : "Blueprint";
  }
  if (node.kind === "biome") {
    return node.isSubCondition ? "Biome Cond." : "Biome";
  }
  if (node.kind === "prefab") {
    return "Prefab";
  }
  if (node.kind === "craft") {
    return "Craft";
  }
  return "Split";
}

function SplitList({ nodes, parentId, depth }: SplitListProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const reorderTopLevel = useAppStore((state) => state.reorderTopLevel);
  const reorderConditions = useAppStore((state) => state.reorderConditions);

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!overId || activeId === overId) {
      return;
    }

    if (parentId) {
      reorderConditions(parentId, activeId, overId);
    } else {
      reorderTopLevel(activeId, overId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
        <div className={`split-list depth-${depth}`}>
          {nodes.map((node) => (
            <SortableSplitNode key={node.id} node={node} depth={depth} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSplitNode({
  node,
  depth
}: {
  node: SubnauticaSplitNode;
  depth: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id
  });
  const selectedSplitId = useAppStore((state) => state.selectedSplitId);
  const selectSplit = useAppStore((state) => state.selectSplit);
  const removeSplit = useAppStore((state) => state.removeSplit);
  const addConditionSplit = useAppStore((state) => state.addConditionSplit);

  const [conditionKind, setConditionKind] = useState<ConditionSplitKind>("inventory");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const canAddConditions = canAddCondition(node.kind);
  const nodeTooltip = getSplitTooltip(node);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "split-row",
        selectedSplitId === node.id ? "selected" : "",
        isDragging ? "dragging" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="split-main">
        <button
          className="drag-handle"
          type="button"
          aria-label="Drag split to reorder"
          {...attributes}
          {...listeners}
        >
          ::
        </button>
        <button
          type="button"
          className="split-title"
          title={nodeTooltip}
          onClick={() => selectSplit(node.id)}
        >
          <span className="kind-pill">{getKindBadgeText(node)}</span>
          {getNodeLabel(node)}
        </button>
        <button type="button" onClick={() => removeSplit(node.id)}>
          Remove
        </button>
      </div>

      {canAddConditions && (
        <div className="condition-controls">
          <select
            value={conditionKind}
            title={getSplitKindTooltip(conditionKind)}
            onChange={(event) =>
              setConditionKind(event.target.value as ConditionSplitKind)
            }
          >
            {conditionKinds.map((entry) => (
              <option key={entry} value={entry}>
                {getConditionKindLabel(entry)}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Add a nested condition that must already be true before this split trigger fires."
            onClick={() => addConditionSplit(node.id, conditionKind)}
          >
            Add Condition
          </button>
        </div>
      )}

      {node.conditions.length > 0 && (
        <SplitList nodes={node.conditions} parentId={node.id} depth={depth + 1} />
      )}
    </div>
  );
}

export function SplitTreeEditor({
  downloadFilename,
  defaultDownloadFilename,
  onDownloadFilenameChange
}: SplitTreeEditorProps) {
  const splits = useAppStore((state) => state.config.splits);
  const addTopLevelSplit = useAppStore((state) => state.addTopLevelSplit);
  const clearAllSplits = useAppStore((state) => state.clearAllSplits);
  const [topLevelKind, setTopLevelKind] = useState<SubnauticaSplitKind>("prefab");

  const splitCountText = useMemo(() => {
    const conditionCount = countConditionNodes(splits);
    return `${splits.length} Splits | ${conditionCount} Conditions`;
  }, [splits]);

  const onClearSplits = () => {
    if (splits.length === 0) {
      return;
    }
    if (!window.confirm("Clear all top-level splits and conditions?")) {
      return;
    }
    clearAllSplits();
  };

  return (
    <div className="glass-panel split-editor">
      <div className="split-editor-heading">
        <div className="split-editor-meta">
          <h2>Splits Tree Editor</h2>
          <p className="muted split-editor-count">{splitCountText}</p>
        </div>
        <div className="download-name-inline">
          <label>
            Download Filename
            <input
              type="text"
              value={downloadFilename}
              onChange={(event) => onDownloadFilenameChange(event.target.value)}
            />
          </label>
          <div className="muted filename-default">Default: {defaultDownloadFilename}</div>
        </div>
      </div>

      <div className="add-row">
        <label>
          Add Top-Level Split
          <select
            value={topLevelKind}
            title={getSplitKindTooltip(topLevelKind)}
            onChange={(event) => setTopLevelKind(event.target.value as SubnauticaSplitKind)}
          >
            {topLevelKinds.map((kind) => (
              <option key={kind} value={kind}>
                {getSplitKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => addTopLevelSplit(topLevelKind)}>
          Add Split
        </button>
        <button type="button" onClick={onClearSplits}>
          Clear Splits
        </button>
      </div>

      <div className="split-tree-scroll">
        {splits.length === 0 ? (
          <div className="empty-editor">
            <p>No splits yet. Add one to begin.</p>
          </div>
        ) : (
          <SplitList nodes={splits} parentId={null} depth={0} />
        )}
      </div>
    </div>
  );
}
