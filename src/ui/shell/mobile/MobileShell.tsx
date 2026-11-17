import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ColorSwatches } from '../../color/ColorSwatches';
import { CanvasMenu } from '../../panels/CanvasMenu';
import { ToolOptionsBar } from '../../panels/ToolOptionsBar';
import { useRevision } from '../../use-revision';
import { StatusBar } from '../../viewport/StatusBar';
import { Viewport } from '../../viewport/Viewport';
import type { ShellProps } from '../desktop/DesktopShell';
import { MobileBottomBar } from './MobileBottomBar';
import { MobileContextStrip } from './MobileContextStrip';
import { MobileMenuSheets } from './MobileMenuSheets';
import { dismissMobileSheet, toggleMobileSheet } from './mobile-sheet-state';
import { MobileSheet } from './MobileSheet';
import { MobileToolStrip } from './MobileToolStrip';
import type { MobileSheetId } from './MobileTopBar';
import { MobileTopBar } from './MobileTopBar';

export interface MobileShellProps extends ShellProps {
  renderSheet?: (
    activeSheet: MobileSheetId,
    setSheet: (sheet: MobileSheetId) => void,
    dismiss: () => void,
  ) => ReactNode;
}

export function MobileShell({
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
  renderSheet,
}: MobileShellProps) {
  useRevision(controller);
  const [activeSheet, setActiveSheet] = useState<MobileSheetId>('none');
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => viewport?.onContextMenu(setMenuAt), [viewport]);
  const closeMenu = useCallback(() => {
    setMenuAt(null);
    viewport?.focus();
  }, [viewport]);

  const toggle = useCallback((target: MobileSheetId) => {
    setActiveSheet((cur) => toggleMobileSheet(cur, target));
  }, []);

  const dismiss = useCallback(() => {
    setActiveSheet((cur) => dismissMobileSheet(cur));
  }, []);

  return (
    <div className="mobile-shell" data-testid="mobile.shell">
      <MobileTopBar
        editor={editor}
        controller={controller}
        viewport={viewport}
        activeSheet={activeSheet}
        onToggleLayers={() => toggle('layers')}
      />
      <main className="workspace mobile-workspace">
        <Viewport
          editor={editor}
          tools={tools}
          view={view}
          gate={controller}
          onReady={onViewportReady}
        />
        {activeSheet === 'options' && (
          <MobileSheet title="Tool Options & Colours" testId="options.sheet" onDismiss={dismiss}>
            <div className="mobile-options-sheet-content">
              <ColorSwatches colors={colors} />
              <ToolOptionsBar tools={tools} />
            </div>
          </MobileSheet>
        )}
        <MobileMenuSheets
          activeSheet={activeSheet}
          setSheet={setActiveSheet}
          onDismiss={dismiss}
          editor={editor}
          controller={controller}
          clipboard={clipboard}
          freeTransform={freeTransform}
          view={view}
          viewport={viewport}
          viewArea={viewArea}
        />
        {renderSheet?.(activeSheet, setActiveSheet, dismiss)}
      </main>
      <StatusBar viewport={viewport} tools={tools} />
      <div className="mobile-dock">
        <MobileContextStrip
          editor={editor}
          tools={tools}
          freeTransform={freeTransform}
          colors={colors}
          optionsOpen={activeSheet === 'options'}
          onToggleOptions={() => toggle('options')}
        />
        <MobileToolStrip tools={tools} />
        <MobileBottomBar
          activeSheet={activeSheet}
          blocked={controller.blocked}
          onToggleSheet={(sheet) => toggle(sheet)}
        />
      </div>
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
    </div>
  );
}
