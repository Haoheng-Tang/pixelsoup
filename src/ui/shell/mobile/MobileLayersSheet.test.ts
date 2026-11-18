import { describe, expect, it, vi } from 'vitest';
import {
  createBlankDocument,
  Editor,
  newLayerCommand,
  Selection,
  SetSelectionCommand,
} from '../../../core';
import {
  buildOneLayerActions,
  changeMobileLayerOpacity,
  openLayerTuning,
  selectMobileLayer,
  toggleMobileLayerVisibility,
} from './MobileLayersSheet';

function createTwoLayerEditor(): Editor {
  const editor = new Editor(createBlankDocument({ width: 32, height: 32, background: 'white' }));
  const cmd = newLayerCommand(editor.document, editor.activeLayerId);
  editor.history.execute(cmd);
  editor.setActiveLayer(cmd.layer.id);
  return editor;
}

describe('MobileLayersSheet helpers', () => {
  it('selects a layer and opens onelayer when tapping thumbnail tuning (⑱)', () => {
    const editor = createTwoLayerEditor();
    const bottomId = editor.document.layers[0].id;
    const setSheet = vi.fn();

    openLayerTuning(editor, bottomId, setSheet);
    expect(editor.activeLayerId).toBe(bottomId);
    expect(setSheet).toHaveBeenCalledWith('onelayer');
  });

  it('toggles visibility and updates opacity with a gesture mergeKey', () => {
    const editor = createTwoLayerEditor();
    const layerId = editor.activeLayerId!;

    toggleMobileLayerVisibility(editor, editor.activeLayer!);
    expect(editor.activeLayer?.visible).toBe(false);

    changeMobileLayerOpacity(editor, editor.activeLayer!, 80, 1);
    changeMobileLayerOpacity(editor, editor.activeLayer!, 60, 1);
    expect(editor.activeLayer?.opacity).toBe(0.6);

    // Both opacity adjustments in gesture 1 merged into a single undo step.
    editor.history.undo();
    expect(editor.activeLayer?.opacity).toBe(1);
    expect(editor.activeLayerId).toBe(layerId);
  });

  it('builds single-layer action items and returns to layers sheet after delete or merge-down', () => {
    const editor = createTwoLayerEditor();
    const setSheet = vi.fn();

    const items = buildOneLayerActions(editor, false, setSheet);
    expect(items.map((i) => [i.testId, i.disabled])).toEqual([
      ['onelayer.duplicateButton', false],
      ['onelayer.deleteButton', false],
      ['onelayer.mergeDownButton', false],
      ['onelayer.layerViaCopyButton', true],
      ['onelayer.layerViaCutButton', true],
      ['onelayer.commitFloatingButton', true],
    ]);

    // Select a region so Layer via Copy/Cut become enabled.
    editor.history.execute(
      new SetSelectionCommand(Selection.fromRect(32, 32, { x: 0, y: 0, width: 8, height: 8 })),
    );
    const withSel = buildOneLayerActions(editor, false, setSheet);
    expect(withSel.find((i) => i.testId === 'onelayer.layerViaCopyButton')?.disabled).toBe(false);
    expect(withSel.find((i) => i.testId === 'onelayer.layerViaCutButton')?.disabled).toBe(false);

    // Deleting the top layer removes it and returns to layers sheet.
    const deleteItem = withSel.find((i) => i.testId === 'onelayer.deleteButton');
    deleteItem?.run();
    expect(editor.document.layers).toHaveLength(1);
    expect(setSheet).toHaveBeenCalledWith('layers');

    // Selecting a missing layer ID is a safe no-op.
    const remainingId = editor.activeLayerId;
    selectMobileLayer(editor, 'layer-999');
    expect(editor.activeLayerId).toBe(remainingId);
  });
});
