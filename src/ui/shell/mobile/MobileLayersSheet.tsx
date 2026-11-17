import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor, Layer, LayerId } from '../../../core';
import {
  SetLayerOpacityCommand,
  SetLayerVisibilityCommand,
  findLayer,
  findLayerIndex,
  reorderLayerCommand,
} from '../../../core';
import type { LayerAction } from '../../layer-actions';
import { canRunLayerAction, commitFloatingFrom, runLayerAction } from '../../layer-actions';
import { DRAG_THRESHOLD, dropSlot, isNoOpDrop, stackIndexForDrop } from '../../panels/layer-drag';
import { LayerThumbnails } from '../../panels/layer-thumbnails';
import { EyeIcon, RenameField } from '../../panels/LayerPanel';
import { useEditorRevision } from '../../use-editor-revision';
import { MobileSheet } from './MobileSheet';
import type { MobileSheetId } from './mobile-sheet-state';

/** Hold time in ms before a touch press on a layer row arms drag-to-reorder. */
export const LONG_PRESS_REORDER_MS = 350;

const ROW_CONTROL = '[data-row-control]';

export interface MobileLayerActionItem {
  readonly action: LayerAction;
  readonly testId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly run: () => void;
}

export function selectMobileLayer(editor: Editor, layerId: LayerId): void {
  if (findLayer(editor.document, layerId)) editor.setActiveLayer(layerId);
}

export function openLayerTuning(
  editor: Editor,
  layerId: LayerId,
  setSheet: (sheet: MobileSheetId) => void,
): void {
  selectMobileLayer(editor, layerId);
  setSheet('onelayer');
}

export function toggleMobileLayerVisibility(editor: Editor, layer: Layer): void {
  if (editor.floating?.layerId === layer.id) return;
  commitFloatingFrom(editor, layer.id);
  editor.history.execute(new SetLayerVisibilityCommand(layer.id, !layer.visible));
}

export function changeMobileLayerOpacity(
  editor: Editor,
  layer: Layer,
  percent: number,
  gestureId: number,
): void {
  if (editor.floating?.layerId === layer.id) return;
  const opacity = Math.max(0, Math.min(100, percent)) / 100;
  if (opacity === layer.opacity) return;
  commitFloatingFrom(editor, layer.id);
  const mergeKey = `opacity:${layer.id}:${gestureId}`;
  editor.history.execute(new SetLayerOpacityCommand(layer.id, opacity, mergeKey));
}

export function buildOneLayerActions(
  editor: Editor,
  blocked: boolean,
  setSheet: (sheet: MobileSheetId) => void,
): readonly MobileLayerActionItem[] {
  const definitions: readonly {
    action: LayerAction;
    testId: string;
    label: string;
    returnToLayers?: boolean;
  }[] = [
    { action: 'duplicate', testId: 'onelayer.duplicateButton', label: 'Duplicate Layer' },
    {
      action: 'delete',
      testId: 'onelayer.deleteButton',
      label: 'Delete Layer',
      returnToLayers: true,
    },
    {
      action: 'merge-down',
      testId: 'onelayer.mergeDownButton',
      label: 'Merge Down',
      returnToLayers: true,
    },
    { action: 'layer-via-copy', testId: 'onelayer.layerViaCopyButton', label: 'Layer via Copy' },
    { action: 'layer-via-cut', testId: 'onelayer.layerViaCutButton', label: 'Layer via Cut' },
    {
      action: 'commit-floating',
      testId: 'onelayer.commitFloatingButton',
      label: 'Commit Floating Selection',
      returnToLayers: true,
    },
  ];
  return definitions.map(({ action, testId, label, returnToLayers }) => ({
    action,
    testId,
    label,
    disabled: blocked || !canRunLayerAction(editor, action),
    run: () => {
      runLayerAction(editor, action);
      if (returnToLayers) setSheet('layers');
    },
  }));
}

interface RowDrag {
  readonly layerId: LayerId;
  readonly slot: number | null;
}

export interface MobileLayersSheetProps {
  readonly activeSheet: MobileSheetId;
  readonly setSheet: (sheet: MobileSheetId) => void;
  readonly onDismiss: () => void;
  readonly editor: Editor;
  readonly blocked: boolean;
}

export function MobileLayersSheet({
  activeSheet,
  setSheet,
  onDismiss,
  editor,
  blocked,
}: MobileLayersSheetProps) {
  useEditorRevision(editor);
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<RowDrag | null>(null);
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);
  const thumbnails = useMemo(() => new LayerThumbnails(editor), [editor]);
  useEffect(() => thumbnails.start(), [thumbnails]);

  if (activeSheet !== 'layers' && activeSheet !== 'onelayer') return null;

  const layers = [...editor.document.layers].reverse();
  const floatingId = editor.floating?.layerId ?? null;

  const onRowPointerDown = (e: ReactPointerEvent<HTMLLIElement>, layerId: LayerId) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest(ROW_CONTROL))) return;
    endDrag.current?.();
    if (layerId === editor.floating?.layerId) {
      selectMobileLayer(editor, layerId);
      return;
    }

    const row = e.currentTarget;
    const { pointerId } = e;
    const start = { x: e.clientX, y: e.clientY };
    const doc = editor.document;
    let armed = false;
    let slot: number | null = null;

    const timer = window.setTimeout(() => {
      armed = true;
      selectMobileLayer(editor, layerId);
      capturePointer(row, pointerId);
      setDrag({ layerId, slot: null });
    }, LONG_PRESS_REORDER_MS);

    function onTouchMove(ev: TouchEvent): void {
      if (armed) ev.preventDefault();
    }

    function onMove(ev: PointerEvent): void {
      if (ev.pointerId !== pointerId) return;
      if (!armed) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >= DRAG_THRESHOLD) {
          stop();
        }
        return;
      }
      const rows = rowElements(listRef.current);
      const fromRow = rows.findIndex((el) => el.dataset['layerId'] === layerId);
      const gap = dropSlot(rows.map(midpointY), ev.clientY);
      const next = fromRow < 0 || isNoOpDrop(fromRow, gap) ? null : gap;
      if (next === slot) return;
      slot = next;
      setDrag({ layerId, slot });
    }

    function onUp(ev: PointerEvent): void {
      if (ev.pointerId !== pointerId) return;
      const wasArmed = armed;
      const gap = slot;
      stop();
      if (!wasArmed) {
        selectMobileLayer(editor, layerId);
        return;
      }
      if (gap == null || editor.document !== doc) return;
      const index = findLayerIndex(doc, layerId);
      const count = doc.layers.length;
      if (index < 0 || gap > count) return;
      const command = reorderLayerCommand(
        doc,
        layerId,
        stackIndexForDrop(count, count - 1 - index, gap),
      );
      if (command) editor.history.execute(command);
    }

    function stop(): void {
      window.clearTimeout(timer);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      if (endDrag.current === stop) endDrag.current = null;
      setDrag(null);
    }

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    endDrag.current = stop;
  };

  if (activeSheet === 'onelayer') {
    const activeLayer = editor.activeLayer;
    if (!activeLayer) return null;
    return (
      <MobileOneLayerView
        key={activeLayer.id}
        editor={editor}
        layer={activeLayer}
        floating={activeLayer.id === floatingId}
        blocked={blocked}
        thumbnails={thumbnails}
        setSheet={setSheet}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <MobileSheet title="Layers" testId="layers.sheet" onDismiss={onDismiss}>
      <ul
        ref={listRef}
        className={
          drag ? 'layer-list mobile-layer-list is-reordering' : 'layer-list mobile-layer-list'
        }
        data-testid="layers.list"
      >
        {layers.map((layer, row) => (
          <MobileLayerRow
            key={layer.id}
            editor={editor}
            thumbnails={thumbnails}
            layer={layer}
            active={layer.id === editor.activeLayerId}
            floating={layer.id === floatingId}
            dragging={drag?.layerId === layer.id}
            dropEdge={dropEdgeAt(drag, row, layers.length)}
            setSheet={setSheet}
            onPointerDown={(e) => onRowPointerDown(e, layer.id)}
          />
        ))}
      </ul>
      <div className="mobile-layers-footer" role="group" aria-label="Layer stack actions">
        <button
          type="button"
          className="mobile-layers-action"
          data-testid="layers.newLayerButton"
          disabled={blocked || !canRunLayerAction(editor, 'new')}
          onClick={() => runLayerAction(editor, 'new')}
        >
          New layer
        </button>
        <button
          type="button"
          className="mobile-layers-action"
          data-testid="layers.flattenButton"
          disabled={blocked || !canRunLayerAction(editor, 'flatten')}
          onClick={() => runLayerAction(editor, 'flatten')}
        >
          Flatten Image
        </button>
      </div>
    </MobileSheet>
  );
}

interface MobileLayerRowProps {
  editor: Editor;
  thumbnails: LayerThumbnails;
  layer: Layer;
  active: boolean;
  floating: boolean;
  dragging: boolean;
  dropEdge: 'before' | 'after' | null;
  setSheet: (sheet: MobileSheetId) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLLIElement>) => void;
}

function MobileLayerRow({
  editor,
  thumbnails,
  layer,
  active,
  floating,
  dragging,
  dropEdge,
  setSheet,
  onPointerDown,
}: MobileLayerRowProps) {
  const percent = Math.round(layer.opacity * 100);
  const thumbnailRef = useCallback(
    (canvas: HTMLCanvasElement | null) =>
      canvas ? thumbnails.attach(layer.id, canvas) : undefined,
    [thumbnails, layer.id],
  );

  const className = [
    'layer',
    'mobile-layer-row',
    active && 'is-active',
    floating && 'is-floating',
    !layer.visible && 'is-hidden',
    dragging && 'is-dragging',
    dropEdge && `drop-${dropEdge}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={className}
      data-testid="layers.row"
      data-layer-id={layer.id}
      aria-current={active || undefined}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest(ROW_CONTROL)) return;
        selectMobileLayer(editor, layer.id);
      }}
    >
      <button
        type="button"
        className="visibility-toggle"
        data-row-control
        data-testid="layers.visibilityButton"
        aria-pressed={layer.visible}
        aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
        disabled={floating}
        onClick={() => toggleMobileLayerVisibility(editor, layer)}
      >
        <EyeIcon open={layer.visible} />
      </button>
      <button
        type="button"
        className="layer-thumbnail mobile-layer-tuning-button"
        data-row-control
        data-testid="layers.layerTuning"
        aria-label={`Tune ${layer.name}`}
        onClick={() => openLayerTuning(editor, layer.id, setSheet)}
      >
        <canvas ref={thumbnailRef} />
      </button>
      <div className="mobile-layer-row-info">
        <span className="mobile-layer-row-name">{layer.name}</span>
        <span className="mobile-layer-row-opacity">{percent}%</span>
      </div>
    </li>
  );
}

interface MobileOneLayerViewProps {
  editor: Editor;
  layer: Layer;
  floating: boolean;
  blocked: boolean;
  thumbnails: LayerThumbnails;
  setSheet: (sheet: MobileSheetId) => void;
  onDismiss: () => void;
}

function MobileOneLayerView({
  editor,
  layer,
  floating,
  blocked,
  thumbnails,
  setSheet,
  onDismiss,
}: MobileOneLayerViewProps) {
  const gesture = useRef(0);
  const [renaming, setRenaming] = useState(false);
  const percent = Math.round(layer.opacity * 100);
  const sliderId = `mobile-opacity-${layer.id}`;
  const thumbnailRef = useCallback(
    (canvas: HTMLCanvasElement | null) =>
      canvas ? thumbnails.attach(layer.id, canvas) : undefined,
    [thumbnails, layer.id],
  );
  const actions = buildOneLayerActions(editor, blocked, setSheet);

  return (
    <MobileSheet
      title="Layer"
      testId="onelayer.sheet"
      onDismiss={onDismiss}
      onBack={() => setSheet('layers')}
      backTestId="onelayer.backButton"
    >
      <div className="mobile-onelayer-content">
        <div className="mobile-onelayer-name-row">
          {renaming ? (
            <RenameField
              editor={editor}
              layer={layer}
              onDone={() => setRenaming(false)}
              testId="onelayer.nameInput"
            />
          ) : (
            <button
              type="button"
              className="mobile-onelayer-name-button"
              data-testid="onelayer.nameButton"
              disabled={floating}
              onClick={() => setRenaming(true)}
            >
              {layer.name}
            </button>
          )}
        </div>
        <div className="mobile-onelayer-preview-row">
          <button
            type="button"
            className="visibility-toggle mobile-onelayer-visibility"
            data-testid="onelayer.visibilityButton"
            aria-pressed={layer.visible}
            aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
            disabled={floating}
            onClick={() => toggleMobileLayerVisibility(editor, layer)}
          >
            <EyeIcon open={layer.visible} />
          </button>
          <div className="layer-thumbnail" data-testid="onelayer.thumbnail" aria-hidden="true">
            <canvas ref={thumbnailRef} />
          </div>
        </div>
        <div className="mobile-onelayer-opacity">
          <div className="mobile-onelayer-opacity-header">
            <label htmlFor={sliderId}>Opacity</label>
            <output data-testid="onelayer.opacityValue" htmlFor={sliderId}>
              {percent}%
            </output>
          </div>
          <input
            id={sliderId}
            data-testid="onelayer.opacitySlider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            disabled={floating}
            onPointerDown={() => gesture.current++}
            onKeyDown={() => gesture.current++}
            onChange={(e) =>
              changeMobileLayerOpacity(
                editor,
                layer,
                Number(e.currentTarget.value),
                gesture.current,
              )
            }
          />
        </div>
        <div className="mobile-sheet-action-list" role="group" aria-label="Layer actions">
          {actions.map((item) => (
            <button
              key={item.testId}
              type="button"
              className="mobile-sheet-action-button"
              data-testid={item.testId}
              disabled={item.disabled}
              onClick={item.run}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </MobileSheet>
  );
}

function dropEdgeAt(drag: RowDrag | null, row: number, rows: number): 'before' | 'after' | null {
  if (drag?.slot == null) return null;
  if (drag.slot === row) return 'before';
  return drag.slot === rows && row === rows - 1 ? 'after' : null;
}

function rowElements(list: HTMLUListElement | null): HTMLElement[] {
  return list ? [...list.querySelectorAll<HTMLElement>(':scope > [data-layer-id]')] : [];
}

function midpointY(element: Element): number {
  const rect = element.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer already released.
  }
}
