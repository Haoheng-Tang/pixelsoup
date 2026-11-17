import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ContextMenu } from '../../panels/ContextMenu';
import { toolButtonView, toolFlyoutSections, toolGroupLabel } from '../../panels/tool-groups';
import { iconFor, useLongPress } from '../../panels/ToolPicker';
import type { ToolKey } from '../../tools/tool';
import type { ToolGroup, ToolManager } from '../../tools/tool-manager';
import { useActiveTool } from '../../tools/use-active-tool';

/**
 * Order of the 9 tool groups in the horizontal scroll-snap strip matching `canvas.jpg`
 * (Crop, Marquee, Lasso, Magic Wand, Move) and `canvas2.jpg` (Brush, Eraser, Paint Bucket,
 * Eyedropper).
 */
const MOBILE_TOOL_ORDER: readonly ToolKey[] = ['C', 'M', 'L', 'W', 'V', 'B', 'E', 'G', 'I'];

const TOOL_TEST_IDS: Readonly<Record<ToolKey, string>> = {
  C: 'canvas.cropTool',
  M: 'canvas.marqueeTool',
  L: 'canvas.lassoTool',
  W: 'canvas.magicWandTool',
  V: 'canvas.moveTool',
  B: 'canvas.brushTool',
  E: 'canvas.eraserTool',
  G: 'canvas.paintBucketTool',
  I: 'canvas.eyedropperTool',
  T: 'canvas.textTool',
};

export function MobileToolStrip({ tools }: { tools: ToolManager }) {
  useActiveTool(tools);
  const orderedGroups = useMemo(() => {
    const byKey = new Map(tools.groups.map((g) => [g.key, g]));
    const ordered: ToolGroup[] = [];
    for (const key of MOBILE_TOOL_ORDER) {
      const group = byKey.get(key);
      if (group) ordered.push(group);
    }
    for (const group of tools.groups) {
      if (!ordered.includes(group)) ordered.push(group);
    }
    return ordered;
  }, [tools.groups]);

  return (
    <div
      className="mobile-tool-strip"
      data-testid="canvas.toolStrip"
      role="group"
      aria-label="Tools"
    >
      {orderedGroups.map((group) => (
        <MobileToolButton key={group.key} tools={tools} group={group} />
      ))}
    </div>
  );
}

function MobileToolButton({ tools, group }: { tools: ToolManager; group: ToolGroup }) {
  const view = toolButtonView(tools, group);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [flyoutAt, setFlyoutAt] = useState<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);

  const openFlyout = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Position above the bottom tool strip so it stays inside the viewport.
      setFlyoutAt({ x: rect.left, y: Math.max(8, rect.top - 84) });
    }
  }, []);

  const closeFlyout = useCallback(() => {
    setFlyoutAt(null);
    buttonRef.current?.focus();
  }, []);

  const hold = useLongPress(() => {
    ignoreClick.current = true;
    openFlyout();
  });

  const onClick = (e: ReactMouseEvent) => {
    if (e.detail > 0 && ignoreClick.current) {
      ignoreClick.current = false;
      return;
    }
    if (view.grouped && e.target instanceof Element && e.target.closest('.tool-group-mark')) {
      openFlyout();
      return;
    }
    tools.activate(view.tool.id);
  };

  return (
    <div className="mobile-tool-slot">
      <button
        ref={buttonRef}
        type="button"
        className="tool-button mobile-tool-button"
        data-testid={TOOL_TEST_IDS[group.key]}
        aria-pressed={view.pressed}
        aria-label={view.tool.name}
        aria-haspopup={view.grouped ? 'menu' : undefined}
        aria-expanded={view.grouped ? flyoutAt !== null : undefined}
        title={view.title}
        onClick={onClick}
        onPointerDown={(e) => {
          ignoreClick.current = false;
          if (view.grouped && e.button === 0) hold.start();
        }}
        onPointerUp={hold.cancel}
        onPointerLeave={hold.cancel}
        onPointerCancel={hold.cancel}
        onContextMenu={(e) => {
          if (!view.grouped) return;
          e.preventDefault();
          hold.cancel();
          ignoreClick.current = true;
          openFlyout();
        }}
      >
        {iconFor(view.tool)}
        {view.grouped && <span className="tool-group-mark" aria-hidden="true" />}
      </button>
      {flyoutAt && (
        <ContextMenu
          x={flyoutAt.x}
          y={flyoutAt.y}
          label={toolGroupLabel(group.key)}
          sections={toolFlyoutSections(tools, group, iconFor)}
          onClose={closeFlyout}
          swallowsPress={(target) => {
            const onButton = target instanceof Node && !!buttonRef.current?.contains(target);
            if (onButton) ignoreClick.current = true;
            return onButton;
          }}
        />
      )}
    </div>
  );
}
