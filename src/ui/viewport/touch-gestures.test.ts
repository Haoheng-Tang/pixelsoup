import { describe, expect, it, vi } from 'vitest';
import {
  allowsTouchContextMenu,
  pinchPanTransform,
  TOUCH_LONG_PRESS_MS,
  TouchGestureController,
  type TouchPointInput,
  type TouchTimers,
} from './touch-gestures';
import type { ViewTransform } from './view-transform';

class FakeTimers implements TouchTimers {
  private nextId = 1;
  private readonly tasks = new Map<number, { fn: () => void; ms: number }>();

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.tasks.set(id, { fn, ms });
    return id;
  }

  clearTimeout(id: number): void {
    this.tasks.delete(id);
  }

  flush(): void {
    for (const [id, task] of [...this.tasks.entries()]) {
      this.tasks.delete(id);
      task.fn();
    }
  }

  get pendingCount(): number {
    return this.tasks.size;
  }
}

function pt(pointerId: number, x: number, y: number): TouchPointInput {
  return { pointerId, clientX: x, clientY: y, localX: x, localY: y };
}

describe('allowsTouchContextMenu', () => {
  it('allows marquee, wand, bucket, eyedropper, crop and transform sessions only', () => {
    expect(allowsTouchContextMenu('rect-marquee', false)).toBe(true);
    expect(allowsTouchContextMenu('ellipse-marquee', false)).toBe(true);
    expect(allowsTouchContextMenu('magic-wand', false)).toBe(true);
    expect(allowsTouchContextMenu('paint-bucket', false)).toBe(true);
    expect(allowsTouchContextMenu('eyedropper', false)).toBe(true);
    expect(allowsTouchContextMenu('crop', false)).toBe(true);

    expect(allowsTouchContextMenu('brush', false)).toBe(false);
    expect(allowsTouchContextMenu('eraser', false)).toBe(false);
    expect(allowsTouchContextMenu('move', false)).toBe(false);
    expect(allowsTouchContextMenu('lasso', false)).toBe(false);
    expect(allowsTouchContextMenu('polygon-lasso', false)).toBe(false);

    // When a Free Transform session is active, long-press is always allowed.
    expect(allowsTouchContextMenu('brush', true)).toBe(true);
    expect(allowsTouchContextMenu('move', true)).toBe(true);
  });
});

describe('pinchPanTransform', () => {
  it('scales zoom about a fixed midpoint when two fingers spread symmetrically', () => {
    const startView: ViewTransform = { zoom: 1, panX: 50, panY: 30 };
    // Midpoint is (200, 150); distance doubles from 100 to 200.
    const next = pinchPanTransform(
      startView,
      { x: 150, y: 150 },
      { x: 250, y: 150 },
      { x: 100, y: 150 },
      { x: 300, y: 150 },
    );
    expect(next.zoom).toBeCloseTo(2);
    // Document point under (200, 150) at start is (150, 120); at zoom 2: 200 - 150*2 = -100, 150 - 120*2 = -90.
    expect(next.panX).toBeCloseTo(-100);
    expect(next.panY).toBeCloseTo(-90);
  });

  it('pans without changing zoom when two fingers translate together', () => {
    const startView: ViewTransform = { zoom: 1.5, panX: 10, panY: -20 };
    const next = pinchPanTransform(
      startView,
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 140, y: 130 },
      { x: 240, y: 130 },
    );
    expect(next.zoom).toBeCloseTo(1.5);
    expect(next.panX).toBeCloseTo(50);
    expect(next.panY).toBeCloseTo(10);
  });
});

describe('TouchGestureController', () => {
  function setup(toolId = 'brush', hasSession = false, onDoc = true) {
    let view: ViewTransform = { zoom: 1, panX: 0, panY: 0 };
    const timers = new FakeTimers();
    const startTool = vi.fn();
    const moveTool = vi.fn();
    const endTool = vi.fn();
    const cancelTool = vi.fn();
    const openContextMenu = vi.fn();
    const onPinchStateChange = vi.fn();

    const controller = new TouchGestureController(
      {
        getView: () => view,
        setView: (v) => {
          view = v;
        },
        getToolContext: () => ({ toolId, hasSession }),
        isOnDocument: () => onDoc,
        startTool,
        moveTool,
        endTool,
        cancelTool,
        openContextMenu,
        onPinchStateChange,
      },
      timers,
    );

    return {
      controller,
      timers,
      getView: () => view,
      startTool,
      moveTool,
      endTool,
      cancelTool,
      openContextMenu,
      onPinchStateChange,
    };
  }

  it('routes a single-finger drag to the active tool', () => {
    const { controller, startTool, moveTool, endTool, cancelTool } = setup('brush');
    controller.pointerDown(pt(1, 100, 100));
    controller.pointerMove(pt(1, 120, 130));
    controller.pointerUp(pt(1, 120, 130));

    expect(startTool).toHaveBeenCalledTimes(1);
    expect(moveTool).toHaveBeenCalledTimes(1);
    expect(endTool).toHaveBeenCalledTimes(1);
    expect(cancelTool).not.toHaveBeenCalled();
    expect(controller.isActive).toBe(false);
  });

  it('cancels an in-progress single-finger tool gesture when a second finger lands and switches to pinch-pan', () => {
    const { controller, getView, startTool, moveTool, endTool, cancelTool, onPinchStateChange } =
      setup('brush');
    controller.pointerDown(pt(1, 100, 100));
    controller.pointerMove(pt(1, 110, 100));
    expect(startTool).toHaveBeenCalledTimes(1);
    expect(moveTool).toHaveBeenCalledTimes(1);

    // Second finger lands at (210, 100): cancels the brush stroke and begins pinch-pan.
    controller.pointerDown(pt(2, 210, 100));
    expect(cancelTool).toHaveBeenCalledTimes(1);
    expect(onPinchStateChange).toHaveBeenCalledWith(true);

    // Spread fingers from distance 100 (110..210) to 200 (60..260) around midpoint (160, 100).
    controller.pointerMove(pt(1, 60, 100));
    controller.pointerMove(pt(2, 260, 100));
    expect(getView().zoom).toBeCloseTo(2);
    expect(moveTool).toHaveBeenCalledTimes(1);

    // Lifting one finger leaves the controller in cooldown until the last finger lifts.
    controller.pointerUp(pt(2, 260, 100));
    expect(onPinchStateChange).toHaveBeenCalledWith(false);
    controller.pointerMove(pt(1, 80, 120));
    expect(moveTool).toHaveBeenCalledTimes(1);
    controller.pointerUp(pt(1, 80, 120));
    expect(endTool).not.toHaveBeenCalled();
    expect(controller.isActive).toBe(false);
  });

  it('opens the context menu on long-press for allowed tools and cancels the press', () => {
    const { controller, timers, startTool, cancelTool, endTool, openContextMenu } =
      setup('rect-marquee');
    controller.pointerDown(pt(1, 80, 90));
    expect(startTool).toHaveBeenCalledTimes(1);
    expect(timers.pendingCount).toBe(1);

    timers.flush();
    expect(cancelTool).toHaveBeenCalledTimes(1);
    expect(openContextMenu).toHaveBeenCalledWith({ x: 80, y: 90 });

    // Releasing after long-press does not commit the tool gesture.
    controller.pointerUp(pt(1, 80, 90));
    expect(endTool).not.toHaveBeenCalled();
  });

  it('does not open the context menu on long-press for brush, eraser, move or lassos', () => {
    for (const toolId of ['brush', 'eraser', 'move', 'lasso', 'polygon-lasso']) {
      const { controller, timers, openContextMenu } = setup(toolId);
      controller.pointerDown(pt(1, 50, 50));
      expect(timers.pendingCount).toBe(0);
      timers.flush();
      expect(openContextMenu).not.toHaveBeenCalled();
      controller.pointerUp(pt(1, 50, 50));
    }
  });

  it('cancels long-press if the finger moves beyond TOUCH_SLOP_PX before TOUCH_LONG_PRESS_MS', () => {
    const { controller, timers, openContextMenu, endTool } = setup('rect-marquee');
    expect(TOUCH_LONG_PRESS_MS).toBeGreaterThanOrEqual(400);
    controller.pointerDown(pt(1, 50, 50));
    controller.pointerMove(pt(1, 70, 50));
    expect(timers.pendingCount).toBe(0);
    timers.flush();
    expect(openContextMenu).not.toHaveBeenCalled();
    controller.pointerUp(pt(1, 70, 50));
    expect(endTool).toHaveBeenCalledTimes(1);
  });

  it('defers Magic Wand and Paint Bucket tap until pointerUp so pinch or long-press never fires them', () => {
    // 1. Pinching with Paint Bucket active does not run startTool.
    const pinchCase = setup('paint-bucket');
    pinchCase.controller.pointerDown(pt(1, 40, 40));
    expect(pinchCase.startTool).not.toHaveBeenCalled();
    pinchCase.controller.pointerDown(pt(2, 140, 40));
    pinchCase.controller.pointerUp(pt(2, 140, 40));
    pinchCase.controller.pointerUp(pt(1, 40, 40));
    expect(pinchCase.startTool).not.toHaveBeenCalled();

    // 2. Long-pressing with Paint Bucket active opens the context menu without filling.
    const holdCase = setup('paint-bucket');
    holdCase.controller.pointerDown(pt(1, 40, 40));
    holdCase.timers.flush();
    expect(holdCase.openContextMenu).toHaveBeenCalledWith({ x: 40, y: 40 });
    holdCase.controller.pointerUp(pt(1, 40, 40));
    expect(holdCase.startTool).not.toHaveBeenCalled();

    // 3. A quick single-finger tap with Paint Bucket runs startTool and endTool on release.
    const tapCase = setup('paint-bucket');
    tapCase.controller.pointerDown(pt(1, 40, 40));
    tapCase.controller.pointerUp(pt(1, 40, 40));
    expect(tapCase.startTool).toHaveBeenCalledTimes(1);
    expect(tapCase.endTool).toHaveBeenCalledTimes(1);
  });
});
