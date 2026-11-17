import { useCallback, useState } from 'react';
import type { Editor, Rect } from '../core';
import type { PixelClipboard } from './clipboard/pixel-clipboard';
import { useClipboardShortcuts } from './clipboard/use-clipboard-shortcuts';
import type { Colors } from './color/colors';
import { ModalHost } from './dialogs/ModalHost';
import type { AppController } from './session/app-controller';
import { DesktopShell } from './shell/desktop/DesktopShell';
import type { ToolManager } from './tools/tool-manager';
import type { FreeTransform } from './transform/free-transform';
import { useBrushShortcuts } from './use-brush-shortcuts';
import { useColorShortcuts } from './use-color-shortcuts';
import { useDocumentWindow } from './use-document-window';
import { useEditShortcuts } from './use-edit-shortcuts';
import { useFileDrop } from './use-file-drop';
import { useFileShortcuts } from './use-file-shortcuts';
import { useHistoryShortcuts } from './use-history-shortcuts';
import { useLayerShortcuts } from './use-layer-shortcuts';
import { useRevision } from './use-revision';
import { useSelectionShortcuts } from './use-selection-shortcuts';
import { useToolShortcuts } from './use-tool-shortcuts';
import { useTransformShortcuts } from './use-transform-shortcuts';
import { useViewShortcuts } from './use-view-shortcuts';
import type { ViewportController } from './viewport/viewport-controller';
import type { ViewOptions } from './viewport/view-options';

interface AppProps {
  editor: Editor;
  controller: AppController;
  clipboard: PixelClipboard;
  tools: ToolManager;
  freeTransform: FreeTransform;
  colors: Colors;
  view: ViewOptions;
}

export function App(props: AppProps) {
  const { editor, controller, clipboard, tools, freeTransform, colors, view } = props;
  const [viewport, setViewport] = useState<ViewportController | null>(null);
  const viewArea = useCallback((): Rect | null => viewport?.visibleArea() ?? null, [viewport]);
  useRevision(controller);
  useHistoryShortcuts(editor, controller);
  useEditShortcuts(editor, colors, controller);
  useClipboardShortcuts(clipboard, controller, viewArea);
  useSelectionShortcuts(editor, controller);
  useLayerShortcuts(editor, controller);
  useViewShortcuts(view, controller);
  useToolShortcuts(tools, controller);
  useTransformShortcuts(freeTransform, controller);
  useColorShortcuts(colors, controller);
  useBrushShortcuts(tools, controller);
  useFileShortcuts(controller);
  const dropping = useFileDrop(controller);
  useDocumentWindow(controller.session);

  return (
    <div className={controller.busy ? 'app busy' : 'app'} aria-busy={controller.busy}>
      <DesktopShell
        editor={editor}
        controller={controller}
        clipboard={clipboard}
        tools={tools}
        freeTransform={freeTransform}
        colors={colors}
        view={view}
        viewport={viewport}
        onViewportReady={setViewport}
        viewArea={viewArea}
      />
      <ModalHost controller={controller} colors={colors} />
      {dropping && (
        <div className="drop-hint" aria-hidden="true">
          <div className="drop-hint-label">Drop to open</div>
        </div>
      )}
    </div>
  );
}
