import { useCallback, useEffect, useState } from 'react';
import type { Editor, Rect } from '../../../core';
import type { PixelClipboard } from '../../clipboard/pixel-clipboard';
import type { Colors } from '../../color/colors';
import { CanvasMenu } from '../../panels/CanvasMenu';
import { LayerPanel } from '../../panels/LayerPanel';
import { ToolOptionsBar } from '../../panels/ToolOptionsBar';
import { Toolbar } from '../../panels/Toolbar';
import type { AppController } from '../../session/app-controller';
import type { ToolManager } from '../../tools/tool-manager';
import type { FreeTransform } from '../../transform/free-transform';
import { StatusBar } from '../../viewport/StatusBar';
import { Viewport } from '../../viewport/Viewport';
import type { ViewportController } from '../../viewport/viewport-controller';
import type { ViewOptions } from '../../viewport/view-options';

export interface ShellProps {
  editor: Editor;
  controller: AppController;
  clipboard: PixelClipboard;
  tools: ToolManager;
  freeTransform: FreeTransform;
  colors: Colors;
  view: ViewOptions;
  viewport: ViewportController | null;
  onViewportReady: (viewport: ViewportController | null) => void;
  viewArea: () => Rect | null;
}

export function DesktopShell(props: ShellProps) {
  const {
    editor,
    controller,
    clipboard,
    tools,
    freeTransform,
    colors,
    view,
    viewport,
    onViewportReady,
    viewArea,
  } = props;
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => viewport?.onContextMenu(setMenuAt), [viewport]);
  const closeMenu = useCallback(() => {
    setMenuAt(null);
    viewport?.focus();
  }, [viewport]);

  return (
    <>
      <Toolbar
        editor={editor}
        controller={controller}
        tools={tools}
        freeTransform={freeTransform}
        colors={colors}
        view={view}
        viewport={viewport}
        clipboard={clipboard}
        viewArea={viewArea}
      />
      <ToolOptionsBar tools={tools} />
      <main className="workspace">
        <Viewport
          editor={editor}
          tools={tools}
          view={view}
          gate={controller}
          onReady={onViewportReady}
        />
        <aside className="sidebar">
          <LayerPanel editor={editor} blocked={controller.blocked} />
        </aside>
      </main>
      <StatusBar viewport={viewport} tools={tools} />
      {menuAt && viewport && (
        <CanvasMenu
          at={menuAt}
          editor={editor}
          controller={controller}
          tools={tools}
          freeTransform={freeTransform}
          viewport={viewport}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
