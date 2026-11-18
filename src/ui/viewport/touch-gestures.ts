import type { ViewTransform } from './view-transform';
import { clampZoom } from './view-transform';

/** Hold duration (ms) before a stationary single-finger touch opens the canvas context menu. */
export const TOUCH_LONG_PRESS_MS = 500;
/** Maximum movement (CSS px) before a single-finger touch counts as a drag rather than a hold/tap. */
export const TOUCH_SLOP_PX = 8;

const TOUCH_CONTEXT_MENU_TOOLS: ReadonlySet<string> = new Set([
  'rect-marquee',
  'ellipse-marquee',
  'magic-wand',
  'paint-bucket',
  'eyedropper',
  'crop',
]);

/**
 * Click tools that execute their command immediately in `pointerDown` without a `cancel()`
 * rollback. On touch, deferring their single-finger tap until `pointerUp` ensures that a
 * two-finger pinch or a long-press for the context menu never triggers a fill or wand pick.
 */
const DEFERRED_TOUCH_TAP_TOOLS: ReadonlySet<string> = new Set(['magic-wand', 'paint-bucket']);

/**
 * Canvas long-press opens the context menu only for marquee, wand, bucket, eyedropper,
 * crop and transform; never for brush, eraser, move or the lassos.
 */
export function allowsTouchContextMenu(toolId: string, hasSession: boolean): boolean {
  if (hasSession) return true;
  return TOUCH_CONTEXT_MENU_TOOLS.has(toolId);
}

export function isDeferredTouchTapTool(toolId: string, hasSession: boolean): boolean {
  if (hasSession) return false;
  return DEFERRED_TOUCH_TAP_TOOLS.has(toolId);
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Computes the new `ViewTransform` from a two-finger pinch and pan gesture.
 * Scales zoom by the ratio of current to initial finger distance (`clampZoom`), and translates
 * pan so the document point that started under the initial midpoint stays under the current midpoint.
 */
export function pinchPanTransform(
  startView: ViewTransform,
  startA: ScreenPoint,
  startB: ScreenPoint,
  curA: ScreenPoint,
  curB: ScreenPoint,
): ViewTransform {
  const startMidX = (startA.x + startB.x) / 2;
  const startMidY = (startA.y + startB.y) / 2;
  const curMidX = (curA.x + curB.x) / 2;
  const curMidY = (curA.y + curB.y) / 2;

  const startDist = Math.hypot(startB.x - startA.x, startB.y - startA.y);
  const curDist = Math.hypot(curB.x - curA.x, curB.y - curA.y);
  const scale = startDist >= 1 ? curDist / startDist : 1;

  const zoom = clampZoom(startView.zoom * scale);
  const ratio = zoom / startView.zoom;
  return {
    zoom,
    panX: curMidX - (startMidX - startView.panX) * ratio,
    panY: curMidY - (startMidY - startView.panY) * ratio,
  };
}

export interface TouchPointInput {
  readonly pointerId: number;
  /** Client coordinates (for context menu positioning). */
  readonly clientX: number;
  readonly clientY: number;
  /** Viewport-local screen coordinates (`client - bounds`). */
  readonly localX: number;
  readonly localY: number;
}

export interface TouchTimers {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

const DEFAULT_TIMERS: TouchTimers = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

export interface TouchGestureCallbacks<E extends TouchPointInput> {
  getView(): ViewTransform;
  setView(view: ViewTransform): void;
  getToolContext(): { readonly toolId: string; readonly hasSession: boolean };
  isOnDocument(point: E): boolean;
  startTool(e: E): void;
  moveTool(e: E): void;
  endTool(e: E): void;
  cancelTool(): void;
  openContextMenu(at: { readonly x: number; readonly y: number }): void;
  onPinchStateChange?(pinching: boolean): void;
}

type TouchMode = 'idle' | 'single' | 'pinch' | 'cooldown';

interface ActiveTouch<E> {
  readonly startLocal: ScreenPoint;
  currentLocal: ScreenPoint;
  lastEvent: E;
}

/**
 * Arbitrates single-finger tool gestures, long-press context menu, and two-finger
 * pinch-zoom / pan for `pointerType === 'touch'` events on the viewport canvas.
 */
export class TouchGestureController<E extends TouchPointInput = TouchPointInput> {
  private readonly touches = new Map<number, ActiveTouch<E>>();
  private mode: TouchMode = 'idle';
  private longPressTimer = 0;
  private deferredDown: E | null = null;
  private toolStarted = false;
  private pinchStart: {
    readonly idA: number;
    readonly idB: number;
    readonly startA: ScreenPoint;
    readonly startB: ScreenPoint;
    readonly startView: ViewTransform;
  } | null = null;

  constructor(
    private readonly callbacks: TouchGestureCallbacks<E>,
    private readonly timers: TouchTimers = DEFAULT_TIMERS,
  ) {}

  /** Whether any touch is currently on the canvas. */
  get isActive(): boolean {
    return this.mode !== 'idle';
  }

  /** Whether a two-finger pinch/pan gesture is currently active. */
  get isPinching(): boolean {
    return this.mode === 'pinch';
  }

  pointerDown(e: E): void {
    const local: ScreenPoint = { x: e.localX, y: e.localY };
    this.touches.set(e.pointerId, {
      startLocal: local,
      currentLocal: local,
      lastEvent: e,
    });

    if (this.touches.size === 1 && this.mode === 'idle') {
      this.mode = 'single';
      const { toolId, hasSession } = this.callbacks.getToolContext();
      if (isDeferredTouchTapTool(toolId, hasSession)) {
        this.deferredDown = e;
        this.toolStarted = false;
      } else {
        this.deferredDown = null;
        this.toolStarted = true;
        this.callbacks.startTool(e);
      }
      if (allowsTouchContextMenu(toolId, hasSession) && this.callbacks.isOnDocument(e)) {
        const pointerId = e.pointerId;
        this.longPressTimer = this.timers.setTimeout(() => {
          this.longPressTimer = 0;
          const touch = this.touches.get(pointerId);
          if (this.mode !== 'single' || !touch) return;
          this.abortSingleTool();
          this.mode = 'cooldown';
          this.callbacks.openContextMenu({
            x: touch.lastEvent.clientX,
            y: touch.lastEvent.clientY,
          });
        }, TOUCH_LONG_PRESS_MS);
      }
      return;
    }

    // A second finger landed: cancel any single-finger tool gesture or long-press and enter pinch/pan.
    this.clearLongPress();
    this.abortSingleTool();

    if (this.touches.size === 2) {
      const [first, second] = [...this.touches.entries()];
      if (!first || !second) return;
      const [idA, touchA] = first;
      const [idB, touchB] = second;
      const wasPinching = this.mode === 'pinch';
      this.mode = 'pinch';
      this.pinchStart = {
        idA,
        idB,
        startA: { ...touchA.currentLocal },
        startB: { ...touchB.currentLocal },
        startView: this.callbacks.getView(),
      };
      if (!wasPinching) this.callbacks.onPinchStateChange?.(true);
    } else {
      // 3+ fingers: wait until all fingers lift.
      const wasPinching = this.mode === 'pinch';
      this.mode = 'cooldown';
      this.pinchStart = null;
      if (wasPinching) this.callbacks.onPinchStateChange?.(false);
    }
  }

  pointerMove(e: E): void {
    const touch = this.touches.get(e.pointerId);
    if (!touch) return;
    touch.currentLocal = { x: e.localX, y: e.localY };
    touch.lastEvent = e;

    if (this.mode === 'single') {
      const dist = Math.hypot(e.localX - touch.startLocal.x, e.localY - touch.startLocal.y);
      if (dist > TOUCH_SLOP_PX) {
        this.clearLongPress();
        if (this.deferredDown) {
          // Click-only tools (Magic Wand, Paint Bucket) do nothing on a drag; discard tap if dragged far.
          this.deferredDown = null;
        }
      }
      if (this.toolStarted) {
        this.callbacks.moveTool(e);
      }
      return;
    }

    if (this.mode === 'pinch' && this.pinchStart) {
      const touchA = this.touches.get(this.pinchStart.idA);
      const touchB = this.touches.get(this.pinchStart.idB);
      if (!touchA || !touchB) return;
      const next = pinchPanTransform(
        this.pinchStart.startView,
        this.pinchStart.startA,
        this.pinchStart.startB,
        touchA.currentLocal,
        touchB.currentLocal,
      );
      this.callbacks.setView(next);
    }
  }

  pointerUp(e: E): void {
    const touch = this.touches.get(e.pointerId);
    if (!touch) return;
    this.touches.delete(e.pointerId);
    this.clearLongPress();

    if (this.mode === 'single') {
      if (this.deferredDown) {
        const down = this.deferredDown;
        this.deferredDown = null;
        this.callbacks.startTool(down);
        this.callbacks.endTool(e);
      } else if (this.toolStarted) {
        this.toolStarted = false;
        this.callbacks.endTool(e);
      }
      this.mode = 'idle';
      return;
    }

    if (this.mode === 'pinch') {
      this.pinchStart = null;
      this.callbacks.onPinchStateChange?.(false);
      this.mode = this.touches.size === 0 ? 'idle' : 'cooldown';
      return;
    }

    if (this.touches.size === 0) {
      this.mode = 'idle';
    }
  }

  pointerCancel(pointerId: number): void {
    if (!this.touches.has(pointerId)) return;
    this.touches.delete(pointerId);
    this.clearLongPress();

    if (this.mode === 'single') {
      this.abortSingleTool();
    } else if (this.mode === 'pinch') {
      this.pinchStart = null;
      this.callbacks.onPinchStateChange?.(false);
    }
    this.mode = this.touches.size === 0 ? 'idle' : 'cooldown';
  }

  cancelAll(): void {
    if (this.mode === 'idle') return;
    const wasPinching = this.mode === 'pinch';
    this.touches.clear();
    this.clearLongPress();
    this.abortSingleTool();
    this.pinchStart = null;
    this.mode = 'idle';
    if (wasPinching) this.callbacks.onPinchStateChange?.(false);
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      this.timers.clearTimeout(this.longPressTimer);
      this.longPressTimer = 0;
    }
  }

  private abortSingleTool(): void {
    this.deferredDown = null;
    if (this.toolStarted) {
      this.toolStarted = false;
      this.callbacks.cancelTool();
    }
  }
}
