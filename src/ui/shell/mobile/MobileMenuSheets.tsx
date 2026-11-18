import type { Editor, Orientation, Rect } from '../../../core';
import { ORIENTATION_LABELS } from '../../../core';
import type { ClipboardCommand, PixelClipboard } from '../../clipboard/pixel-clipboard';
import { canClear, canFill, runClear } from '../../edit-actions';
import type { ImageAction } from '../../image-actions';
import { canRunImageAction, runImageAction } from '../../image-actions';
import type { SelectCommand } from '../../select-commands';
import { runSelectCommand } from '../../select-commands';
import type { AppController, FileCommand, ImageDialog } from '../../session/app-controller';
import type { FreeTransform } from '../../transform/free-transform';
import type { TransformMode } from '../../transform/transform-math';
import { useEditorRevision } from '../../use-editor-revision';
import { useRevision } from '../../use-revision';
import type { ViewportController } from '../../viewport/viewport-controller';
import type { ViewOptions } from '../../viewport/view-options';
import { runViewCommand } from '../../viewport/view-options';
import { MobileSheet } from './MobileSheet';
import type { MobileSheetId } from './MobileTopBar';

export interface SheetActionItem {
  readonly id: string;
  readonly testId: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly checked?: boolean;
  readonly hasSublist?: boolean;
  readonly run: () => void;
}

export function buildFileSheetItems(
  controller: AppController,
  close: () => void,
): readonly SheetActionItem[] {
  const item = (id: FileCommand, testId: string, label: string): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: controller.blocked,
    run: () => {
      close();
      controller.run(id);
    },
  });
  return [
    item('new', 'file.newButton', 'New…'),
    item('open', 'file.openButton', 'Open…'),
    item('import', 'file.importButton', 'Import Image as Layer…'),
    item('save', 'file.saveButton', 'Save'),
    item('save-as', 'file.saveAsButton', 'Save As…'),
    item('export', 'file.exportButton', 'Export…'),
    item('close', 'file.closeButton', 'Close'),
    item('demo', 'file.demoButton', 'Demo Document'),
  ];
}

export function buildEditSheetItems(
  editor: Editor,
  controller: AppController,
  clipboard: PixelClipboard,
  freeTransform: FreeTransform,
  viewArea: () => Rect | null,
  openTransformSublist: () => void,
  close: () => void,
): readonly SheetActionItem[] {
  const { blocked } = controller;
  const clip = (id: ClipboardCommand, testId: string, label: string): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: blocked || !clipboard.canRun(id),
    run: () => {
      close();
      clipboard.run(id, viewArea());
    },
  });
  const noTransform = blocked || !freeTransform.canStart();
  return [
    clip('cut', 'edit.cutButton', 'Cut'),
    clip('copy', 'edit.copyButton', 'Copy'),
    clip('copy-merged', 'edit.copyMergedButton', 'Copy Merged'),
    clip('paste', 'edit.pasteButton', 'Paste'),
    {
      id: 'fill',
      testId: 'edit.fillButton',
      label: 'Fill…',
      disabled: blocked || !canFill(editor),
      run: () => {
        close();
        controller.openFill();
      },
    },
    {
      id: 'clear',
      testId: 'edit.clearButton',
      label: 'Clear',
      disabled: blocked || !canClear(editor),
      run: () => {
        close();
        runClear(editor);
      },
    },
    {
      id: 'free-transform',
      testId: 'edit.freeTransformButton',
      label: 'Free Transform',
      disabled: noTransform,
      run: () => {
        close();
        freeTransform.start('free');
      },
    },
    {
      id: 'transform',
      testId: 'edit.transformButton',
      label: 'Transform',
      disabled: noTransform,
      hasSublist: true,
      run: openTransformSublist,
    },
  ];
}

export function buildTransformSublistItems(
  freeTransform: FreeTransform,
  blocked: boolean,
  close: () => void,
): readonly SheetActionItem[] {
  const noTransform = blocked || !freeTransform.canStart();
  const mode = (id: TransformMode, testId: string, label: string): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: noTransform,
    run: () => {
      close();
      freeTransform.start(id);
    },
  });
  const orient = (id: Orientation, testId: string): SheetActionItem => ({
    id,
    testId,
    label: ORIENTATION_LABELS[id],
    disabled: noTransform,
    run: () => {
      close();
      freeTransform.orient(id);
    },
  });
  return [
    mode('scale', 'edit.scaleButton', 'Scale'),
    mode('rotate', 'edit.rotateButton', 'Rotate'),
    mode('skew', 'edit.skewButton', 'Skew'),
    mode('distort', 'edit.distortButton', 'Distort'),
    mode('perspective', 'edit.perspectiveButton', 'Perspective'),
    orient('flip-horizontal', 'edit.flipHorizontalButton'),
    orient('flip-vertical', 'edit.flipVerticalButton'),
    orient('rotate-180', 'edit.rotate180Button'),
    orient('rotate-cw', 'edit.rotateCwButton'),
    orient('rotate-ccw', 'edit.rotateCcwButton'),
  ];
}

export function buildSelectSheetItems(
  editor: Editor,
  blocked: boolean,
  close: () => void,
): readonly SheetActionItem[] {
  const noSelection = editor.document.selection === null;
  const item = (
    id: SelectCommand,
    testId: string,
    label: string,
    requiresSelection: boolean,
  ): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: blocked || (requiresSelection && noSelection),
    run: () => {
      close();
      runSelectCommand(editor, id);
    },
  });
  return [
    item('select-all', 'select.allButton', 'Select All', false),
    item('deselect', 'select.deselectButton', 'Deselect', true),
    item('inverse', 'select.inverseButton', 'Inverse', true),
  ];
}

export function buildImageSheetItems(
  editor: Editor,
  controller: AppController,
  close: () => void,
): readonly SheetActionItem[] {
  const { blocked } = controller;
  const action = (id: ImageAction, testId: string, label: string): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: blocked || !canRunImageAction(editor, id),
    run: () => {
      close();
      runImageAction(editor, id);
    },
  });
  const dialog = (id: ImageDialog, testId: string, label: string): SheetActionItem => ({
    id,
    testId,
    label,
    disabled: blocked,
    run: () => {
      close();
      controller.openDialog(id);
    },
  });
  const orient = (id: Orientation, testId: string) => action(id, testId, ORIENTATION_LABELS[id]);
  return [
    action('crop-to-selection', 'image.cropToSelectionButton', 'Crop to Selection'),
    dialog('image-size', 'image.imageSizeButton', 'Image Size…'),
    dialog('canvas-size', 'image.canvasSizeButton', 'Canvas Size…'),
    orient('rotate-cw', 'image.rotateCwButton'),
    orient('rotate-ccw', 'image.rotateCcwButton'),
    orient('rotate-180', 'image.rotate180Button'),
    orient('flip-horizontal', 'image.flipHorizontalButton'),
    orient('flip-vertical', 'image.flipVerticalButton'),
  ];
}

export function buildMenuSheetItems(
  controller: AppController,
  view: ViewOptions,
  viewport: ViewportController | null,
  close: () => void,
): readonly SheetActionItem[] {
  const { blocked } = controller;
  const noViewport = blocked || viewport === null;
  return [
    {
      id: 'fit',
      testId: 'menu.fitButton',
      label: 'Fit to Screen',
      disabled: noViewport,
      run: () => {
        close();
        viewport?.fitToView();
      },
    },
    {
      id: 'actual-size',
      testId: 'menu.actualPixelsButton',
      label: 'Actual Pixels (100%)',
      disabled: noViewport,
      run: () => {
        close();
        viewport?.actualSize();
      },
    },
    {
      id: 'zoom-in',
      testId: 'menu.zoomInButton',
      label: 'Zoom In',
      disabled: noViewport,
      run: () => {
        close();
        viewport?.zoomIn();
      },
    },
    {
      id: 'zoom-out',
      testId: 'menu.zoomOutButton',
      label: 'Zoom Out',
      disabled: noViewport,
      run: () => {
        close();
        viewport?.zoomOut();
      },
    },
    {
      id: 'extras',
      testId: 'menu.extrasButton',
      label: 'Extras',
      checked: view.showExtras,
      disabled: blocked,
      run: () => {
        close();
        runViewCommand(view, 'extras');
      },
    },
    {
      id: 'demo',
      testId: 'menu.demoButton',
      label: 'Demo Document',
      disabled: blocked,
      run: () => {
        close();
        controller.run('demo');
      },
    },
  ];
}

interface MobileMenuSheetsProps {
  activeSheet: MobileSheetId;
  setSheet: (sheet: MobileSheetId) => void;
  onDismiss: () => void;
  editor: Editor;
  controller: AppController;
  clipboard: PixelClipboard;
  freeTransform: FreeTransform;
  view: ViewOptions;
  viewport: ViewportController | null;
  viewArea: () => Rect | null;
}

export function MobileMenuSheets({
  activeSheet,
  setSheet,
  onDismiss,
  editor,
  controller,
  clipboard,
  freeTransform,
  view,
  viewport,
  viewArea,
}: MobileMenuSheetsProps) {
  useEditorRevision(editor);
  useRevision(controller);
  useRevision(clipboard);
  useRevision(view);
  const closeAll = () => setSheet('none');

  if (activeSheet === 'file') {
    return (
      <MobileSheet title="File" testId="file.sheet" onDismiss={onDismiss}>
        <SheetActionList items={buildFileSheetItems(controller, closeAll)} />
      </MobileSheet>
    );
  }

  if (activeSheet === 'edit') {
    return (
      <MobileSheet title="Edit" testId="edit.sheet" onDismiss={onDismiss}>
        <SheetActionList
          items={buildEditSheetItems(
            editor,
            controller,
            clipboard,
            freeTransform,
            viewArea,
            () => setSheet('edit-transform'),
            closeAll,
          )}
        />
      </MobileSheet>
    );
  }

  if (activeSheet === 'edit-transform') {
    return (
      <MobileSheet
        title="Transform"
        testId="edit.transformSublist"
        onDismiss={onDismiss}
        onBack={() => setSheet('edit')}
        backTestId="edit.backButton"
      >
        <SheetActionList
          items={buildTransformSublistItems(freeTransform, controller.blocked, closeAll)}
        />
      </MobileSheet>
    );
  }

  if (activeSheet === 'select') {
    return (
      <MobileSheet title="Select" testId="select.sheet" onDismiss={onDismiss}>
        <SheetActionList items={buildSelectSheetItems(editor, controller.blocked, closeAll)} />
      </MobileSheet>
    );
  }

  if (activeSheet === 'image') {
    return (
      <MobileSheet title="Image" testId="image.sheet" onDismiss={onDismiss}>
        <SheetActionList items={buildImageSheetItems(editor, controller, closeAll)} />
      </MobileSheet>
    );
  }

  if (activeSheet === 'menu') {
    return (
      <MobileSheet title="Menu" testId="menu.sheet" onDismiss={onDismiss}>
        <SheetActionList items={buildMenuSheetItems(controller, view, viewport, closeAll)} />
      </MobileSheet>
    );
  }

  return null;
}

function SheetActionList({ items }: { items: readonly SheetActionItem[] }) {
  return (
    <div className="mobile-sheet-action-list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="mobile-sheet-action-button"
          data-testid={item.testId}
          disabled={item.disabled}
          aria-pressed={item.checked}
          onClick={item.run}
        >
          <span>{item.label}</span>
          {item.checked !== undefined && (
            <span className="mobile-sheet-check" aria-hidden="true">
              {item.checked ? '✓' : ''}
            </span>
          )}
          {item.hasSublist && (
            <span className="mobile-sheet-chevron" aria-hidden="true">
              ›
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
