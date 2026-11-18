import { describe, expect, it, vi } from 'vitest';
import {
  createBlankDocument,
  createPixelBuffer,
  Editor,
  Selection,
  SetSelectionCommand,
} from '../../../core';
import { PixelClipboard } from '../../clipboard/pixel-clipboard';
import { ViewOptions } from '../../viewport/view-options';
import {
  buildEditSheetItems,
  buildFileSheetItems,
  buildImageSheetItems,
  buildMenuSheetItems,
  buildSelectSheetItems,
  buildTransformSublistItems,
} from './MobileMenuSheets';

function createEditor(): Editor {
  return new Editor(createBlankDocument({ width: 32, height: 32, background: 'white' }));
}

describe('MobileMenuSheets item builders', () => {
  it('builds File sheet items with exact desktop labels and invokes controller.run synchronously', () => {
    const run = vi.fn();
    const close = vi.fn();
    const controller = { blocked: false, run } as unknown as Parameters<
      typeof buildFileSheetItems
    >[0];
    const items = buildFileSheetItems(controller, close);

    expect(items.map((i) => [i.testId, i.label])).toEqual([
      ['file.newButton', 'New…'],
      ['file.openButton', 'Open…'],
      ['file.importButton', 'Import Image as Layer…'],
      ['file.saveButton', 'Save'],
      ['file.saveAsButton', 'Save As…'],
      ['file.exportButton', 'Export…'],
      ['file.closeButton', 'Close'],
      ['file.demoButton', 'Demo Document'],
    ]);

    items[0]?.run();
    expect(close).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('new');
  });

  it('builds Select sheet items and enables Deselect/Inverse only when a selection exists', () => {
    const editor = createEditor();
    const close = vi.fn();

    const withoutSel = buildSelectSheetItems(editor, false, close);
    expect(withoutSel.map((i) => [i.testId, i.disabled])).toEqual([
      ['select.allButton', false],
      ['select.deselectButton', true],
      ['select.inverseButton', true],
    ]);

    editor.history.execute(
      new SetSelectionCommand(Selection.fromRect(32, 32, { x: 0, y: 0, width: 10, height: 10 })),
    );
    const withSel = buildSelectSheetItems(editor, false, close);
    expect(withSel.map((i) => [i.testId, i.disabled])).toEqual([
      ['select.allButton', false],
      ['select.deselectButton', false],
      ['select.inverseButton', false],
    ]);
  });

  it('drills into Transform sub-list from Edit sheet and exposes modes and orientations', () => {
    const editor = createEditor();
    const clipboard = new PixelClipboard({
      editor,
      decodeImage: () => Promise.resolve(createPixelBuffer(1, 1)),
      writeSystem: () => Promise.resolve(true),
      onError: () => {},
    });
    const openFill = vi.fn();
    const controller = { blocked: false, openFill } as unknown as Parameters<
      typeof buildEditSheetItems
    >[1];
    const start = vi.fn();
    const orient = vi.fn();
    const freeTransform = {
      canStart: () => true,
      start,
      orient,
    } as unknown as Parameters<typeof buildEditSheetItems>[3];
    const openSublist = vi.fn();
    const close = vi.fn();

    const editItems = buildEditSheetItems(
      editor,
      controller,
      clipboard,
      freeTransform,
      () => null,
      openSublist,
      close,
    );
    const transformEntry = editItems.find((i) => i.testId === 'edit.transformButton');
    expect(transformEntry?.hasSublist).toBe(true);
    transformEntry?.run();
    expect(openSublist).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    const subItems = buildTransformSublistItems(freeTransform, false, close);
    expect(subItems.map((i) => i.testId)).toEqual([
      'edit.scaleButton',
      'edit.rotateButton',
      'edit.skewButton',
      'edit.distortButton',
      'edit.perspectiveButton',
      'edit.flipHorizontalButton',
      'edit.flipVerticalButton',
      'edit.rotate180Button',
      'edit.rotateCwButton',
      'edit.rotateCcwButton',
    ]);
    subItems[3]?.run();
    expect(start).toHaveBeenCalledWith('distort');
    subItems[5]?.run();
    expect(orient).toHaveBeenCalledWith('flip-horizontal');
  });

  it('builds Image and Menu sheet items', () => {
    const editor = createEditor();
    const openDialog = vi.fn();
    const run = vi.fn();
    const controller = { blocked: false, openDialog, run } as unknown as Parameters<
      typeof buildImageSheetItems
    >[1];
    const close = vi.fn();

    const imageItems = buildImageSheetItems(editor, controller, close);
    expect(imageItems[0]?.testId).toBe('image.cropToSelectionButton');
    expect(imageItems[0]?.disabled).toBe(true);
    imageItems[1]?.run();
    expect(openDialog).toHaveBeenCalledWith('image-size');

    const view = new ViewOptions();
    const fitToView = vi.fn();
    const actualSize = vi.fn();
    const viewport = {
      fitToView,
      actualSize,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    } as unknown as Parameters<typeof buildMenuSheetItems>[2];
    const menuItems = buildMenuSheetItems(controller, view, viewport, close);
    expect(menuItems.map((i) => i.testId)).toEqual([
      'menu.fitButton',
      'menu.actualPixelsButton',
      'menu.zoomInButton',
      'menu.zoomOutButton',
      'menu.extrasButton',
      'menu.demoButton',
    ]);
    menuItems[0]?.run();
    expect(fitToView).toHaveBeenCalledTimes(1);
    menuItems[4]?.run();
    expect(view.showExtras).toBe(false);
  });
});
